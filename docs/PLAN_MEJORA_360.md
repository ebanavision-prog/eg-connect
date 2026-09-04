# EG CONNECT — Plan de Mejora Integral (360°)

**Fecha:** 2026-09-04 (actualizado el mismo día tras rescatar 2 worktrees huérfanas)
**Base:** auditoría completa del código (frontend + backend + reglas + infra), `main` en `1b0827a`.
**Alcance:** arquitectura, seguridad, datos, frontend, funcionalidades, operaciones. Cada punto está anclado a un archivo/línea real del repo, no es una recomendación genérica.

---

## 0.1 Actualización — worktrees huérfanas rescatadas e integradas

Las dos worktrees de agentes anteriores (`.claude/worktrees/agent-aa0e19eb...`, `agent-ac19ba...`) que en la auditoría original aparecían como "clutter sin mergear" **ya se revisaron, mergearon a `main` y se limpiaron**:

- **`agent-aa0e19eb` → merge `8c59232`** (7 commits): arregla exactamente varios de los hallazgos de este mismo plan antes de que se escribieran a mano — CRM con `crmStatus`/estadística fabricados por índice (sección 6.1, ahora con `updateContactStatus()` real en Firestore), botones muertos en Tenders/Companies/Profile, selector de emoji sin cablear en Chat, timestamp roto en Marketplace/Feed. Conflicto real en `ChatScreen.tsx` (dos features aditivas — push notifications de `main` y el emoji picker de la rama — en la misma zona del archivo) resuelto conservando ambas.
- **`agent-ac19ba` → merge `ce5c81f`** (5 commits): infraestructura real de `react-i18next` (es/en, fallback español duro, detección por navegador/localStorage) + traducción de `OnboardingScreen`, `App.tsx`, `HomeScreen` y `SyncSettingsScreen` con selector de idioma. Conflicto real en `SyncSettingsScreen.tsx` (la rama tradujo una versión del archivo anterior a las push notifications reales) resuelto a mano: se conservó toda la lógica de push de `main` y se añadieron claves i18n nuevas (`enableNotificationsDescConfigured/Basic`, `enablingButton`, `notificationsEnabledBodyReal/Basic`) para cubrir el texto condicional que la rama no contemplaba.

**Verificado:** `npm run lint` (typecheck) limpio, `npm run build` exitoso, y las 187 claves `t(...)` usadas en el código auditadas una por una contra `es.json`/`en.json` (sin ninguna faltante real). Ambas worktrees y sus ramas (`worktree-agent-aa0e19eb0904af075`, `worktree-agent-ac19ba366918cb82b`) se eliminaron tras el merge.

**Verificación en vivo (2026-09-04):** emulador real levantado (`npm run emulators`) — `npm run test:rules` pasó **44/44** aserciones contra el emulador (incluye la regla genérica de `users/{uid}/contacts/{contactId}` que cubre el nuevo `crmStatus` sin necesitar cambio de reglas, tal como razonaba el commit original). Dev server contra el emulador (`dev:emulator`) bootea limpio, sin errores de import/runtime. **Limitación honesta:** este entorno no tiene la extensión de Chrome conectada, así que no se pudo hacer un click-a-click visual real (probar el selector de idioma, el emoji picker, el modal de estado del CRM en pantalla). Queda como verificación manual pendiente para quien tenga el navegador a mano — el riesgo residual es bajo dado que typecheck+build+reglas ya cubren la superficie más probable de fallo.

Esto **reordena el roadmap** de la sección 7: los ítems de Fase 0 "CRM con datos fabricados" y "botones muertos de ProfileScreen" quedan resueltos; i18n pasa de "decisión pendiente" (Fase 3) a "infraestructura ya elegida y parcialmente ejecutada — falta completar cobertura" (ver sección 6 actualizada).

---

## 0. Diagnóstico en una frase

El producto está **funcionalmente completo y honesto** (casi nada finge hacer algo que no hace — patrón que se repite en todo el código: "sin esto, X no intenta nada"), pero está construido **sin red de seguridad de ingeniería**: cero CI/CD, cero tests de UI, tipado débil en los bordes, sin paginación, y dos vectores de abuso de costo reales sin mitigar. Es un MVP sólido en manos de un solo desarrollador; el riesgo no es "está mal hecho", es "no hay nada que avise cuando algo se rompa o alguien lo abuse".

