<?php
/**
 * Rate limiting simple por clave (normalmente un uid real de Firebase, ya
 * verificado por firebase_auth.php), ventana deslizante de N segundos, sin
 * dependencias externas ni base de datos — un archivo JSON por clave en
 * sys_get_temp_dir(), el mismo patrón ya usado para la caché de JWKS en
 * server/lib/firebase_auth.php.
 *
 * HONESTIDAD sobre los límites de este enfoque:
 *   - sys_get_temp_dir() es local a un único servidor/proceso; si esto algún
 *     día corre detrás de varios servidores balanceados, cada uno llevaría
 *     su propio contador y el límite real efectivo sería (N × número de
 *     servidores). Para el hosting cPanel actual (un solo servidor) el
 *     límite es exacto.
 *   - No es perfectamente atómico bajo concurrencia extrema: flock() serializa
 *     las escrituras de un mismo archivo, pero dos requests simultáneos del
 *     mismo uid en procesos PHP-FPM distintos siguen pudiendo entrelazarse
 *     en el peor caso. Aceptable para el volumen de esta app — no es un
 *     endpoint de banca, es una defensa contra abuso de cuota, no una
 *     garantía criptográfica.
 *   - El propósito es exclusivamente anti-abuso (que nadie queme la cuota
 *     gratis de Gemini o spamee pushes), no un SLA de tráfico.
 */

// Devuelve true si la petición está permitida (y la registra), false si se
// superó el límite de $maxRequests peticiones en los últimos $windowSeconds
// segundos para esta $key dentro de este $namespace (namespace separa, por
// ejemplo, los contadores de gemini-proxy.php de los de fcm-send.php aunque
// compartan el mismo uid).
function rate_limit_check(string $namespace, string $key, int $maxRequests, int $windowSeconds): bool {
    $safeNamespace = preg_replace('/[^a-zA-Z0-9_-]/', '_', $namespace);
    $safeKey = preg_replace('/[^a-zA-Z0-9_-]/', '_', $key);
    $file = sys_get_temp_dir() . '/egconnect_ratelimit_' . $safeNamespace . '_' . $safeKey . '.json';

    $fp = fopen($file, 'c+');
    if ($fp === false) {
        // Si no se puede abrir el archivo de control (p. ej. problema de
        // permisos del directorio temporal), mejor dejar pasar la petición
        // (fallar abierto) que tumbar el endpoint entero por un problema de
        // disco ajeno al usuario que está llamando.
        return true;
    }

    flock($fp, LOCK_EX);
    $raw = stream_get_contents($fp);
    $timestamps = json_decode($raw !== false ? $raw : '', true);
    if (!is_array($timestamps)) {
        $timestamps = [];
    }

    $now = time();
    $windowStart = $now - $windowSeconds;
    // Ventana deslizante real: se descartan las marcas de tiempo más viejas
    // que la ventana en vez de resetear un contador fijo cada minuto en
    // punto — eso último dejaría colar hasta 2x el límite justo alrededor
    // del borde del reset (p. ej. el límite completo a las 12:00:59 y otra
    // vez el límite completo a las 12:01:01).
    $timestamps = array_values(array_filter(
        $timestamps,
        function ($t) use ($windowStart) {
            return is_numeric($t) && $t > $windowStart;
        }
    ));

    $allowed = count($timestamps) < $maxRequests;
    if ($allowed) {
        $timestamps[] = $now;
    }

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($timestamps));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    return $allowed;
}
