# Evaluación Blaze — Modelo de Costo Real (EG Connect)

**Fecha:** 2026-09-05
**Tipo:** Investigación pura. Ningún código tocado, ningún commit, ninguna cuenta real activada.
**Objetivo:** responder con números reales (no "depende") qué costaría activar Firebase Blaze para EG Connect, en función de 4 escenarios de volumen paramétricos.

---

## 0. Punto de partida real (verificado en el código, no supuesto)

- El proyecto corre hoy en **Spark** (gratis) a propósito. `.env.example` trae `VITE_FIREBASE_STORAGE_ENABLED=false` con un comentario explícito: *"Firebase Storage exige plan Blaze — mientras no esté activado, dejar en false"*.
- Mientras ese flag esté en `false`, `uploadAvatarIfNeeded()` (`src/services/firebaseService.ts:411-420`) **nunca intenta** subir a Cloud Storage: guarda la foto tal cual como `data:` base64 directamente en el documento Firestore (`users/{uid}.avatar` o el logo de `companies/{id}`). El código lo dice sin adornos: *"Firebase Storage no está activado... el día que se active Storage, basta con poner esa variable en true"*.
- Los dos endpoints que normalmente serían Cloud Functions (proxy de Gemini y envío de push FCM) corren como PHP plano en el hosting cPanel existente **exactamente para evitar Blaze**, según el propio comentario en `server/fcm-send.php:9-13`: *"el normal fix es una Cloud Function, que requiere el plan Blaze incluso a $0 de uso real — explícitamente descartado para este proyecto"*.
- Ya hay paginación real: `CompaniesScreen`/`MarketplaceScreen`/`TendersScreen`/`InitiativesScreen` usan `limit(pageSize)` creciente en incrementos de **20** (`PAGE_SIZE_INCREMENT = 20`), con `onSnapshot` realtime. `getAllUsers(100)` (directorio de usuarios en `App.tsx`) es de tamaño fijo y se llama una vez al montar sesión (más una vez extra si el usuario edita su propio perfil) — no hay ningún polling/intervalo oculto, se verificó línea por línea.
- Rate limits ya documentados y reales: `server/lib/rate_limiter.php` — **20 req/min/uid** en el proxy de Gemini, **30 req/min/uid** en el envío de push. Son topes anti-abuso, no el uso normal esperado (ver sección 3).
- `storage.rules`: `avatars/{userId}` y `company-logos/{companyId}` — lectura pública, escritura solo si `request.resource.size < 5 * 1024 * 1024` (5 MB) y `contentType` empieza por `image/`. **No hay compresión ni resize del lado del cliente** (`handleImageUpload` en `ProfileScreen.tsx`/`OnboardingScreen.tsx` hace `FileReader.readAsDataURL` directo sobre el archivo elegido, sin pasar por un `<canvas>` ni ninguna librería de compresión — se buscó explícitamente y no existe).
- **Hallazgo colateral real, no pedido pero relevante:** como hoy el avatar vive como base64 dentro del documento Firestore (no en Storage), el límite de 5 MB de `storage.rules` **no se aplica** a esa ruta — un documento Firestore tiene un tope duro de **1 MiB por documento**. Una foto de cámara de teléfono sin comprimir (2–8 MB típico) simplemente hace fallar el `setDoc`/`updateDoc` con un error de tamaño excedido, no un error de negocio. Esto no es un problema de costo de Blaze, es un bug de robustez independiente — pero activar Storage de verdad (unas líneas ya escritas, solo detrás del flag) es también la corrección natural.

---

## 1. Pricing verificado (Blaze, fuentes oficiales, consultado 2026-09-05)