---

## 1. Arquitectura e infraestructura

**Estado actual:** SPA React sobre Firebase Spark (gratis) + un shim PHP en cPanel para las dos cosas que normalmente serían Cloud Functions (Gemini, FCM send). Despliegue a producción sigue siendo manual (`firebase deploy` a mano) — eso no cambió y es una decisión, no un hallazgo.

| Hallazgo | Riesgo | Estado |
|---|---|---|
| ~~Cero GitHub Actions / CI~~ | Cualquier regresión llegaba directo a producción sin que nadie corriera `tsc --noEmit` ni `test:rules` antes de mergear | **RESUELTO** (merge `70aa4b5`, 2026-09-04): `.github/workflows/ci.yml` corre typecheck + build + `test:rules` contra emulador real en cada push/PR a `main` |
| ~~Sin staging real~~ | Todo se validaba contra emulador local o, en el peor caso, contra producción | **RESUELTO** (mismo merge): `npm run deploy:staging` + `docs/STAGING.md`. Pendiente de una primera prueba real por alguien con acceso al proyecto Firebase (ver sección 7) |
| Cuenta de servicio de FCM y `config.php` viven solo en el servidor cPanel, subidas a mano | Si se pierde el servidor o el archivo, no hay rotación documentada ni backup | **Sigue pendiente** — runbook de 1 página: dónde se genera cada secreto, cómo rotarlo, dónde vive la copia de emergencia (gestor de contraseñas, no el repo) |
| `firestore-debug.log` (100 KB) vive en la raíz del working tree | Ignorado en git (bien), pero crece sin límite localmente | **Sigue pendiente**, cosmético — `npm run clean` podría barrerlo también |

---

## 2. Seguridad

Esta es la parte mejor construida del proyecto (`firestore.rules` con 44 aserciones reales contra emulador, verificación JWT hecha a mano en `fcm-send.php`). Había dos agujeros de **abuso de costo/cuota** — **ambos cerrados el 2026-09-04** (merge `e81f4d8`, ver 0.1):

1. ~~**`server/gemini-proxy.php` no verifica identidad, solo `Origin`.**~~ — **RESUELTO.** Ahora exige el mismo `idToken` real de Firebase Auth que ya usaba `fcm-send.php`, vía `server/lib/firebase_auth.php` (extraído de `fcm-send.php` sin cambiar su lógica interna, para no duplicar la verificación RS256/JWK hecha a mano).
2. ~~**Sin rate limiting en ningún endpoint PHP.**~~ — **RESUELTO.** `server/lib/rate_limiter.php`: ventana deslizante por uid, sin dependencias externas (archivo en `sys_get_temp_dir()`, mismo patrón ya usado para la caché de JWKS). 20 req/min en Gemini, 30 req/min en push. Falla abierto (deja pasar) si no puede escribir su archivo de control — decisión documentada a propósito: es una defensa anti-abuso, no una garantía de SLA.

Otros puntos, menor severidad:
- **Sin Firebase App Check.** Las reglas de Firestore protegen los *datos*, no el *presupuesto* — un script fuera de la app podría seguir golpeando Firestore directamente dentro de lo que las reglas permiten (p. ej. leer `users` completo, que es `list` abierto a cualquier signed-in). App Check es gratis y cierra ese flanco.
- **OAuth de Google pide `contacts.readonly`** (`firebaseService.ts:192`) — scope sensible. Si la app crece, Google exigirá pantalla de verificación OAuth; vale la pena documentar esto ahora, no cuando bloquee un lanzamiento.
- **`list` abierto en `/users/{userId}`** (regla línea 47) confía en que el cliente oculte `privacyMode === 'private'` — cualquiera con las reglas podría leer perfiles marcados privados directamente contra la API REST de Firestore. Es una promesa de UI, no una garantía de seguridad. Si "privado" debe ser privado de verdad, hay que moverlo a nivel de regla (no trivial con `list`, pero al menos documentarlo como limitación conocida y comunicárselo a los usuarios).

