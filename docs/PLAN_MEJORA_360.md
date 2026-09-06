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
- ~~**Sin paginación en ningún lado.**~~ — **RESUELTO** (merge `82019f1`, 2026-09-04): `CompaniesScreen`/`MarketplaceScreen`/`TendersScreen`/`InitiativesScreen` ahora usan `orderBy('createdAt','desc') + limit(pageSize)` creciente (20, +20 por "Cargar más"), manteniendo el realtime de `onSnapshot`. Verificado en vivo contra emulador con 25 docs sembrados (páginas sin salto/repetición/reorden). Aviso honesto de "búsqueda limitada" cuando hay término de búsqueda activo y se llegó al límite de página. `getAllUsers(100)` (usuarios en `App.tsx`) queda igual por ahora — no estaba en el alcance de este ítem.
- ~~**Índices auditados a medias.**~~ — **RESUELTO** (2026-09-04): auditadas TODAS las queries `where()`/`orderBy()` reales del código contra `firestore.indexes.json`. Resultado: ninguna query actual necesita un índice que no tenga ya — Firestore cubre automáticamente filtros de solo igualdad (por muchos campos que sean) y un único `orderBy`; el único caso que sí exige índice compuesto (`conversations`: `participants` array-contains + `lastMessageAt` orderBy) ya lo tenía. Se encontró y eliminó un índice **muerto** (`marketplace_posts`: `type`+`createdAt`) que no correspondía a ninguna query real — Marketplace/SearchResults traen la colección entera y filtran en el cliente.
- ~~**Sin borrado de cuenta ni exportación de datos.**~~ — **RESUELTO** (merge `8e60ec0`, 2026-09-04): `exportAllUserData()` (perfil+contactos+notas+tareas a JSON) y `deleteAccount()` (Firestore primero, Auth al final, idempotente, honesto sobre `auth/requires-recent-login`) en `firebaseService.ts`; nueva regla `allow delete: if isOwner(userId)`; modal de confirmación real (escribir palabra de confirmación) en `ProfileScreen`. 46/46 tests de reglas.
- **Sin soft-delete/auditoría.** `deleteTender`, borrar contactos, etc. son borrados duros — no hay forma de recuperar ni de auditar quién borró qué.

---

## 4. Backend PHP

- Bien razonado para lo que es (JWT verification a mano, JWK→PEM manual, todo documentado), pero **sin ningún test automatizado** — a diferencia del frontend (que sí tiene `firestoreRules.test.ts`), un cambio en `fcm-send.php` o `gemini-proxy.php` no tiene ninguna red antes de llegar a producción.
- **Sin logging/observabilidad.** Si `fcm-send.php` empieza a fallar silenciosamente (p. ej. la cuenta de servicio expira), no hay ninguna alerta — el primer síntoma sería "los usuarios dejaron de recibir push" reportado a mano.
- Código duplicado entre los dos archivos PHP (CORS/origin check, `base64url_decode`) — extraer a un `server/lib/` compartido reduce el área de mantenimiento.

---

## 5. Frontend: arquitectura y calidad de código

- ~~**Prop drilling extremo desde `App.tsx`.**~~ — **PARCIALMENTE RESUELTO** (merge `bbe4f38`, 2026-09-04): store Zustand (`src/store/useAppStore.ts`) para `currentUserProfile`/`realUsers`, adopción inicial en App.tsx. **Sigue pendiente (Fase 1.5):** migrar las ~14 pantallas hijas para leer del store directamente en vez de por props — hoy siguen recibiendo `profileData`/`realUsers` exactamente igual que antes, solo cambió dónde vive el estado en App.tsx.
- ~~**`any` por todas partes en los bordes.**~~ — **RESUELTO** (mismo merge): `UserProfile` real en `types.ts`, derivado de grep exhaustivo + whitelist de `firestore.rules`, tipado en App.tsx y 14 pantallas. De paso salieron a la luz (y se dejaron señalados, sin tocar, para no mezclar fix con refactor) dos bugs preexistentes de `uid`/`id` en `MapScreen`/`DiscoverScreen`.
- **Componentes gigantes.** `CompaniesScreen.tsx` (918 líneas), `App.tsx` (752), `ProfileScreen.tsx` (777), `OnboardingScreen.tsx` (711), `MarketplaceScreen.tsx` (747) concentran demasiada responsabilidad: formularios multi-paso, modales, listas y lógica de negocio en un solo archivo. **Sigue pendiente.** **Recomendación concreta:** extraer el wizard de registro de empresa (`CompaniesScreen` pasos 1-3) y el sidebar de navegación (`App.tsx`) a sus propios componentes — son las dos extracciones de mayor retorno inmediato.
- **Cero tests de frontend.** Ni unitarios ni de componentes ni E2E. La única suite real es `firestoreRules.test.ts`. **Sigue pendiente.**
- **Accesibilidad desigual.** Algunos botones tienen `aria-label` (`MapScreen`), la inmensa mayoría de botones-icono en el resto de pantallas no. **Sigue pendiente.**
- ~~**i18n abandonado a medias.**~~ — **RESUELTO POR COMPLETO** (merges `ce5c81f`, `4b2776c`, `+ merge final 2026-09-04`): **21/21 pantallas traducidas** a react-i18next (es/en), 26 namespaces, 774 claves reales — todas verificadas cruzadas contra ambos idiomas (incluyendo las pluralizadas `_one`/`_other`), cero faltantes.

