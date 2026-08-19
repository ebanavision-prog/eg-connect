<?php
/**
 * Server-side "send a real push" endpoint for EG CONNECT.
 *
 * Why this exists: the client (src/services/pushService.ts) can already save
 * a device's real FCM token to users/{uid}.fcmTokens — that part is free and
 * runs entirely in the browser. But actually SENDING a push through FCM's
 * HTTP v1 API requires an OAuth2 access token minted from a Google service
 * account's private key, which can never be exposed to the browser (every
 * user's tab would be able to push-spam every other user). The normal fix is
 * a Cloud Function, which requires the Blaze plan even at $0 real usage —
 * explicitly out for this project. So instead: the same plain-PHP pattern as
 * server/gemini-proxy.php, running on the existing free cPanel hosting.
 *
 * Request contract (POST, JSON body):
 *   {
 *     "tokens": ["<recipient FCM token>", ...],
 *     "title": "...",
 *     "body": "...",
 *     "idToken": "<SENDER's own Firebase Auth ID token>"
 *   }
 *
 * Client-side responsibilities (not this file's job):
 *   - `tokens` come from the SENDER's client reading the RECIPIENT's
 *     users/{targetUid} doc directly from Firestore (firestore.rules already
 *     allows `get` to any signed-in user) and passing its `fcmTokens` array.
 *     This script never touches Firestore itself.
 *   - `idToken` comes from `auth.currentUser.getIdToken()` on the SENDER's
 *     own session (firebase/auth). It proves the request really comes from a
 *     logged-in EG CONNECT user, not an anonymous script hitting this URL.
 *
 * Response: { "results": [ { "token": "...", "ok": true|false, "error"?: "..." }, ... ] }
 * or, before that, an { "error": "..." } with a non-200 status if the request
 * itself is rejected (bad origin, bad method, invalid/expired idToken, or the
 * server isn't configured yet).
 */

$config = require __DIR__ . '/config.php';

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $config['ALLOWED_ORIGINS'], true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (!in_array($origin, $config['ALLOWED_ORIGINS'], true)) {
    http_response_code(403);
    echo json_encode(['error' => 'Origen no permitido.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido.']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['error' => 'Cuerpo JSON inválido.']);
    exit;
}

$tokens = $body['tokens'] ?? [];
$title = trim((string)($body['title'] ?? ''));
$messageBody = trim((string)($body['body'] ?? ''));
$idToken = (string)($body['idToken'] ?? '');

if (!is_array($tokens) || count($tokens) === 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Falta al menos un token de destino.']);
    exit;
}
if ($title === '' || $messageBody === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Faltan title o body.']);
    exit;
}
if ($idToken === '') {
    http_response_code(401);
    echo json_encode(['error' => 'Falta idToken.']);
    exit;
}

$projectId = $config['FIREBASE_PROJECT_ID'] ?? '';
if ($projectId === '') {
    http_response_code(500);
    echo json_encode(['error' => 'Servidor sin FIREBASE_PROJECT_ID configurado.']);
    exit;
}

// ---------------------------------------------------------------------------
// Paso 1: verificar que idToken es un ID token de Firebase Auth real,
// vigente y de ESTE proyecto — en PHP puro, sin librería (openssl_verify +
// las claves públicas JWK que publica Google). Esto es lo que impide que
// este endpoint sea un relé abierto de spam push: sin esta verificación,
// cualquiera en internet podría mandar POSTs directos con tokens de destino
// robados/adivinados y un idToken inventado.
//
// HONESTIDAD sobre qué tan fuerte es esto: se comprueba la firma RS256
// contra la clave pública real de Google (prueba criptográfica de que Google
// emitió el token), el issuer, la audiencia (este proyecto) y la expiración.
// Lo que NO se comprueba aquí (a diferencia del Admin SDK oficial) es la
// revocación en tiempo real (auth_time / tokens revocados manualmente en la
// consola de Firebase) ni el claim "sub" contra una lista de usuarios
// conocida — no hace falta para este caso de uso porque no se actúa "como"
// ese usuario, solo se confirma que hay una sesión válida y vigente detrás
// del request. Es una verificación real de firma+claims, no un teatro, pero
// no es tan exhaustiva como el SDK oficial de Google.

