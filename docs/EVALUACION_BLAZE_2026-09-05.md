# Evaluación técnica — activar plan Blaze (Firebase)

**Fecha:** 2026-09-05
**Alcance:** solo evaluación, sin gastar ni activar nada. Inventario de todo el código real (no documentación) que cambiaría si algún día se activa Blaze. Cada hallazgo se releyó en esta sesión antes de citarlo.
**Contexto:** `docs/PLAN_MEJORA_360.md`, Fase 4 ("Escala, cuando el volumen lo justifique, no antes").

---

## 1. Todo lo que hoy está apagado/limitado explícitamente por falta de Storage/Blaze

### 1.1 Avatares de perfil/empresa — el caso ya conocido
`src/services/firebaseService.ts:387-420`:

```
export const uploadImage = async (path: string, file: Blob): Promise<string> => {
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
};

const storageEnabled = import.meta.env.VITE_FIREBASE_STORAGE_ENABLED === 'true';

export const uploadAvatarIfNeeded = async (path: string, avatarValue: string): Promise<string> => {
  if (!avatarValue || !avatarValue.startsWith('data:') || !storageEnabled) return avatarValue;
  try {
    const blob = await (await fetch(avatarValue)).blob();
    return await uploadImage(path, blob);
  } catch (error) {
    console.warn('Firebase Storage no disponible, guardando avatar como base64:', error);
    return avatarValue;
  }
};
```

`uploadImage` en sí ya está completa y correcta (sube a Storage, devuelve URL) — lo único gateado es el *intento* de usarla, vía la constante `storageEnabled` leída de `VITE_FIREBASE_STORAGE_ENABLED` (`.env.example`, comentario explícito: "Firebase Storage exige plan Blaze"). El comentario en el propio archivo (líneas 400-408) documenta que antes SÍ se intentaba subir siempre y el SDK tardaba varios segundos en fallar antes de caer a base64 — de ahí el gate explícito. **El día que se active Storage, basta con poner esa variable en `true`; no hace falta tocar código.**

### 1.2 Botón "Adjuntar archivo" en el chat — muerto, sin onClick
`src/components/ChatScreen.tsx:261-263`:

```tsx
<button className="p-2 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant focus-ring-custom" aria-label={t('chat.attachFileAria')}>
  <Paperclip className="w-5 h-5" />
</button>
```

No es un fallback base64 ni tiene comentario explicativo — es un botón `Paperclip` con `aria-label` (`chat.attachFileAria`, existente en `es.json`/`en.json` línea 619) pero **sin `onClick`, sin `<input type="file">`, sin ningún handler**. No aparece mencionado en `PLAN_MEJORA_360.md`. Es el candidato natural a "adjuntos de chat tipo LinkedIn": hoy no hace nada porque no hay dónde subir el archivo (no hay Storage activo), pero a diferencia del avatar no tiene ni siquiera un camino de fallback a base64 — simplemente no está cableado. Si se retoma esta feature, necesitaría Storage real (los documentos de Firestore tienen límite de 1 MB, así que un adjunto binario en base64-en-Firestore no es viable, igual que se documentó para el audio).

### 1.3 Mensajes de voz — retirados deliberadamente, comentario explícito de Blaze
`src/components/ChatScreen.tsx:240-246` (mensaje histórico) y `:323-327` (botón de envío):

```tsx
// Mensajes de voz retirados (ver docs/PLAN_MEJORA_360.md Fase 3) --
// este mensaje nunca tuvo audio real reproducible (audioUrl era
// siempre '#'). Si queda alguno histórico en Firestore, se muestra
// honesto en vez del reproductor falso que había antes.
<p className="leading-relaxed italic opacity-70">{t('chat.legacyVoiceMessageUnavailable')}</p>
```
```tsx
{/* Sin mensajes de voz -- ver docs/PLAN_MEJORA_360.md Fase 3: Storage
    real exige Blaze (apagado a proposito en este proyecto) y
    base64-en-Firestore no es viable para audio (multiplica la
    cuota gratuita en cada sincronizacion). Patron tipo LinkedIn:
    un unico boton de enviar, deshabilitado sin texto. */}
```

Confirmado: esta feature se **retiró por completo** (según `PLAN_MEJORA_360.md` Fase 3, commit `f022fe1`, confirmado por el usuario 2026-09-05), no está "apagada" — habría que reconstruirla desde cero (grabación con `MediaRecorder`, subida a Storage) si se retoma.

