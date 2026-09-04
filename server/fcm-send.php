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
// La implementación (base64url_decode, jwk_to_pem, der_length,
// fetch_google_jwks, verify_firebase_id_token) vive en
// server/lib/firebase_auth.php para que server/gemini-proxy.php la reutilice
// sin duplicar esta crypto hecha a mano — ver ese archivo para el detalle y
// las notas de honestidad sobre qué comprueba y qué no.
require_once __DIR__ . '/lib/firebase_auth.php';
require_once __DIR__ . '/lib/rate_limiter.php';

$verification = verify_firebase_id_token($idToken, $projectId);
if (!$verification['ok']) {
    http_response_code(401);
    echo json_encode(['error' => 'idToken inválido: ' . $verification['error']]);
    exit;
}
// A partir de aquí sabemos que el request viene de una sesión real y
// vigente de un usuario de EG CONNECT — su uid es $verification['uid'],
// que se usa a continuación solo para el rate limiting anti-spam.

// Límite conservador: 30 envíos de push por minuto y por uid es de sobra
// para el uso real (un mensaje o una solicitud de conexión dispara como
// mucho un push), y evita que un bug de cliente o un uso malintencionado
// convierta este endpoint en un cañón de spam push.
if (!rate_limit_check('fcm', $verification['uid'], 30, 60)) {
    http_response_code(429);
    echo json_encode(['error' => 'Demasiadas solicitudes de push. Espera un minuto antes de volver a intentarlo.']);
    exit;
}

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