| Servicio | Cuota gratis (persiste en Blaze) | Precio más allá de la cuota | Fuente |
|---|---|---|---|
| **Cloud Firestore** (Standard) | 50.000 lecturas/día · 20.000 escrituras/día · 20.000 borrados/día · 1 GiB almacenado | **$0,06 / 100.000 lecturas** · **$0,18 / 100.000 escrituras** · **$0,02 / 100.000 borrados** · **$0,18 / GiB-mes** almacenado (tarifa nam5/multi-región US) | firebase.google.com/docs/firestore/pricing + cloud.google.com/firestore/pricing (cruzado con búsqueda) |
| **Cloud Storage** (bucket legacy `*.appspot.com`) | 5 GB almacenados · 1 GB/día descargado · 20.000 subidas/día · 50.000 descargas/día | Almacenamiento **$0,026/GB** · descarga **$0,12/GB** (algunas fuentes secundarias citan hasta $0,15/GB según región/volumen — la página oficial de Firebase dice $0,12 para el bucket legacy) · operaciones **$0,05/10K subidas**, **$0,004/10K descargas** | firebase.google.com/pricing |
| **Cloud Storage** (bucket nuevo `*.firebasestorage.app`, todo proyecto creado desde feb-2026) | 5 GB-mes almacenados · **100 GB/mes** descargados | Sigue tarifa de Google Cloud Storage regional (variable, similar orden de magnitud) | firebase.google.com/pricing |
| **Cloud Functions / Cloud Run functions (2ª gen)** | **2.000.000 invocaciones/mes** · ~180.000–200.000 vCPU-segundos/mes · ~360.000–400.000 GiB-segundos/mes (la cifra exacta de cómputo varía ligeramente entre fuentes; la de invocaciones es consistente en todas) · 1 GiB salida de red | **$0,40 / millón de invocaciones** · **$0,000024/vCPU-seg** · **$0,0000025/GiB-seg** | firebase.google.com/pricing + cloud.google.com/run/pricing (vía síntesis, la página oficial de Cloud Run trunca en fetch directo) |
| **App Check** | Gratis, sujeto a cuotas | $0 (no es un ítem de costo real en ningún escenario) | firebase.google.com/pricing |

**Confirmación directa a la pregunta de la tarea:** Cloud Functions **no tiene invocación gratis ilimitada** — el límite real es **2 millones/mes**, y por encima cuesta $0,40 por millón. Pero además, **Spark no permite desplegar Cloud Functions en absoluto**, ni para $0 de uso real — es exactamente la razón documentada en el propio código (`fcm-send.php:9-13`) por la que hoy existe el shim PHP.

---

## 2. Escenarios de volumen (parámetro: usuarios activos mensuales, MAU)

No hay acceso a datos reales de producción desde este entorno (confirmado, sin credenciales Admin). Las pistas reales del código para calibrar los escalones:

- Paginación en incrementos de 20 (`PAGE_SIZE_INCREMENT`) — pensada para listas de decenas/cientos, no de miles por página.
- `getAllUsers(100)` como techo fijo del directorio — coherente con una red donde "traer a todos" cabe en 100 documentos por ahora.
- `REFERRAL_GOAL = 5` en `InviteScreen.tsx` (5 referidos para insignia de "Embajador") — mecánica de crecimiento orgánico modesta, no diseñada para viralidad masiva.
- Es una red B2B **regional** (Guinea Ecuatorial), no un mercado masivo de consumo — el universo total de empresas/profesionales formales potenciales es de miles, no de millones.

Escenarios (MAU = usuarios que abren la app al menos una vez en el mes; DAU asumido en **25% del MAU**, supuesto explícito y ajustable — un producto B2B/profesional no se abre a diario como una red social de consumo):

| Escenario | MAU | DAU asumido (25%) |
|---|---|---|
| E1 — Piloto | 100 | 25 |
| E2 — Tracción inicial | 500 | 125 |
| E3 — Crecimiento regional | 2.000 | 500 |
| E4 — Éxito de nicho (techo realista del mercado formal EG) | 5.000 | 1.250 |

---

## 3. Costo estimado por categoría y escenario

### 3.1 Cloud Functions (si se migran los 2 endpoints PHP)

Supuesto de uso real por DAU/día (muy por debajo de los topes de rate-limit, que son anti-abuso, no uso esperado):
- Gemini: ~20% de los DAU escanean/piden algo ese día, ~3 llamadas cuando lo hacen → **0,6 invocaciones/DAU/día**
- Push send: ~2 invocaciones/DAU/día (mensaje o solicitud de conexión típica)
- Total ≈ **3 invocaciones/DAU/día**

| Escenario | Invocaciones/mes | % de la cuota gratis (2M) | Costo |
|---|---|---|---|
| E1 (25 DAU) | ~2.250 | 0,11% | **$0** |
| E2 (125 DAU) | ~11.250 | 0,56% | **$0** |
| E3 (500 DAU) | ~45.000 | 2,25% | **$0** |
| E4 (1.250 DAU) | ~112.500 | 5,6% | **$0** |

Cómputo (vCPU-seg/GiB-seg): cada invocación es una llamada de red corta (proxy HTTP), muy por debajo de 1 vCPU-segundo — el gasto de cómputo se queda dentro de la franja gratuita incluso en E4. **Para que Cloud Functions deje de ser gratis con este patrón de uso haría falta ~667.000 invocaciones/día** (22× el tráfico total de E4) — fuera de cualquier escenario realista para esta app. Este ítem es **cuasi-cero en los 4 escenarios**, no solo "hasta cierto volumen": el volumen necesario para que empiece a costar algo está muy por fuera del rango razonable para una red B2B regional.