---

## 6. Funcionalidades: lo que falta o está fingido

Priorizado por impacto real en el usuario, no por tamaño del cambio:

1. ~~**CRM con datos inventados**~~ — **RESUELTO** (rescatado de `agent-aa0e19eb`, ver 0.1): `crmStatus` ahora es un campo real persistido vía `updateContactStatus()`, editable desde el modal de detalle del contacto; el stat "Socios y Aliados" se calcula sobre datos reales, ya no un `+4` fijo.
2. **Mensajes de voz no graban audio real** (`ChatScreen.tsx`): hay un timer y una UI completa de grabación, pero nunca se usa `MediaRecorder` — se guarda `audioUrl: '#'` con solo la duración. El otro participante "reproduce" un mensaje que no existe. **Sigue pendiente.**
3. ~~**Botones muertos en `ProfileScreen`**~~ — **RESUELTO** (rescatado de `agent-aa0e19eb`): exportar CSV y "Panel de Control" ya tienen comportamiento real; también se corrigieron 3 botones muertos más en Tenders (Más Detalles/Download) y Companies (Filter), y el timestamp roto en Marketplace/Feed.
4. **Unificación de "empresa"** (ver sección 3) — impacto directo en confiabilidad de datos que se muestran en Marketplace/Companies. **Sigue pendiente**, no tocado por las worktrees rescatadas.
5. **Paginación** antes de que el crecimiento (que el propio sistema de referidos busca provocar) vuelva la app lenta y cara. **Sigue pendiente.**
6. ~~**i18n — cobertura parcial**~~ — **RESUELTO POR COMPLETO** (2026-09-04): las 22 pantallas de la app traducidas a `react-i18next` (es/en), selector de idioma funcional en `SyncSettingsScreen`, 774 claves reales sin faltantes en ningún idioma.

---

## 7. Roadmap propuesto

### Fase 0 — Higiene inmediata (bajo riesgo, alto retorno, ~1 sesión)
- ~~Decidir y ejecutar sobre las worktrees huérfanas~~ — **hecho** (ver 0.1): ambas rescatadas, mergeadas (`8c59232`, `ce5c81f`) y eliminadas
- ~~Arreglar botones muertos de `ProfileScreen`~~ — **hecho**, vía el rescate
- ~~Reemplazar datos fabricados del CRM~~ — **hecho**, vía el rescate
- ~~Cerrar el agujero de `gemini-proxy.php` + rate limiting básico en ambos endpoints PHP~~ — **hecho** (merge `e81f4d8`, 2026-09-04): `server/lib/firebase_auth.php` extraído sin cambio de comportamiento, `gemini-proxy.php` ahora exige idToken real, rate limiting por uid (20/min Gemini, 30/min push) con ventana deslizante en `server/lib/rate_limiter.php`. `aiService.ts` actualizado para mandar el idToken. `npm run lint` limpio. **Pendiente real, no aplica todavía (verificado 2026-09-05):** `ebanavision.com/api/gemini-proxy.php` responde 404 — el archivo aún no está subido al hosting cPanel real, así que no hay nada que lintear todavía. Cuando se suba el sitio de verdad, correr `php -l` ahí (con SSH/Terminal de cPanel si el plan lo tiene) antes de darlo por bueno.
- ~~Verificación en vivo contra el emulador de los dos merges~~ — **hecho**: reglas 44/44 contra emulador real + dev server booteando limpio. Click-a-click visual completado más tarde (ver sección "2026-09-05/06 — puesta en producción real" más abajo): selector de idioma ES/EN y navegación por sidebar confirmados en vivo contra producción con Playwright + Chrome real.

