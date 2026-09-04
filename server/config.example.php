<?php
// Copy this file to config.php (same folder) and fill in the real key.
// config.php is never sent to the browser — PHP always executes it server-side,
// it only leaks if someone downloads the raw source file directly, so keep it
// out of any publicly browsable/listable directory.

return [
    'GEMINI_API_KEY' => 'PON_AQUI_LA_LLAVE_NUEVA',

    // Only requests whose Origin header matches one of these are served.
    // Add the Firebase Hosting domain here once Sección B esté lista.
    'ALLOWED_ORIGINS' => [
        'https://connect.ebanavision.com',
    ],

    // Firebase project ID (visible, not secret) — usado por server/fcm-send.php
    // y server/gemini-proxy.php (vía server/lib/firebase_auth.php) para validar
    // el "aud"/"iss" del idToken del usuario, y por fcm-send.php además para
    // construir la URL de FCM HTTP v1.
    'FIREBASE_PROJECT_ID' => 'gen-lang-client-0951010679',

    // Ruta al JSON de la cuenta de servicio de Firebase, usada por
    // server/fcm-send.php para autenticarse contra FCM HTTP v1 y enviar
    // pushes reales. ES UNA CREDENCIAL REAL — se genera en Firebase Console →
    // Configuración del proyecto → Cuentas de servicio → "Generar nueva clave
    // privada", y se sube a mano a esta misma carpeta del servidor (NUNCA al
    // repo de git — ver la entrada en .gitignore). Mientras este archivo no
    // exista en el servidor, fcm-send.php responde con un error claro en vez
    // de fingir que el push se envió.
    'FIREBASE_SERVICE_ACCOUNT_PATH' => __DIR__ . '/firebase-service-account.json',
];
