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
- ~~Cerrar el agujero de `gemini-proxy.php` + rate limiting básico en ambos endpoints PHP~~ — **hecho** (merge `e81f4d8`, 2026-09-04): `server/lib/firebase_auth.php` extraído sin cambio de comportamiento, `gemini-proxy.php` ahora exige idToken real, rate limiting por uid (20/min Gemini, 30/min push) con ventana deslizante en `server/lib/rate_limiter.php`. `aiService.ts` actualizado para mandar el idToken. `npm run lint` limpio. **Pendiente real:** no se pudo correr `php -l` en este entorno (sin binario PHP) — el agente verificó balance de llaves a mano; conviene un `php -l` real la primera vez que esto se suba al servidor cPanel.
- ~~Verificación en vivo contra el emulador de los dos merges~~ — **hecho**: reglas 44/44 contra emulador real + dev server booteando limpio; falta solo el click-a-click visual (sin extensión de Chrome disponible en este entorno)

### Fase 1 — Fundamentos de ingeniería (2-4 sesiones)
- ~~CI en GitHub Actions: typecheck + `test:rules` en cada push~~ — **hecho** (merge `70aa4b5`, 2026-09-04): `.github/workflows/ci.yml`, 3 jobs (typecheck/build/rules-tests), ensayado dos veces contra emulador real (38/38 ambas)
- ~~Canal de staging en Firebase Hosting~~ — **hecho**: script `npm run deploy:staging` + `docs/STAGING.md`. **Pendiente real:** no se pudo probar un deploy real porque la cuenta de Firebase CLI de este entorno no tiene acceso al proyecto `gen-lang-client-0951010679` — falta que alguien con acceso real lo confirme una vez
- ~~Tipar `UserProfile` y eliminar los `any` más críticos~~ — **hecho** (merge `bbe4f38`, 2026-09-04): interfaz derivada de grep exhaustivo + whitelist de `firestore.rules`, tipada en App.tsx y 14 pantallas. Cero cambio de comportamiento — dos bugs preexistentes de uid/id (MapScreen/DiscoverScreen) quedaron señalados en el reporte del agente, deliberadamente sin tocar
- ~~Extraer store ligero (Zustand/Context)~~ — **hecho** (mismo merge): `src/store/useAppStore.ts`, adopción inicial limitada a App.tsx a propósito. **Fase 1.5 pendiente:** migrar las pantallas hijas para leer del store directamente en vez de por props
- ~~Completar cobertura de i18n~~ — **hecho, 21/21 pantallas** (2026-09-04): 16 mergeadas (`4b2776c`) + 5 finales (ProfileScreen, InviteScreen, MarketplaceScreen, CompaniesScreen, CompanyProfileModal) mergeadas sin conflictos. **Fase 1 completa en su totalidad.**

### Fase 2 — Integridad de datos y privacidad
- ~~Unificar el modelo de empresa (`users` vs `companies`)~~ — **hecho** (2026-09-04, merge `5aee0ab`, rescatado de la worktree huérfana `agent-a56997c9fe3a4df04`): `UserProfile.companyId` enlaza a `companies/{companyId}` (entidad canónica); `CompaniesScreen`/`ProfileScreen` enlazan hacia adelante en el momento de registrar/marcar empresa; `scripts/migrate-company-model.mjs` hace backfill idempotente para perfiles `profileType='company'` creados antes del cambio (dry-run por defecto, nunca corre solo contra producción — ver `docs/MIGRACION_EMPRESA.md`). Verificado: `tsc`/build limpios, `test:rules` 49/49 contra emulador real. **Pendiente real, para un humano con acceso**: correr la migración de backfill contra producción siguiendo el runbook (`docs/MIGRACION_EMPRESA.md`).
- ~~Paginación real en Companies/Marketplace/Tenders/Initiatives~~ — **hecho** (2026-09-04, merge `82019f1`)
- ~~Auditoría de índices Firestore contra queries reales~~ — **hecho** (2026-09-04): sin índices faltantes, uno muerto eliminado (`marketplace_posts`)
- ~~Exportación de datos + borrado de cuenta real~~ — **hecho** (2026-09-04, merge `8e60ec0`)

**Fase 2 completa en su totalidad** (salvo la corrida real de la migración de backfill en producción, que requiere credenciales humanas — ver arriba).

### Fase 3 — Funcionalidades y crecimiento
- **Mensajes de voz reales — decisión pendiente de confirmar (2026-09-05), recomendación: retirar la feature.** `MediaRecorder`/Storage real exige activar Blaze (Firebase Storage está apagado a propósito en este proyecto — ver `firebaseService.ts:400-408` — y base64-en-Firestore no es viable para audio: un clip corto pesa 100 KB-1 MB, y cada `onSnapshot` en tiempo real re-descarga ese blob completo en cada sincronización, multiplicando el consumo de cuota gratuita de Spark). Recomendado retirar la UI de grabación de `ChatScreen.tsx` hasta que Fase 4 active Blaze de verdad, en vez de construirla ahora sobre una ruta gratis que en realidad no lo es. **No ejecutado todavía** — a la espera de que el usuario lo confirme.
- ~~Descomposición de los 2 componentes de mayor retorno~~ — **hecho** (2026-09-05, merges `5f2cd57`/`4046c3b`): wizard de registro de empresa extraído de `CompaniesScreen.tsx` (1047→521 líneas) a `CompanyRegistrationWizard.tsx`; sidebar de navegación extraído de `App.tsx` (752→~470 líneas) a `AppSidebar.tsx`. Cero cambio de comportamiento, verificado (`tsc`/build limpios, `test:rules` 49/49). **Sigue pendiente**: los otros 3 componentes grandes que el diagnóstico original señaló (`ProfileScreen.tsx` 777, `OnboardingScreen.tsx` 711, `MarketplaceScreen.tsx` 747) — no tocados todavía.
- ~~Pase de accesibilidad (aria-labels, foco, contraste)~~ — **hecho** (2026-09-05, merge `60905f7`): ~50 botones-icono + 2 toggles sin nombre accesible en 19 pantallas reciben `aria-label`/`role="switch"`, siguiendo el patrón ya usado en `MapScreen.tsx`; 28 claves `*Aria` nuevas en `es.json`/`en.json` (874 claves, 1:1). Foco visible vía 2 utilidades Tailwind nuevas (`.focus-ring-custom`/`.focus-ring-inverse`) en `src/index.css`. Contraste revisado, sin hallazgos que corregir. Verificado igual (`tsc`/build/`test:rules` 49/49).

### Fase 4 — Escala (cuando el volumen lo justifique, no antes)
- Evaluar activar Blaze: Storage real, App Check, posible migración de PHP→Cloud Functions
- Observabilidad real (logs agregados, alertas de cuota/errores)

---

## Nota de alcance
Este plan no incluye nada que contradiga las decisiones deliberadas ya tomadas en el código (sin Blaze, sin Cloud Functions, single-tab Firestore, sin cámara en vivo en el escáner) — esas son decisiones de costo/negocio documentadas y razonadas, no deuda técnica. Lo que sí se señala es dónde esas mismas decisiones necesitan un refuerzo (rate limiting, idToken en el proxy de Gemini) para seguir siendo seguras a medida que crece el uso real.
