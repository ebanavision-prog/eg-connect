<?php
/**
 * Server-side proxy for the three Gemini calls EG CONNECT makes from the client
 * (extractContact, actionSteps, icebreaker). The API key lives only here —
 * config.php — and never reaches the browser. Runs on plain PHP so it works on
 * the existing cPanel hosting with no extra service or billing plan.
 *
 * Request contract (POST, JSON body):
 *   {
 *     "action": "extractContact" | "actionSteps" | "icebreaker",
 *     "payload": { ... específico de cada acción, ver el switch más abajo ... },
 *     "idToken": "<Firebase Auth ID token del usuario que llama>"
 *   }
 *
 * Por qué idToken es obligatorio (no lo era antes): la única defensa previa
 * era comprobar la cabecera Origin contra una lista blanca, pero Origin no
 * es una cabecera protegida fuera de un navegador real — un simple
 * `curl -H "Origin: https://connect.ebanavision.com"` la falsifica sin
 * esfuerzo, y con eso cualquiera podría quemar la cuota gratis de Gemini.
 * Se exige la misma verificación de idToken que ya usaba server/fcm-send.php
 * (código compartido ahora vía server/lib/firebase_auth.php), para que solo
 * usuarios con una sesión real de EG CONNECT puedan llegar a llamar a Gemini
 * a través de este proxy.
 */

$config = require __DIR__ . '/config.php';
require_once __DIR__ . '/lib/firebase_auth.php';
require_once __DIR__ . '/lib/rate_limiter.php';

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

$action = $body['action'] ?? '';
$payload = $body['payload'] ?? [];
$idToken = (string)($body['idToken'] ?? '');

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

// Misma verificación de idToken que server/fcm-send.php (ver
// server/lib/firebase_auth.php para el detalle y las notas de honestidad
// sobre qué comprueba y qué no).
$verification = verify_firebase_id_token($idToken, $projectId);
if (!$verification['ok']) {
    http_response_code(401);
    echo json_encode(['error' => 'idToken inválido: ' . $verification['error']]);
    exit;
}
// A partir de aquí sabemos que el request viene de una sesión real y
// vigente de un usuario de EG CONNECT — su uid es $verification['uid'],
// que se usa a continuación solo para el rate limiting anti-abuso.

// Límite conservador: las llamadas a Gemini cuestan cuota real (aunque sea
// del tier gratis), así que 20/minuto por uid alcanza de sobra para el uso
// normal (escanear tarjetas, pedir pasos de acción, icebreakers) sin dejar
// que un bug de cliente o un uso malintencionado agote la cuota del proyecto.
if (!rate_limit_check('gemini', $verification['uid'], 20, 60)) {
    http_response_code(429);
    echo json_encode(['error' => 'Demasiadas solicitudes a la IA. Espera un minuto antes de volver a intentarlo.']);
    exit;
}

function call_gemini(string $apiKey, array $requestBody): array {
    $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=' . urlencode($apiKey);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($requestBody),
        CURLOPT_TIMEOUT => 30,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false || $httpCode >= 400) {
        return ['error' => 'Gemini no respondió correctamente.'];
    }

    $decoded = json_decode($response, true);
    $text = $decoded['candidates'][0]['content']['parts'][0]['text'] ?? null;
    if ($text === null) {
        return ['error' => 'Respuesta vacía de Gemini.'];
    }

    $parsed = json_decode($text, true);
    return $parsed !== null ? $parsed : ['text' => $text];
}

switch ($action) {
    case 'extractContact':
        $base64Image = $payload['base64Image'] ?? '';
        if (!$base64Image) {
            http_response_code(400);
            echo json_encode(['error' => 'Falta la imagen.']);
            exit;
        }
        $result = call_gemini($config['GEMINI_API_KEY'], [
            'contents' => [[
                'parts' => [
                    ['inlineData' => ['mimeType' => 'image/jpeg', 'data' => $base64Image]],
                    ['text' => 'Extract contact information from this business card. Return as JSON with the following fields: name, role, company, location, tags (array of strings), note (short summary of what they do). Language must be Spanish.'],
                ],
            ]],
            'generationConfig' => [
                'responseMimeType' => 'application/json',
                'responseSchema' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'name' => ['type' => 'STRING'],
                        'role' => ['type' => 'STRING'],
                        'company' => ['type' => 'STRING'],
                        'location' => ['type' => 'STRING'],
                        'tags' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']],
                        'note' => ['type' => 'STRING'],
                    ],
                    'required' => ['name', 'role', 'company'],
                ],
            ],
        ]);
        break;

    case 'actionSteps':
        $context = $payload['context'] ?? '';
        $result = call_gemini($config['GEMINI_API_KEY'], [
            'contents' => [['parts' => [[
                'text' => "Based on this context from a meeting in Equatorial Guinea: \"$context\", generate 3-5 concrete next action steps or tasks in Spanish.",
            ]]]],
            'generationConfig' => [
                'responseMimeType' => 'application/json',
                'responseSchema' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'title' => ['type' => 'STRING'],
                            'priority' => ['type' => 'STRING', 'enum' => ['high', 'medium', 'low']],
                        ],
                    ],
                ],
            ],
        ]);
        break;

    case 'icebreaker':
        $name = $payload['contactName'] ?? '';
        $role = $payload['role'] ?? '';
        $company = $payload['company'] ?? '';
        $tags = implode(', ', $payload['tags'] ?? []);
        $result = call_gemini($config['GEMINI_API_KEY'], [
            'contents' => [['parts' => [[
                'text' => "Eres un experto en networking profesional en Guinea Ecuatorial. Genera una frase de apertura (icebreaker) corta, profesional y amigable para iniciar una conversación con $name, quien es $role en $company. Sus intereses son: $tags. La frase debe sonar natural en español local.",
            ]]]],
        ]);
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Acción desconocida.']);
        exit;
}

echo json_encode($result);
