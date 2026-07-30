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
];