### 1.4 Tarjeta de invitación (share card) — dependencia indirecta documentada
`src/services/shareCardService.ts:156-166`:

```
* Si el avatar es una URL externa sin cabeceras CORS (poco probable hoy:
* mientras VITE_FIREBASE_STORAGE_ENABLED sea false, el avatar es un
* data: URL local, sin problema de CORS), dibujarlo puede "contaminar" el
* canvas e impedir exportarlo. En ese caso, en vez de fallar, esta función
* vuelve a generar la tarjeta sin el avatar...
```

No es un gate en sí — es una función que ya funciona hoy y seguirá funcionando después de activar Storage, pero el comentario documenta que **el día que Storage esté activo, los avatares pasan a ser URLs externas (`firebasestorage.googleapis.com`), y ese día este código de fallback CORS deja de ser "poco probable" y empieza a ejercitarse de verdad.** No requiere cambio de código, pero sí probarlo en la práctica (el fallback ya existe, solo hay que confirmar que Firebase Storage sirve `Access-Control-Allow-Origin` correctamente para `getDownloadURL()`, cosa que normalmente hace por defecto).

### 1.5 Otras menciones de "Blaze"/"Spark" en el código (contexto, no gates nuevos)
- `src/services/pushService.ts:5-9`: comentario aclarando que FCM en sí es gratis, lo que exigiría Blaze es un *disparador automático* del lado servidor (Cloud Function) — por eso existe `server/fcm-send.php` como alternativa PHP. No es un gate de código, es la explicación de por qué existe el shim PHP.
- `src/hooks/useAppNotifications.ts:6-11`: comentario "el proyecto está en el plan Spark, sin funciones de servidor" — explica por qué el centro de notificaciones deriva todo de listeners de Firestore en el cliente en vez de un trigger de Cloud Function. No es un gate, es una decisión de arquitectura ya ejecutada (y funcional).
- `server/fcm-send.php:8-13`: comentario explícito "*The normal fix is a Cloud Function, which requires the Blaze plan even at $0 real usage — explicitly out for this project*". Confirma que el PHP existe **exclusivamente** para evitar Blaze.

### 1.6 Búsqueda exhaustiva — no hay más
Grep de `Blaze|storageEnabled|Spark|plan gratuito|no activado|VITE_FIREBASE_STORAGE` sobre todo `src/` y `server/` (incluyendo `.php`) no arrojó ningún otro punto además de los listados arriba. No hay fallbacks base64 adicionales fuera de avatares/audio (el único otro uso de base64 en el código es el escaneo de tarjetas de visita en `src/components/ScanScreen.tsx:59-61`, que es un caso distinto: la imagen se manda en base64 al proxy PHP de Gemini para extracción de texto, nunca se guarda en Storage ni en Firestore — no está relacionado con Blaze).

---

## 2. App Check

**No hay absolutamente ningún rastro** — ni configuración activa, ni comentada, ni un esqueleto de import sin usar. Verificado con grep de `appcheck|app-check|recaptcha|enterprise` (case-insensitive) sobre `src/`, `server/`, `index.html`, `firebase.json`, `.firebaserc`, y específicamente en `src/main.tsx` y `src/services/firebaseService.ts` (donde vive toda la inicialización de Firebase, líneas 1-80): sin resultados. `package.json` no tiene `firebase/app-check` como import usado (el paquete `firebase` sí lo incluye como subpaquete disponible, pero no se importa en ningún archivo).

Lo único relacionado con App Check que existe es la **mención en prosa** dentro de `docs/PLAN_MEJORA_360.md` sección 2 ("Sin Firebase App Check... App Check es gratis y cierra ese flanco") — es decir, está identificado como pendiente en el plan, pero cero código, cero esqueleto. No hay nada que "completar", habría que empezar desde cero.

Dato relevante para la evaluación: **App Check no requiere Blaze** (funciona en Spark) — es completamente independiente de la decisión de Blaze. Se puede activar en cualquier momento sin relación con Storage/Cloud Functions.

---

## 3. Candidatos reales a migrar de PHP a Cloud Functions

### 3.1 `server/gemini-proxy.php` (204 líneas)
**Qué hace hoy:**
- Proxy de las 3 llamadas a Gemini (`extractContact`, `actionSteps`, `icebreaker`), guarda la API key server-side (`gemini-proxy.php:1-27`).
- CORS manual por `Origin` contra whitelist (`gemini-proxy.php:30-47`).
- Exige `idToken` real de Firebase Auth, verificado a mano con `verify_firebase_id_token()` de `server/lib/firebase_auth.php` (`gemini-proxy.php:62-90`).
- Rate limiting propio: 20 req/min por uid, vía `rate_limit_check('gemini', ...)` de `server/lib/rate_limiter.php` (`gemini-proxy.php:92-100`).
- Llama a Gemini vía `curl` puro (`gemini-proxy.php:102-129`).

