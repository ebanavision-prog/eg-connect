<?php
/**
 * Server-side proxy for the three Gemini calls EG CONNECT makes from the client
 * (extractContact, actionSteps, icebreaker). The API key lives only here —
 * config.php — and never reaches the browser. Runs on plain PHP so it works on
 * the existing cPanel hosting with no extra service or billing plan.
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
$action = $body['action'] ?? '';
$payload = $body['payload'] ?? [];

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