### Fase 1 — Fundamentos de ingeniería (2-4 sesiones)
- ~~CI en GitHub Actions: typecheck + `test:rules` en cada push~~ — **hecho** (merge `70aa4b5`, 2026-09-04): `.github/workflows/ci.yml`, 3 jobs (typecheck/build/rules-tests), ensayado dos veces contra emulador real (38/38 ambas)
- ~~Canal de staging en Firebase Hosting~~ — **hecho y confirmado en vivo** (2026-09-05): `npm run deploy:staging` corrido de verdad contra `gen-lang-client-0951010679` (cuenta correcta: `hechhosni73@gmail.com`, no `ebanavision@gmail.com` — esta última no tiene rol IAM en el proyecto). Canal `staging` creado, deploy completo, URL real respondiendo 200: https://gen-lang-client-0951010679--staging-e9emdg8x.web.app (expira 2026-10-05, se regenera con el mismo comando cuando haga falta).
- ~~Tipar `UserProfile` y eliminar los `any` más críticos~~ — **hecho** (merge `bbe4f38`, 2026-09-04): interfaz derivada de grep exhaustivo + whitelist de `firestore.rules`, tipada en App.tsx y 14 pantallas. Cero cambio de comportamiento — dos bugs preexistentes de uid/id (MapScreen/DiscoverScreen) quedaron señalados en el reporte del agente, deliberadamente sin tocar
- ~~Extraer store ligero (Zustand/Context)~~ — **hecho** (mismo merge): `src/store/useAppStore.ts`, adopción inicial limitada a App.tsx a propósito. **Fase 1.5 pendiente:** migrar las pantallas hijas para leer del store directamente en vez de por props
- ~~Completar cobertura de i18n~~ — **hecho, 21/21 pantallas** (2026-09-04): 16 mergeadas (`4b2776c`) + 5 finales (ProfileScreen, InviteScreen, MarketplaceScreen, CompaniesScreen, CompanyProfileModal) mergeadas sin conflictos. **Fase 1 completa en su totalidad.**

### Fase 2 — Integridad de datos y privacidad
- ~~Unificar el modelo de empresa (`users` vs `companies`)~~ — **hecho** (2026-09-04, merge `5aee0ab`, rescatado de la worktree huérfana `agent-a56997c9fe3a4df04`): `UserProfile.companyId` enlaza a `companies/{companyId}` (entidad canónica); `CompaniesScreen`/`ProfileScreen` enlazan hacia adelante en el momento de registrar/marcar empresa; `scripts/migrate-company-model.mjs` hace backfill idempotente para perfiles `profileType='company'` creados antes del cambio (dry-run por defecto, nunca corre solo contra producción — ver `docs/MIGRACION_EMPRESA.md`). Verificado: `tsc`/build limpios, `test:rules` 49/49 contra emulador real. **Resuelto de otra forma (2026-09-05)**: dry-run contra producción real mostró un único caso ("Ebana Vision Estudio", industria por defecto "Servicios" por no tener el campo relleno) — el usuario decidió no migrarlo y en cambio **borrar por completo los 2 usuarios reales de producción** (Firestore + Firebase Auth, ambos del propio usuario) para arrancar de cero durante esta fase de prueba. Producción quedó en 0 usuarios/0 de cualquier colección; la migración de backfill ya no hace falta porque el código enlaza `companyId` correctamente desde el primer registro. El script queda documentado y listo por si algún día hace falta (nuevo backfill sobre datos futuros).
- ~~Paginación real en Companies/Marketplace/Tenders/Initiatives~~ — **hecho** (2026-09-04, merge `82019f1`)
- ~~Auditoría de índices Firestore contra queries reales~~ — **hecho** (2026-09-04): sin índices faltantes, uno muerto eliminado (`marketplace_posts`)
- ~~Exportación de datos + borrado de cuenta real~~ — **hecho** (2026-09-04, merge `8e60ec0`)

**Fase 2 completa en su totalidad** (salvo la corrida real de la migración de backfill en producción, que requiere credenciales humanas — ver arriba).