---

## 3. Modelo de datos / Firestore

- **Duplicación de "empresa"**: un usuario tipo `company` guarda campos de empresa (`employees`, `website`, `yearsInMarket`) directamente en `users/{uid}` (ver reglas línea 52), pero *además* existe una colección `companies` separada con su propio `ownerId`, registrada por un flujo de 3 pasos en `CompaniesScreen`. Son dos representaciones de "soy una empresa" que pueden desincronizarse (editas tu perfil de empresa en `ProfileScreen` y el `companies` doc no se entera, o viceversa). **Recomendación:** decidir una fuente de verdad única — probablemente `companies` como entidad canónica, y que el perfil de usuario solo referencie `companyId`.
- **Sin paginación en ningún lado.** `getAllUsers(100)` es un límite fijo cargado una vez al arrancar; `CompaniesScreen`, `MarketplaceScreen`, `TendersScreen`, `InitiativesScreen` traen la colección entera con `useFirestoreCollection` sin `limit()`. Con 50 usuarios no se nota; con 2.000, cada carga de Marketplace lee 2.000 documentos y el coste de Firestore escala con el crecimiento que la propia app está diseñada para generar (referidos, viral loop). **Recomendación:** `limit()` + scroll infinito o paginación con cursor (`startAfter`) antes de que esto se sienta.
- **Índices auditados a medias.** Solo 2 índices compuestos declarados (`conversations`, `marketplace_posts`) en `firestore.indexes.json`, pero hay queries con `where` + `orderBy` combinados en `useAppNotifications` (tenders), `InviteScreen` (referidos) y otros — cualquiera que no tenga ya un índice de campo único automático fallará en producción con un error de "requiere índice" que solo se ve en la consola de Firebase, no en desarrollo local si el emulador no lo exige igual. **Recomendación:** correr la app contra el emulador con reglas estrictas y capturar cualquier error de índice antes de cada despliegue grande.
- **Sin borrado de cuenta ni exportación de datos.** El botón "Descargar Mis Datos CSV" en `ProfileScreen` es un stub sin `onClick`. Para una app con datos personales reales (cumpleaños, teléfono, ubicación GPS), no tener una vía de exportación/borrado es una deuda de privacidad, no solo una feature pendiente.
- **Sin soft-delete/auditoría.** `deleteTender`, borrar contactos, etc. son borrados duros — no hay forma de recuperar ni de auditar quién borró qué.

---

## 4. Backend PHP

- Bien razonado para lo que es (JWT verification a mano, JWK→PEM manual, todo documentado), pero **sin ningún test automatizado** — a diferencia del frontend (que sí tiene `firestoreRules.test.ts`), un cambio en `fcm-send.php` o `gemini-proxy.php` no tiene ninguna red antes de llegar a producción.
- **Sin logging/observabilidad.** Si `fcm-send.php` empieza a fallar silenciosamente (p. ej. la cuenta de servicio expira), no hay ninguna alerta — el primer síntoma sería "los usuarios dejaron de recibir push" reportado a mano.
- Código duplicado entre los dos archivos PHP (CORS/origin check, `base64url_decode`) — extraer a un `server/lib/` compartido reduce el área de mantenimiento.

---

## 5. Frontend: arquitectura y calidad de código