### 3.2 Firestore más allá de la cuota Spark

Supuesto de lecturas/escrituras por sesión de DAU (con la paginación y el modelo de listener real de Firestore, donde solo se cobra 1 lectura por documento al conectar el listener + 1 lectura por documento que cambie después, no el resultado completo repetido):

- `getAllUsers(100)`: 100 lecturas (una vez por sesión)
- Notificaciones globales (`useAppNotifications.ts`: connectionRequests entrantes + propias + tenders `limit(5)`): ~13 lecturas/sesión
- ~1,5 pantallas paginadas visitadas de las 4 (Companies/Marketplace/Tenders/Initiatives) × 20: ~30 lecturas/sesión
- Chat (abierto en ~40% de sesiones: lista de conversaciones + mensajes de una conversación abierta): ~12 lecturas/sesión en promedio
- **Total ≈ 155 lecturas/DAU/día**, redondeado con margen a **175** para cubrir actualizaciones de listeners ya conectados
- Escrituras reales (mensajes, contactos, tareas, cambios de estado CRM, ediciones de perfil): **~10 escrituras/DAU/día**

| Escenario | Lecturas/día | Exceso sobre 50K/día | Escrituras/día | Costo lecturas/mes | Costo escrituras/mes | Costo total Firestore/mes |
|---|---|---|---|---|---|---|
| E1 (25 DAU) | 4.375 | 0 | 250 | $0 | $0 | **$0** |
| E2 (125 DAU) | 21.875 | 0 | 1.250 | $0 | $0 | **$0** |
| E3 (500 DAU) | 87.500 | 37.500/día → 1.125.000/mes | 5.000 | ~$0,68 | $0 | **~$0,68** |
| E4 (1.250 DAU) | 218.750 | 168.750/día → 5.062.500/mes | 12.500 | ~$3,04 | $0 | **~$3,04** |

Almacenamiento Firestore (además de las lecturas/escrituras): con avatares en base64 dentro de los documentos (patrón actual mientras Storage esté apagado), a ~750 KB promedio por usuario con foto, 5.000 usuarios ≈ 3,75 GiB — 2,75 GiB por encima del 1 GiB gratis × $0,18/GiB ≈ **$0,50/mes**. Trivial en dólares; el problema real de esta ruta es el riesgo de fallo por el límite de 1 MiB/documento (sección 0), no el costo.

**Firestore es cuasi-cero en los 4 escenarios** — el escenario más caro (E4) cuesta ~$3/mes en lecturas excedentes, no una cifra que cambie ninguna decisión de negocio.

### 3.3 Cloud Storage (fotos de perfil/empresa, si se activa el flag ya escrito)

Con el flag `VITE_FIREBASE_STORAGE_ENABLED=true`, cada avatar/logo migra de base64-en-Firestore a un objeto real en Storage. Usando el tope real de `storage.rules` (5 MB) como techo de rechazo, no como promedio — sin compresión de cliente, se asume **1,2 MB promedio real por imagen** (fotos de cámara moderadamente comprimidas por el propio SO, pero sin resize deliberado en la app).

**Almacenamiento** (≈1 imagen por MAU registrado, supuesto):

| Escenario | GB almacenados | Costo almacenamiento/mes |
|---|---|---|
| E1 (100) | 0,12 GB | $0 (bajo 5 GB gratis) |
| E2 (500) | 0,6 GB | $0 |
| E3 (2.000) | 2,4 GB | $0 |
| E4 (5.000) | 6 GB | ~$0,03 (1 GB sobre cuota × $0,026) |

**Descarga/egreso — el único ítem que puede volverse dinero real.** Los avatares son de lectura pública (`allow read: if true`) y se muestran repetidamente en listas, chat, contactos y perfiles de empresa. Supuesto explícito y ajustable: **30 cargas de imagen únicas por sesión de DAU** (feeds, contactos, chat, marketplace), sin que la app configure hoy cabeceras `Cache-Control` agresivas en los objetos subidos (no se encontró ninguna configuración de metadata al subir en `firebaseService.ts`) — es decir, este número es sensible a una decisión de configuración, no un costo fijo.

Fórmula: `DAU × 30 cargas × 1,2 MB = GB de egreso/día`