### Fase 3 — Funcionalidades y crecimiento
- ~~Mensajes de voz reales~~ — **decisión: retirar la feature (confirmado por el usuario 2026-09-05), hecho (commit `f022fe1`).** `MediaRecorder`/Storage real exigía activar Blaze (apagado a propósito en este proyecto — ver `firebaseService.ts:400-408`) y base64-en-Firestore no era viable para audio. `ChatScreen.tsx` ahora sigue el patrón tipo LinkedIn: un único botón de enviar, deshabilitado sin texto, sin grabación de voz. Mensajes históricos `type='audio'` (si existiera alguno en producción) ya no muestran el reproductor falso, sino un texto honesto de "ya no disponible". Se retoma solo si Fase 4 activa Blaze de verdad. Verificado: `tsc`/build limpios, `test:rules` 49/49.
- ~~Descomposición de los 2 componentes de mayor retorno~~ — **hecho** (2026-09-05, merges `5f2cd57`/`4046c3b`): wizard de registro de empresa extraído de `CompaniesScreen.tsx` (1047→521 líneas) a `CompanyRegistrationWizard.tsx`; sidebar de navegación extraído de `App.tsx` (752→~470 líneas) a `AppSidebar.tsx`. Cero cambio de comportamiento, verificado (`tsc`/build limpios, `test:rules` 49/49). **Sigue pendiente**: los otros 3 componentes grandes que el diagnóstico original señaló (`ProfileScreen.tsx` 777, `OnboardingScreen.tsx` 711, `MarketplaceScreen.tsx` 747) — no tocados todavía.
- ~~Pase de accesibilidad (aria-labels, foco, contraste)~~ — **hecho** (2026-09-05, merge `60905f7`): ~50 botones-icono + 2 toggles sin nombre accesible en 19 pantallas reciben `aria-label`/`role="switch"`, siguiendo el patrón ya usado en `MapScreen.tsx`; 28 claves `*Aria` nuevas en `es.json`/`en.json` (874 claves, 1:1). Foco visible vía 2 utilidades Tailwind nuevas (`.focus-ring-custom`/`.focus-ring-inverse`) en `src/index.css`. Contraste revisado, sin hallazgos que corregir. Verificado igual (`tsc`/build/`test:rules` 49/49).

### Fase 4 — Escala (cuando el volumen lo justifique, no antes)
- ~~Evaluar activar Blaze~~ — **evaluación hecha, decisión: NO activar por ahora (confirmado por el usuario 2026-09-05).** Investigación completa en `docs/EVALUACION_BLAZE_2026-09-05.md` (qué cambia en el código) y `docs/EVALUACION_BLAZE_COSTOS_2026-09-05.md` (costo real con pricing verificado: ~$0/mes hasta 500 usuarios activos, ~$55-65/mes en 2.000, ~$150/mes en 5.000 — dominado casi todo por egreso de fotos de Storage sin cache, no por Firestore/Functions). **Decisión explícita del usuario: cero gasto en esta fase de prueba, sin importar cuántas features queden limitadas por seguir en Spark — se revisa solo si el volumen real de usuarios lo justifica más adelante.** No activar Storage/Blaze, no migrar PHP→Cloud Functions, hasta nueva decisión explícita. App Check sigue siendo una opción de costo $0 en cualquier momento (no depende de Blaze) si se quiere retomar por separado.
- Observabilidad real (logs agregados, alertas de cuota/errores)

**Hallazgo colateral pendiente, gratis, no depende de esta decisión:** los avatares se guardan hoy como base64 dentro del documento Firestore (mientras Storage está apagado) — un documento tiene un límite duro de 1 MiB, y una foto de cámara sin comprimir (2-8 MB típico) puede hacer fallar el guardado. Arreglarlo (comprimir/redimensionar la imagen en el cliente antes de guardarla) no cuesta nada y no depende de Blaze — sigue pendiente, no tocado en esta sesión.

---

## Nota de alcance
Este plan no incluye nada que contradiga las decisiones deliberadas ya tomadas en el código (sin Blaze, sin Cloud Functions, single-tab Firestore, sin cámara en vivo en el escáner) — esas son decisiones de costo/negocio documentadas y razonadas, no deuda técnica. Lo que sí se señala es dónde esas mismas decisiones necesitan un refuerzo (rate limiting, idToken en el proxy de Gemini) para seguir siendo seguras a medida que crece el uso real.

---

## 2026-09-05/06 — puesta en producción real, para compartir con los primeros usuarios