- **Prop drilling extremo desde `App.tsx` (752 líneas).** `profileData`, `realUsers`, `startChat`, `handleNavClick` se pasan a mano por cada pantalla. Funciona a esta escala, pero cada pantalla nueva añade otra fila de props que `App.tsx` tiene que conocer. **Recomendación:** un store ligero (Zustand, ~1KB) o Context+reducer para `currentUser`/`realUsers`/`notifications` — no hace falta Redux, sí hace falta dejar de threadear todo por props.
- **`any` por todas partes en los bordes.** `profileData: any`, `users: any[]`, `realUsers: any[]` aparecen en casi cada componente, a pesar de que `types.ts` ya define tipos razonables (`Contact`, `Company`, `Conversation`...). El tipo `User`/`UserProfile` ni siquiera existe como interfaz propia — se pasa el resultado crudo de Firestore. **Recomendación:** definir `UserProfile` en `types.ts` y tipar los props de las ~20 pantallas que hoy reciben `any`. Esto habría atrapado en compilación varios de los bugs que ya se arreglaron a mano en sesiones anteriores (el badge de no leídos en 0, `unreadMessageCount` hardcodeado, etc. — todos eran del tipo "el dato correcto existía pero el tipo no lo exigía usar").
- **Componentes gigantes.** `CompaniesScreen.tsx` (918 líneas), `App.tsx` (752), `ProfileScreen.tsx` (777), `OnboardingScreen.tsx` (711), `MarketplaceScreen.tsx` (747) concentran demasiada responsabilidad: formularios multi-paso, modales, listas y lógica de negocio en un solo archivo. **Recomendación concreta:** extraer el wizard de registro de empresa (`CompaniesScreen` pasos 1-3) y el sidebar de navegación (`App.tsx`) a sus propios componentes — son las dos extracciones de mayor retorno inmediato.
- **Cero tests de frontend.** Ni unitarios ni de componentes ni E2E. La única suite real es `firestoreRules.test.ts`. Para los flujos críticos (login, enviar mensaje, guardar contacto, publicar anuncio) esto significa que cada cambio se verifica a mano contra el emulador — lo cual ya haces bien por disciplina, pero no escala si alguna vez hay más de una persona tocando el código.
- **Accesibilidad desigual.** Algunos botones tienen `aria-label` (`MapScreen`), la inmensa mayoría de botones-icono en el resto de pantallas no. Barato de arreglar, alto impacto para usuarios con lector de pantalla.
- **i18n abandonado a medias.** Hay trabajo real de internacionalización (`src/i18n/en.json`, `es.json`, `index.ts`) atrapado en una de las worktrees huérfanas (`.claude/worktrees/agent-ac19ba366918cb82b`) que nunca llegó a `main`. Guinea Ecuatorial es oficialmente hispanófona pero con fuerte presencia de francés/portugués/inglés en el sector privado (petróleo, ONGs) — vale la pena una decisión consciente: ¿se rescata ese trabajo o se descarta a propósito?

---

## 6. Funcionalidades: lo que falta o está fingido

Priorizado por impacto real en el usuario, no por tamaño del cambio:

1. ~~**CRM con datos inventados**~~ — **RESUELTO** (rescatado de `agent-aa0e19eb`, ver 0.1): `crmStatus` ahora es un campo real persistido vía `updateContactStatus()`, editable desde el modal de detalle del contacto; el stat "Socios y Aliados" se calcula sobre datos reales, ya no un `+4` fijo.
2. **Mensajes de voz no graban audio real** (`ChatScreen.tsx`): hay un timer y una UI completa de grabación, pero nunca se usa `MediaRecorder` — se guarda `audioUrl: '#'` con solo la duración. El otro participante "reproduce" un mensaje que no existe. **Sigue pendiente.**
3. ~~**Botones muertos en `ProfileScreen`**~~ — **RESUELTO** (rescatado de `agent-aa0e19eb`): exportar CSV y "Panel de Control" ya tienen comportamiento real; también se corrigieron 3 botones muertos más en Tenders (Más Detalles/Download) y Companies (Filter), y el timestamp roto en Marketplace/Feed.
4. **Unificación de "empresa"** (ver sección 3) — impacto directo en confiabilidad de datos que se muestran en Marketplace/Companies. **Sigue pendiente**, no tocado por las worktrees rescatadas.
5. **Paginación** antes de que el crecimiento (que el propio sistema de referidos busca provocar) vuelva la app lenta y cara. **Sigue pendiente.**
6. **i18n — infraestructura lista, cobertura parcial** (rescatado de `agent-ac19ba`, ver 0.1): `react-i18next` real con es/en, selector de idioma funcional en `SyncSettingsScreen`. Traducidas: `OnboardingScreen`, `App.tsx`, `HomeScreen`, `SyncSettingsScreen` (4 de ~22 pantallas). **Queda traducir las ~18 restantes** — trabajo mecánico pero real, ver Fase 1 del roadmap.