function base64url_decode(string $data): string {
    $padded = strtr($data, '-_', '+/');
    $remainder = strlen($padded) % 4;
    if ($remainder) {
        $padded .= str_repeat('=', 4 - $remainder);
    }
    return base64_decode($padded);
}

// Convierte una clave pública RSA en formato JWK (n, e en base64url) a PEM,
// construyendo a mano la estructura DER de SubjectPublicKeyInfo. No hay
// forma más corta de hacer esto en PHP puro sin openssl_pkey_get_public
// aceptando JWK directamente (no lo acepta), así que se arma el ASN.1 a
// mano. Es el enfoque estándar documentado para este problema en PHP.
function jwk_to_pem(string $nB64, string $eB64): string {
    $n = base64url_decode($nB64);
    $e = base64url_decode($eB64);

    $der_int = function (string $bin): string {
        // Si el primer byte tiene el bit alto puesto, hay que anteponer un
        // 0x00 para que no se interprete como número negativo (regla DER).
        if (ord($bin[0]) > 0x7f) {
            $bin = "\x00" . $bin;
        }
        return "\x02" . der_length(strlen($bin)) . $bin;
    };

    $modulus = $der_int($n);
    $exponent = $der_int($e);
    $rsaPublicKey = "\x30" . der_length(strlen($modulus) + strlen($exponent)) . $modulus . $exponent;

    // OID rsaEncryption (1.2.840.113549.1.1.1) + NULL, envuelto en el
    // AlgorithmIdentifier estándar de un SubjectPublicKeyInfo.
    $rsaOid = "\x30\x0d\x06\x09\x2a\x86\x48\x86\xf7\x0d\x01\x01\x01\x05\x00";
    $bitString = "\x03" . der_length(strlen($rsaPublicKey) + 1) . "\x00" . $rsaPublicKey;
    $spki = "\x30" . der_length(strlen($rsaOid) + strlen($bitString)) . $rsaOid . $bitString;

    $pem = "-----BEGIN PUBLIC KEY-----\n";
    $pem .= chunk_split(base64_encode($spki), 64, "\n");
    $pem .= "-----END PUBLIC KEY-----\n";
    return $pem;
}

function der_length(int $len): string {
    if ($len < 0x80) {
        return chr($len);
    }
    $bytes = '';
    while ($len > 0) {
        $bytes = chr($len & 0xff) . $bytes;
        $len >>= 8;
    }
    return chr(0x80 | strlen($bytes)) . $bytes;
}

// Cache local del JWK set de Google en disco (vida corta) para no tener que
// pedirlo a Google en cada request — el propio header Cache-Control de
// Google en ese endpoint normalmente da varias horas de margen, pero aquí se
// limita de forma conservadora a 1 hora por simplicidad y para no servir
// claves obsoletas demasiado tiempo si Google rota alguna.
function fetch_google_jwks(): ?array {
    $cacheFile = sys_get_temp_dir() . '/egconnect_firebase_jwks_cache.json';
    if (is_file($cacheFile) && (time() - filemtime($cacheFile)) < 3600) {
        $cached = json_decode((string)file_get_contents($cacheFile), true);
        if (is_array($cached) && isset($cached['keys'])) {
            return $cached;
        }
    }

    $ch = curl_init('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false || $httpCode >= 400) {
        // Si falla la descarga pero hay una caché vieja, mejor usarla que
        // rechazar todos los requests de golpe.
        if (is_file($cacheFile)) {
            $cached = json_decode((string)file_get_contents($cacheFile), true);
            if (is_array($cached) && isset($cached['keys'])) {
                return $cached;
            }
        }
        return null;
    }

    $decoded = json_decode($response, true);
    if (!is_array($decoded) || !isset($decoded['keys'])) {
        return null;
    }
    @file_put_contents($cacheFile, $response);
    return $decoded;
}