Objetivo del usuario: tener una versión mínimamente usable y compartible para arrancar con los primeros ~50 usuarios. Esto destapó una brecha operativa real que el trabajo de código por sí solo no mostraba: **el canal `live` de Firebase Hosting no se redeployaba desde el 19 de agosto** — todo lo de Fase 0-3 vivía en el repo pero nunca había llegado al link que un usuario real vería.

**Hallazgos y arreglos reales, en el orden en que aparecieron probando en vivo contra producción con Playwright + Chrome real (no solo el emulador):**

1. **Deploy real a `live`** — `npm run build` + `firebase deploy --only hosting`, con la cuenta correcta (`hechhosni73@gmail.com`; `ebanavision@gmail.com` no tiene ningún rol IAM en `gen-lang-client-0951010679` pese a poder generar claves de servicio desde la consola web con otra sesión — no confundir ambas cuentas en sesiones futuras).
2. **Registro totalmente roto**: `auth/operation-not-allowed` — el proveedor Email/Password nunca se había agregado en Firebase Authentication (solo Google estaba habilitado). Sin esto, cero usuarios nuevos podían entrar. Agregado por el usuario en la consola.
3. **Bug real encontrado en vivo, no documentado hasta ahora**: `OnboardingScreen.tsx` (el registro inicial — el punto de entrada real para casi todos los usuarios nuevos) nunca llamaba a `createCompany`/enlazaba `companyId`, a diferencia de `CompaniesScreen`/`ProfileScreen` (arreglados en Fase 2). Una empresa registrada desde el alta inicial quedaba invisible en el directorio de Companies. Arreglado (mismo patrón que Fase 2: helper `linkCompanyIfNeeded` en `OnboardingScreen.tsx`, ambos caminos de registro — usuario/contraseña nuevo y perfil completado tras login con Google).
4. **Bug sistémico real, más profundo, encontrado al probar el fix anterior**: `saveUserData()` (`firebaseService.ts`) regeneraba `createdAt` con un timestamp nuevo en **cualquier** guardado parcial (no solo en la creación real), y como `createdAt` no está en la whitelist de campos actualizables de `firestore.rules`, esa escritura quedaba rechazada con "Missing or insufficient permissions". Esto ya afectaba silenciosamente al enlace de `companyId` de `CompaniesScreen.tsx` shippeado en Fase 2 (el try/catch lo tragaba en consola, sin bloquear el flujo principal — nadie lo había notado). Arreglado en la raíz: `createdAt` solo se incluye en el payload si el llamador lo pasa explícitamente.
5. **Brecha de despliegue separada, encontrada al verificar el fix anterior**: `firestore.rules` en producción estaba desactualizado — `firebase deploy --only hosting` nunca toca las reglas. La whitelist con `companyId` (Fase 2) vivía en el repo y pasaba 49/49 en el emulador, pero nunca se había desplegado de verdad. **Lección operativa real: cualquier cambio a `firestore.rules` necesita su propio `firebase deploy --only firestore:rules` — pasar las pruebas del emulador no implica que producción tenga la misma regla.**

**Verificado end-to-end en producción real** (no solo emulador): proveedor Email/Password + registro individual y empresa + `companyId` real enlazado + la empresa aparece en el directorio de Companies + selector de idioma ES/EN + navegación por sidebar — todo con 0 errores de consola en la corrida final.

**Limpieza:** se generaron y usaron 2 claves de cuenta de servicio temporales (una para la migración/reseteo de producción, otra para limpiar ~6 cuentas de prueba `smoketest*` creadas durante esta verificación) — ambas borradas del disco local inmediatamente después de usarse, siguiendo el mismo patrón de higiene de credenciales establecido en la sesión anterior (ver `docs/MIGRACION_EMPRESA.md`). Producción quedó en 0 usuarios/0 empresas otra vez, lista para los primeros usuarios reales.

Dominio custom y compresión de imágenes: ambos resueltos, ver secciones siguientes.

---

## 2026-09-06 — 4 mejoras de crecimiento (fase de pruebas → primeros usuarios reales)

Con la app ya en producción real, el foco pasó a lo que hace falta para que compartir el link (y que la red realmente crezca) funcione bien. Se auditó primero qué mecánica de crecimiento ya existía de verdad (link de invitación con `?ref=<uid>` real, tracking de `referredBy`, insignia de Embajador a 5 referidos, compartir por WhatsApp/share nativo, tarjeta QR de marca, push real en segundo plano vía `public/sw.js`) — el motor ya estaba construido; lo que faltaba eran 4 huecos concretos.