---

## 7. Roadmap propuesto

### Fase 0 — Higiene inmediata (bajo riesgo, alto retorno, ~1 sesión)
- ~~Decidir y ejecutar sobre las worktrees huérfanas~~ — **hecho** (ver 0.1): ambas rescatadas, mergeadas (`8c59232`, `ce5c81f`) y eliminadas
- ~~Arreglar botones muertos de `ProfileScreen`~~ — **hecho**, vía el rescate
- ~~Reemplazar datos fabricados del CRM~~ — **hecho**, vía el rescate
- ~~Cerrar el agujero de `gemini-proxy.php` + rate limiting básico en ambos endpoints PHP~~ — **hecho** (merge `e81f4d8`, 2026-09-04): `server/lib/firebase_auth.php` extraído sin cambio de comportamiento, `gemini-proxy.php` ahora exige idToken real, rate limiting por uid (20/min Gemini, 30/min push) con ventana deslizante en `server/lib/rate_limiter.php`. `aiService.ts` actualizado para mandar el idToken. `npm run lint` limpio. **Pendiente real:** no se pudo correr `php -l` en este entorno (sin binario PHP) — el agente verificó balance de llaves a mano; conviene un `php -l` real la primera vez que esto se suba al servidor cPanel.
- ~~Verificación en vivo contra el emulador de los dos merges~~ — **hecho**: reglas 44/44 contra emulador real + dev server booteando limpio; falta solo el click-a-click visual (sin extensión de Chrome disponible en este entorno)

### Fase 1 — Fundamentos de ingeniería (2-4 sesiones)
- ~~CI en GitHub Actions: typecheck + `test:rules` en cada push~~ — **hecho** (merge `70aa4b5`, 2026-09-04): `.github/workflows/ci.yml`, 3 jobs (typecheck/build/rules-tests), ensayado dos veces contra emulador real (38/38 ambas)
- ~~Canal de staging en Firebase Hosting~~ — **hecho**: script `npm run deploy:staging` + `docs/STAGING.md`. **Pendiente real:** no se pudo probar un deploy real porque la cuenta de Firebase CLI de este entorno no tiene acceso al proyecto `gen-lang-client-0951010679` — falta que alguien con acceso real lo confirme una vez
- Tipar `UserProfile` y eliminar los `any` más críticos (props de pantallas top-level) — **en curso**
- Extraer store ligero (Zustand/Context) para `currentUser`/`realUsers`/`notifications` — **en curso, alcance inicial limitado a App.tsx a propósito**
- Completar cobertura de i18n en las ~18 pantallas restantes (infraestructura ya lista, ver sección 6.6) — **pendiente, bloqueado hasta que cierre el tipado (evitar conflicto masivo de merge)**

### Fase 2 — Integridad de datos y privacidad
- Unificar el modelo de empresa (`users` vs `companies`)
- Paginación real en Companies/Marketplace/Tenders/Initiatives
- Auditoría de índices Firestore contra queries reales
- Exportación de datos + borrado de cuenta real (cumplimiento mínimo de privacidad)

### Fase 3 — Funcionalidades y crecimiento
- Grabación de audio real (o retirar la feature si no se prioriza)
- Descomposición de los 5 componentes más grandes
- Pase de accesibilidad (aria-labels, foco, contraste)

### Fase 4 — Escala (cuando el volumen lo justifique, no antes)
- Evaluar activar Blaze: Storage real, App Check, posible migración de PHP→Cloud Functions
- Observabilidad real (logs agregados, alertas de cuota/errores)

---

## Nota de alcance
Este plan no incluye nada que contradiga las decisiones deliberadas ya tomadas en el código (sin Blaze, sin Cloud Functions, single-tab Firestore, sin cámara en vivo en el escáner) — esas son decisiones de costo/negocio documentadas y razonadas, no deuda técnica. Lo que sí se señala es dónde esas mismas decisiones necesitan un refuerzo (rate limiting, idToken en el proxy de Gemini) para seguir siendo seguras a medida que crece el uso real.