function verify_firebase_id_token(string $idToken, string $projectId): array {
    $parts = explode('.', $idToken);
    if (count($parts) !== 3) {
        return ['ok' => false, 'error' => 'Formato de token inválido.'];
    }
    [$headerB64, $payloadB64, $sigB64] = $parts;

    $header = json_decode(base64url_decode($headerB64), true);
    $payload = json_decode(base64url_decode($payloadB64), true);
    $signature = base64url_decode($sigB64);

    if (!is_array($header) || !is_array($payload)) {
        return ['ok' => false, 'error' => 'No se pudo decodificar el token.'];
    }
    if (($header['alg'] ?? '') !== 'RS256') {
        return ['ok' => false, 'error' => 'Algoritmo de firma no soportado.'];
    }
    $kid = $header['kid'] ?? '';
    if ($kid === '') {
        return ['ok' => false, 'error' => 'Token sin kid.'];
    }

    $now = time();
    if (($payload['exp'] ?? 0) <= $now) {
        return ['ok' => false, 'error' => 'Token expirado.'];
    }
    if (($payload['iat'] ?? PHP_INT_MAX) > $now + 60) {
        return ['ok' => false, 'error' => 'Token emitido en el futuro.'];
    }
    if (($payload['aud'] ?? '') !== $projectId) {
        return ['ok' => false, 'error' => 'Audiencia incorrecta.'];
    }
    if (($payload['iss'] ?? '') !== 'https://securetoken.google.com/' . $projectId) {
        return ['ok' => false, 'error' => 'Emisor incorrecto.'];
    }
    if (empty($payload['sub'])) {
        return ['ok' => false, 'error' => 'Token sin sub.'];
    }

    $jwks = fetch_google_jwks();
    if ($jwks === null) {
        return ['ok' => false, 'error' => 'No se pudieron obtener las claves públicas de Google.'];
    }

    $matchingKey = null;
    foreach ($jwks['keys'] as $key) {
        if (($key['kid'] ?? '') === $kid) {
            $matchingKey = $key;
            break;
        }
    }
    if ($matchingKey === null) {
        return ['ok' => false, 'error' => 'Clave de firma desconocida (kid no encontrado).'];
    }

    $pem = jwk_to_pem($matchingKey['n'], $matchingKey['e']);
    $publicKey = openssl_pkey_get_public($pem);
    if ($publicKey === false) {
        return ['ok' => false, 'error' => 'No se pudo cargar la clave pública.'];
    }

    $signedData = $headerB64 . '.' . $payloadB64;
    $verifyResult = openssl_verify($signedData, $signature, $publicKey, OPENSSL_ALGO_SHA256);
    if ($verifyResult !== 1) {
        return ['ok' => false, 'error' => 'Firma inválida.'];
    }

    return ['ok' => true, 'uid' => $payload['sub']];
}

$verification = verify_firebase_id_token($idToken, $projectId);
if (!$verification['ok']) {
    http_response_code(401);
    echo json_encode(['error' => 'idToken inválido: ' . $verification['error']]);
    exit;
}
// A partir de aquí sabemos que el request viene de una sesión real y
// vigente de un usuario de EG CONNECT (su uid es $verification['uid']),
// aunque este endpoint no necesita usar ese uid para nada más — solo sirve
// de guardia anti-spam.

// ---------------------------------------------------------------------------
// Paso 2: cargar la cuenta de servicio y pedir un access token OAuth2 vía el
// flujo JWT-bearer (RFC 7523) — el mismo mecanismo que usa el SDK oficial de
// Google, pero escrito a mano en PHP puro (curl + openssl) para no añadir
// ninguna dependencia.
//
// El archivo de la cuenta de servicio es una credencial real de Google Cloud
// que SOLO el humano puede generar (Firebase Console → Configuración del
// proyecto → Cuentas de servicio → "Generar nueva clave privada") y subir al
// servidor. Este script nunca la fabrica ni asume que existe: si falta,
// responde con un error claro en vez de fingir que el push se envió.