| Escenario | Egreso/día | Egreso/mes | Exceso sobre gratis (~30 GB/mes bucket legacy · 100 GB/mes bucket nuevo) | Costo/mes (a $0,12/GB) |
|---|---|---|---|---|
| E1 (25 DAU) | 0,9 GB | ~27 GB | 0 (bucket legacy) / 0 (bucket nuevo) | **$0** |
| E2 (125 DAU) | 4,5 GB | ~135 GB | ~105 GB (legacy) / ~35 GB (nuevo) | **~$12,6** (legacy) / **~$4,2** (nuevo) |
| E3 (500 DAU) | 18 GB | ~540 GB | ~510 GB (legacy) / ~440 GB (nuevo) | **~$61** (legacy) / **~$53** (nuevo) |
| E4 (1.250 DAU) | 45 GB | ~1.350 GB | ~1.320 GB (legacy) / ~1.250 GB (nuevo) | **~$158** (legacy) / **~$150** (nuevo) |

**Esta cifra es la más incierta de todo el modelo** porque depende enteramente del supuesto "30 cargas únicas/sesión" y de si se configura `Cache-Control` en los objetos (una línea de código, no un costo) — con cache agresivo (p. ej. 7 días) el egreso real podría bajar 5-10×, dejando incluso E4 en un rango de $15-30/mes en vez de ~$150. Con el supuesto conservador de arriba (sin tuning), **E2 ya deja de ser trivial** (~$4-13/mes) y **E3/E4 son el primer costo que un CEO notaría en el estado de cuenta** (~$50-160/mes).

---

## 4. Qué es "cuasi-cero hasta cierto volumen" vs. qué cobra desde el primer uso

- **Cobra desde la primera invocación, pero con una cuota gratis grande que hoy es imposible de agotar:** Cloud Functions (2M invocaciones/mes gratis; el uso real proyectado ni en E4 llega al 6% de esa cuota).
- **Cuasi-cero hasta un volumen que este modelo sitúa muy por encima de los 4 escenarios:** Firestore lecturas/escrituras/almacenamiento (máximo ~$3-4/mes combinado incluso en E4).
- **Cuasi-cero hasta un volumen medio, luego escala con el uso real (no con el número de usuarios per se, sino con cuántas imágenes se sirven):** Cloud Storage — gratis en E1, empieza a costar dólares reales de forma predecible desde E2, y es la única línea que llega a decenas/cientos de dólares en E3/E4, **pero es la única línea con una palanca de mitigación de diseño (Cache-Control, resize de imágenes al subir) que no cuesta activar Blaze, solo escribir código.**

---

## 5. Conclusión honesta

Con los supuestos explícitos de arriba (todos ajustables, ninguno inventado sobre datos reales de producción que no existen en este entorno):

- **E1 (100 MAU) y E2 (500 MAU):** el costo total mensual de Blaze se queda en **$0-15/mes**, dominado casi enteramente por egreso de Storage, no por Firestore ni Functions. Sigue siendo una decisión de "por qué no", no de presupuesto.
- **E3 (2.000 MAU)** es donde el costo **deja de ser trivial**: **~$55-65/mes**, casi todo egreso de imágenes. Firestore y Functions siguen siendo centavos.
- **E4 (5.000 MAU)**, el techo realista para una red de nicho regional, llega a **~$150-160/mes** sin optimizar cache de imágenes, o a **~$20-30/mes** si se configura `Cache-Control` razonable antes de activar Blaze — la diferencia entre ambos números es una tarde de trabajo, no una decisión de infraestructura.

**El punto de inflexión real no es "cuántos usuarios" sino "cuántas imágenes se sirven sin cache"** — es la única variable que domina el costo total en todos los escenarios por encima de E1. Firestore y Cloud Functions, con el patrón de uso real que ya existe en este código (paginación, rate limits, sin polling oculto), son efectivamente gratis en el rango de volumen que un producto B2B regional en fase temprana puede alcanzar de forma realista.

**Recomendación de secuencia, no de decisión** (esto es investigación, no una propuesta de acción): si se activa Blaze, vale más activar primero el `Cache-Control` en las subidas de Storage (gratis, ya en el código pendiente detrás del flag) que preocuparse por el número de usuarios — cambia el resultado de "E4 cuesta $150" a "E4 cuesta $25" sin tocar el modelo de negocio.

---

## Fuentes consultadas (2026-09-05)

- https://firebase.google.com/pricing — tabla Blaze completa (Firestore, Storage legacy y nuevo bucket, Functions, App Check)
- https://firebase.google.com/docs/firestore/pricing — cuota gratis diaria de Firestore
- https://cloud.google.com/firestore/pricing — tarifas por operación más allá de cuota (cruzado con búsqueda, el fetch directo truncó el contenido)
- https://cloud.google.com/run/pricing / https://www.cloudzero.com/blog/google-cloud-functions/ — tarifas de cómputo de Cloud Run functions (2ª gen), ya que Cloud Functions 2ª gen factura bajo el modelo de Cloud Run desde la migración de Google