**Qué se simplificaría al migrar a Cloud Functions:**
- La API key seguiría sin llegar al navegador igual (secreto de función), sin cambio conceptual.
- La verificación de idToken **se simplificaría de verdad**: con `onCall` de Cloud Functions (Firebase Functions v2), el `context.auth`/`request.auth` ya viene verificado por el runtime de Firebase (usa el Admin SDK internamente) — **los ~170 líneas de crypto manual de `firebase_auth.php` (RS256 a mano, JWK→PEM a mano, caché de JWKS a mano) dejarían de hacer falta por completo** para este propósito. Esto es la simplificación más grande de toda la migración.
- CORS: `onCall` maneja CORS automáticamente para llamadas desde el SDK cliente de Firebase; si se usa `onRequest` (HTTP genérico) en vez de `onCall`, seguiría haciendo falta CORS manual pero mucho más simple (con librerías, no reinventado).

**Qué se complicaría o seguiría igual:**
- **Rate limiting NO es nativo en Cloud Functions.** Cloud Functions no tiene un rate-limiter por-usuario incorporado — hay que seguir implementándolo a mano (Firestore, Redis/Memorystore, o Firebase Extensions de terceros) o usar Google Cloud Armor/API Gateway delante (esto sí cuesta dinero real, no es gratis como el rate limiter actual). El patrón actual (`sys_get_temp_dir()` + `flock()`, ventana deslizante) **no es portable** a Cloud Functions: las instancias de función son efímeras y sin disco persistente compartido entre invocaciones — habría que reescribir el rate limiter contra Firestore (con el costo de lecturas/escrituras extra que eso implica) o un servicio externo. Es decir: **la migración no "hereda" el rate limiting actual, hay que reconstruirlo con otro mecanismo**, y ese mecanismo consume cuota Firestore real (no es gratis en el sentido de "sin llamadas de red" que sí lo es el archivo local en PHP).
- El propio `rate_limiter.php` documenta su límite: "si esto algún día corre detrás de varios servidores balanceados, cada uno llevaría su propio contador" (`rate_limiter.php:10-14`) — Cloud Functions es, por naturaleza, multi-instancia, así que este problema que hoy es teórico (cPanel es un solo servidor) se volvería real de inmediato.
- Cold starts: Cloud Functions en el tier gratuito de Blaze tiene arranques en frío que un servidor PHP persistente en cPanel no tiene — latencia añadida percibida por el usuario en la primera llamada tras inactividad.

### 3.2 `server/fcm-send.php` (285 líneas)
**Qué hace hoy:**
- Verificación de `idToken` (misma librería compartida, `firebase_auth.php`) — mismo razonamiento que en 3.1.
- Rate limiting propio: 30 req/min por uid (`fcm-send.php:126-134`) — mismas limitaciones que 3.1.
- Cambia la cuenta de servicio (JSON local en el servidor, `config.php: FIREBASE_SERVICE_ACCOUNT_PATH`) por un access token OAuth2 vía flujo JWT-bearer, **firmado a mano con `openssl_sign`** (`fcm-send.php:174-225`) — reconstruye lo que el SDK Admin de Google hace internamente.
- Envía el push por HTTP v1 de FCM con `curl` (`fcm-send.php:240-274`).

**Qué se simplificaría al migrar a Cloud Functions:**
- **Toda la sección de "Paso 2" (obtener access token OAuth2 firmando un JWT a mano, líneas 136-233) desaparecería por completo.** Con `firebase-admin` disponible nativamente en el runtime de Cloud Functions, enviar un push es una sola llamada (`admin.messaging().send(...)`) — sin manejo manual de credenciales, sin firmar JWTs, sin `curl` a `oauth2.googleapis.com`. Esta es la simplificación más grande de las dos migraciones.
- La cuenta de servicio ya no viviría como archivo subido a mano al servidor cPanel (con el riesgo de pérdida/rotación no documentada que señala `PLAN_MEJORA_360.md` sección 1) — Cloud Functions usa la identidad de servicio del propio proyecto automáticamente.