$serviceAccountPath = $config['FIREBASE_SERVICE_ACCOUNT_PATH'] ?? '';
if ($serviceAccountPath === '' || !is_file($serviceAccountPath) || !is_readable($serviceAccountPath)) {
    http_response_code(503);
    echo json_encode(['error' => 'Servicio de push no configurado todavía en el servidor.']);
    exit;
}

$serviceAccount = json_decode((string)file_get_contents($serviceAccountPath), true);
if (
    !is_array($serviceAccount)
    || empty($serviceAccount['client_email'])
    || empty($serviceAccount['private_key'])
    || empty($serviceAccount['project_id'])
) {
    http_response_code(503);
    echo json_encode(['error' => 'Servicio de push no configurado todavía en el servidor.']);
    exit;
}

function base64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

// Construye y firma (RS256, con la clave privada de la cuenta de servicio)
// el JWT de assertion que pide el flujo jwt-bearer de Google, y lo cambia
// por un access token de corto plazo con el scope de FCM.
function get_fcm_access_token(array $serviceAccount): array {
    $now = time();
    $header = ['alg' => 'RS256', 'typ' => 'JWT'];
    $claims = [
        'iss' => $serviceAccount['client_email'],
        'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
        'aud' => 'https://oauth2.googleapis.com/token',
        'iat' => $now,
        'exp' => $now + 3600,
    ];

    $signingInput = base64url_encode(json_encode($header)) . '.' . base64url_encode(json_encode($claims));

    $privateKey = openssl_pkey_get_private($serviceAccount['private_key']);
    if ($privateKey === false) {
        return ['ok' => false, 'error' => 'No se pudo cargar la clave privada de la cuenta de servicio.'];
    }

    $signature = '';
    $signed = openssl_sign($signingInput, $signature, $privateKey, OPENSSL_ALGO_SHA256);
    if (!$signed) {
        return ['ok' => false, 'error' => 'No se pudo firmar el JWT de la cuenta de servicio.'];
    }

    $assertion = $signingInput . '.' . base64url_encode($signature);

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_POSTFIELDS => http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $assertion,
        ]),
        CURLOPT_TIMEOUT => 15,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false || $httpCode >= 400) {
        return ['ok' => false, 'error' => 'Google rechazó la solicitud de access token.'];
    }

    $decoded = json_decode($response, true);
    if (!is_array($decoded) || empty($decoded['access_token'])) {
        return ['ok' => false, 'error' => 'Respuesta de token inesperada de Google.'];
    }

    return ['ok' => true, 'access_token' => $decoded['access_token']];
}

$tokenResult = get_fcm_access_token($serviceAccount);
if (!$tokenResult['ok']) {
    http_response_code(502);
    echo json_encode(['error' => $tokenResult['error']]);
    exit;
}
$accessToken = $tokenResult['access_token'];

// ---------------------------------------------------------------------------
// Paso 3: enviar el push a cada token vía FCM HTTP v1. Un token individual
// puede fallar (dispositivo desinstaló la app, token caducado, etc.) sin que
// eso tumbe el request completo — se recogen los resultados por token.

function send_fcm_message(string $projectId, string $accessToken, string $token, string $title, string $body): array {
    $url = "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send";
    $payload = [
        'message' => [
            'token' => $token,
            'notification' => [
                'title' => $title,
                'body' => $body,
            ],
        ],
    ];

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $accessToken,
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT => 15,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response !== false && $httpCode < 300) {
        return ['token' => $token, 'ok' => true];
    }

    $decoded = json_decode((string)$response, true);
    $errorMessage = $decoded['error']['message'] ?? ('FCM respondió ' . $httpCode);
    return ['token' => $token, 'ok' => false, 'error' => $errorMessage];
}

$results = [];
foreach ($tokens as $token) {
    if (!is_string($token) || $token === '') {
        $results[] = ['token' => (string)$token, 'ok' => false, 'error' => 'Token vacío o inválido.'];
        continue;
    }
    $results[] = send_fcm_message($serviceAccount['project_id'], $accessToken, $token, $title, $messageBody);
}

echo json_encode(['results' => $results]);
