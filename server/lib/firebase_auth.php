<?php
/**
 * Verificación de idToken de Firebase Auth en PHP puro — sin librerías.
 *
 * Extraído de server/fcm-send.php (donde se escribió y probó primero) para
 * que server/gemini-proxy.php pueda reutilizar exactamente la misma
 * verificación en vez de duplicar toda esta crypto hecha a mano. La lógica
 * interna no cambió al moverla aquí: mismo comportamiento, mismos mensajes
 * de error, mismo caché en disco.
 *
 * Uso desde cualquier endpoint:
 *   require_once __DIR__ . '/lib/firebase_auth.php';
 *   $verification = verify_firebase_id_token($idToken, $projectId);
 *   if (!$verification['ok']) { ... responder 401 ... }
 *   // $verification['uid'] es el uid real del usuario detrás del request.
 */

// ---------------------------------------------------------------------------
// Verificar que un idToken es un ID token de Firebase Auth real, vigente y de
// ESTE proyecto — en PHP puro, sin librería (openssl_verify + las claves
// públicas JWK que publica Google). Esto es lo que impide que un endpoint
// protegido por esta función sea un relé abierto de spam/abuso: sin esta
// verificación, cualquiera en internet podría mandar POSTs directos con un
// idToken inventado.
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