**Qué seguiría igual o se complicaría:**
- Mismo problema de rate limiting no-nativo que 3.1.
- El diseño actual "el cliente lee `fcmTokens` de Firestore y se los pasa al PHP" (`fcm-send.php:23-27`, "para que fcm-send.php no dependa de Firestore") dejaría de tener sentido como restricción: una Cloud Function sí puede leer Firestore directamente y de forma más segura (server-side, sin exponer qué tokens tiene cada usuario al cliente que dispara el push) — sería una mejora de diseño posible, no una migración 1:1.

### 3.3 `server/lib/` — compartido entre ambos
- `firebase_auth.php` (203 líneas): la pieza que Cloud Functions haría innecesaria casi entera (ver 3.1). Es la más grande de las dos utilidades.
- `rate_limiter.php` (78 líneas): la pieza que Cloud Functions **no** resuelve gratis — habría que reescribirla contra otro backend (Firestore/Redis), no simplemente "copiarla".

### 3.4 Resumen de la migración
| Componente PHP | ¿Se simplifica con Cloud Functions? | Motivo |
|---|---|---|
| Verificación manual de idToken (`firebase_auth.php`, usada por ambos) | **Sí, desaparece casi entera** | El runtime de `onCall` ya verifica el token con el Admin SDK real |
| Firma manual de JWT para OAuth2 (`fcm-send.php` paso 2) | **Sí, desaparece entera** | `firebase-admin` incluido en el runtime, sin gestión manual de credenciales |
| Rate limiting (`rate_limiter.php`, usado por ambos) | **No — hay que reescribirlo** | Cloud Functions no tiene rate-limiting nativo; el mecanismo de archivo local no es portable a un entorno multi-instancia/efímero |
| CORS manual | Parcial | `onCall` lo resuelve solo; `onRequest` sigue necesitando manejo, aunque con librerías |
| Llamada HTTP a Gemini (`curl` puro) | Sin cambio relevante | Se reemplaza `curl` por `fetch`/`axios` en Node, mismo nivel de trabajo |

---

## 4. `storage.rules` — ¿necesita cambios?

Contenido completo actual (`storage.rules:1-21`):

```
match /avatars/{userId} {
  allow read: if true;
  allow write: if request.auth != null
               && request.auth.uid == userId
               && request.resource.size < 5 * 1024 * 1024
               && request.resource.contentType.matches('image/.*');
}

match /company-logos/{companyId} {
  allow read: if true;
  allow write: if request.auth != null
               && request.resource.size < 5 * 1024 * 1024
               && request.resource.contentType.matches('image/.*');
}
```

**Para el uso actual (avatares/logos, ambos gateados en el código hoy), las reglas ya están completas y correctas** — límite de 5 MB e imágenes únicamente cubre exactamente lo que `uploadImage()`/`uploadAvatarIfNeeded()` necesitan.

**Si se retomaran las dos features pendientes identificadas en la sección 1, sí haría falta ampliar `storage.rules`:**

- **Adjuntos de chat (botón Paperclip, sección 1.2):** no hay ningún `match` para una ruta tipo `chat-attachments/{conversationId}/{fileId}` — habría que añadirlo desde cero, y decidir el control de acceso: a diferencia de avatares (públicos, cualquiera puede `read`), un adjunto de chat debería restringirse a los participantes de esa conversación — lo cual requiere que la regla de Storage pueda consultar el documento de Firestore de la conversación (`firestore.get(...)` dentro de una regla de Storage, posible pero más compleja que las reglas actuales, que no hacen ningún cross-service lookup). También el tipo de contenido tendría que ampliarse más allá de `image/.*` (PDFs, docs — típico de adjuntos tipo LinkedIn).
- **Audio de voz (si se revirtiera la decisión de retirarlo, sección 1.3):** necesitaría una ruta nueva (`voice-messages/{conversationId}/{messageId}` o similar) y `contentType.matches('audio/.*')` en vez de `image/.*` — el límite de tamaño probablemente debería ser distinto también (un audio de pocos segundos puede pesar más que una foto comprimida, pero no debería acercarse a 5 MB salvo grabaciones muy largas).

**Conclusión de esta sección:** las reglas actuales están bien para lo que ya existe cableado (avatares, logos) y no necesitan ningún cambio para simplemente "activar Blaze" — el cambio de reglas solo sería necesario si, además de activar Storage, se decide retomar adjuntos de chat o audio de voz.

---

## 5. Esfuerzo y riesgo real de cada cambio