1. **Open Graph / Twitter Card tags** (`index.html`) — no existía ninguno; un link de invitación pegado en WhatsApp se veía como texto plano sin preview. Agregadas las etiquetas está­ticas apuntando a `https://connect.ebanavision.com` (URL fija, no `window.location.origin`, porque estas etiquetas las lee el bot de WhatsApp/Facebook antes de que corra el JS de la SPA) usando `icon-512.png` como imagen.

2. **Panel de Crecimiento** (`src/components/GrowthAnalyticsScreen.tsx`, nuevo) — antes no había ninguna forma de ver cuántos usuarios reales hay, cuántos entraron esta semana, ni quién trae más gente sin consultar Firestore a mano. Nuevo panel de solo lectura, gateado a `isAdmin` en el sidebar (mismo patrón ya usado en `CompaniesScreen.tsx`/`TendersScreen.tsx` — oculto en la UI, no una regla de Firestore nueva). Todos los números salen de un único `useFirestoreCollection('users')` real: usuarios totales, altas en 7/30 días, activos en 7 días (nuevo campo `lastActiveAt`), % vía referido, ranking real de top referentes, conteo de Embajadores (reutiliza `REFERRAL_GOAL` exportado de `InviteScreen.tsx`).

3. **Re-enganche automático de usuarios inactivos** — sin Cloud Functions (decisión de cero gasto), la única forma de que corra solo es un cron gratis de GitHub Actions. Nuevo `scripts/reengagement-push.mjs` (Admin SDK directo, mismo patrón de seguridad que `migrate-company-model.mjs`: dry-run por defecto, detecta emulador vs producción) + `.github/workflows/reengagement.yml` (cron semanal lunes 10am WAT + `workflow_dispatch` manual). Considera inactivo a quien no tiene `lastActiveAt`/`createdAt` de hace 7+ días, salta a quien ya recibió un nudge esta semana (`lastReengagementPushAt`), y limpia tokens FCM muertos que FCM reporte como no registrados. Probado en vivo contra el emulador con datos sembrados (detectó correctamente al usuario inactivo, ignoró al activo). Nuevo campo `lastActiveAt` se escribe en cada sesión real confirmada (`App.tsx`, `onAuthStateChanged`) y se agregó a la whitelist de `firestore.rules` (con su test de reglas correspondiente, 51/51 ahora).

   **Pendiente real, requiere al usuario**: agregar el secreto `FIREBASE_SERVICE_ACCOUNT_KEY` en GitHub (Settings → Secrets and variables → Actions) con el JSON completo de una clave de cuenta de servicio — el workflow falla explícitamente con un mensaje claro si falta. No se automatizó la creación del secreto (es una credencial persistente, requiere acción explícita del dueño del repo).

4. **Dos bugs cerrados**:
   - Compresión de imágenes antes de guardar como base64 (`src/utils/imageCompression.ts`, nuevo — redimensiona a 512px máx + JPEG calidad 0.82 vía canvas antes de convertir a data URL). Conectado en `OnboardingScreen.tsx` y `ProfileScreen.tsx` (los únicos 2 sitios reales de subida de avatar; `ScanScreen.tsx` no aplica, esa imagen nunca se guarda, solo se manda al proxy de Gemini para OCR). Con fallback al comportamiento anterior sin comprimir si la compresión falla.
   - Botón "Adjuntar archivo" del chat retirado (`ChatScreen.tsx`) — mismo criterio que los mensajes de voz: sin Storage activo no hay dónde subir el archivo de verdad, así que no se finge la función.

**Verificado**: `tsc`/build limpios, `test:rules` 51/51 contra emulador real, script de re-enganche probado en vivo contra el emulador con datos sembrados. Deployado a producción (hosting + firestore:rules) — `https://connect.ebanavision.com` y `https://gen-lang-client-0951010679.web.app` sirven la versión con las 4 mejoras.

**Nota operativa real**: producción está en 0 usuarios ahora mismo (limpiada a propósito), así que nadie es `isAdmin` todavía — el Panel de Crecimiento no será visible para nadie hasta que alguien se registre y otro admin (o el propio dueño vía Admin SDK, ver el comentario de `isCallerAdmin()` en `firestore.rules`) le active `isAdmin: true` a esa cuenta.