### 5.1 Activar Storage (poner `VITE_FIREBASE_STORAGE_ENABLED=true`)
**Riesgo: BAJO.**
- El código ya está completo y probado contra el emulador (`firebaseService.ts:69-75` conecta el emulador de Storage en desarrollo; `uploadImage`/`uploadAvatarIfNeeded` ya existen y tienen fallback a base64 si algo falla).
- `storage.rules` ya está desplegable tal cual (`firebase.json:12-14` ya referencia `storage.rules`).
- El cambio real es una sola variable de entorno + activar Blaze en la consola de Firebase (fuera del código).
- Único trabajo real de verificación: confirmar que `getDownloadURL()` sirve CORS correctamente para que `shareCardService.ts` no caiga siempre al fallback sin avatar (sección 1.4) — trabajo de prueba, no de desarrollo.

### 5.2 Activar App Check
**Riesgo: BAJO-MEDIO.**
- Bajo porque es una feature de Firebase diseñada para añadirse de forma incremental (modo "monitor" antes de "enforce"), no requiere Blaze, y no toca el modelo de datos ni las reglas de Firestore existentes.
- Medio porque, a diferencia de Storage (donde el código gateado ya existe), **aquí no hay nada escrito** — hay que: (1) registrar la app en reCAPTCHA v3/Enterprise o App Attest, (2) inicializar el SDK en `src/main.tsx`/`firebaseService.ts` desde cero, (3) decidir si el modo "enforce" rompería alguna llamada existente que hoy no pasa por el flujo esperado (p. ej. los dos proxies PHP no son llamadas Firebase directas — App Check protege Firestore/Storage/llamadas al SDK, no a `gemini-proxy.php`/`fcm-send.php`, que ya tienen su propia verificación de idToken). Es trabajo nuevo de principio a fin, aunque acotado.

### 5.3 Migrar PHP → Cloud Functions
**Riesgo: MEDIO-ALTO.**
- Medio-alto porque, aunque partes se simplifican mucho (ver sección 3: la verificación manual de JWT y la firma manual de OAuth2 desaparecerían casi enteras), **el rate limiting no es una migración directa** — hay que rediseñarlo contra un backend distinto (Firestore/Redis), lo cual introduce costo real (lecturas/escrituras de Firestore por cada request a Gemini/push) que hoy el archivo local en `sys_get_temp_dir()` no tiene.
- Además implica: aprender/mantener un directorio `functions/` nuevo (hoy no existe ninguno — confirmado, `firebase.json` no tiene sección `functions`, no hay carpeta `functions/` en el repo), configurar despliegue (`firebase deploy --only functions`, con su propio ciclo de build/lint separado del frontend), y migrar el runbook de secretos (`server/config.php`, cuenta de servicio) al mecanismo de secretos de Cloud Functions (Secret Manager) — trabajo operativo no trivial que el PHP actual no necesita (vive en `config.php`, fuera de git, documentado en `PLAN_MEJORA_360.md` sección 1 como pendiente de runbook igualmente).
- Bajo relativo: el propio código PHP está bien escrito y ya documentado (`firebase_auth.php`/`rate_limiter.php` tienen comentarios de "HONESTIDAD" explicando sus límites) — no hay lógica de negocio oscura que migrar, solo mecánica.

### Tabla resumen
| Cambio | Riesgo | Motivo principal |
|---|---|---|
| Activar Storage | **Bajo** | Código ya escrito y gateado por una sola env var; reglas ya desplegables |
| Activar App Check | **Bajo-medio** | No requiere Blaze ni toca datos existentes, pero no hay nada construido — trabajo desde cero |
| Migrar PHP → Cloud Functions | **Medio-alto** | Simplifica JWT/OAuth2, pero el rate limiting hay que reconstruirlo con costo real; cero scaffolding de `functions/` existente hoy |

---

## Nota final
Todos los archivos y líneas citados en este documento se releyeron directamente en esta sesión (`firebaseService.ts`, `pushService.ts`, `useAppNotifications.ts`, `shareCardService.ts`, `ChatScreen.tsx`, `ScanScreen.tsx`, `InviteScreen.tsx`, `server/gemini-proxy.php`, `server/fcm-send.php`, `server/lib/firebase_auth.php`, `server/lib/rate_limiter.php`, `server/config.example.php`, `storage.rules`, `firestore.rules`, `firebase.json`, `.firebaserc`, `package.json`, `src/vite-env.d.ts`). No se citó ningún archivo sin abrirlo.
