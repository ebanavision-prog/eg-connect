# Migración: unificación del modelo de "empresa"

**Contexto:** ver `docs/PLAN_MEJORA_360.md` secciones 3 y 7 (Fase 2). Hoy conviven
dos representaciones de "soy una empresa": un usuario puede marcar
`profileType='company'` en `ProfileScreen` (guarda `employees`/`website`/
`yearsInMarket` directamente en su propio `users/{uid}`) sin pasar nunca por
el wizard de `CompaniesScreen`, y viceversa. Se decidió **unificar con
migración backfill**: `companies` pasa a ser la entidad canónica, y cualquier
`users/{uid}` con `profileType='company'` sin `companyId` se autocompleta con
un doc `companies/` nuevo.

Desde el cambio de código que acompaña este documento, los dos caminos hacia
adelante (registrar empresa en `CompaniesScreen`, o marcar `profileType`
`'company'` y guardar en `ProfileScreen`) ya enlazan `companyId` en el
momento — este script **solo** es necesario para los perfiles `'company'`
creados *antes* de ese cambio, durante la ventana de pruebas de staff en
producción (2026-08-11 → ~2026-09-10).

## Qué hace el script

`scripts/migrate-company-model.mjs`:

1. Busca todos los `users/{uid}` con `profileType === 'company'` que **no**
   tienen `companyId`.
2. Para cada uno, crea un doc nuevo en `companies/` con los datos que ese
   usuario ya tenía en su perfil (`name`, `employees`, `yearsInMarket`,
   `website`, `profession` → `industry`), `isVerified: false`,
   `verificationStatus: 'pending'`, `logo` generado con ui-avatars.com igual
   que `createCompany()`, y `ownerId` apuntando de vuelta al usuario.
3. Actualiza ese mismo `users/{uid}` con el `companyId` del doc recién creado.
4. Es **idempotente**: en una segunda corrida, los usuarios que ya tienen
   `companyId` se saltan — no se crean duplicados.

## Cómo correrlo (una persona con acceso real)

### 1. Contra el emulador primero, siempre

```bash
npm run emulators   # en una terminal aparte, déjalo corriendo

# en otra terminal, con el emulador activo:
FIRESTORE_EMULATOR_HOST=127.0.0.1:8181 node scripts/migrate-company-model.mjs --dry-run=true
```

Revisa el reporte impreso (cuántos usuarios se migrarían, con qué datos).
Nada se escribe todavía — `--dry-run` es `true` por defecto.

Si el reporte se ve bien, corre de verdad contra el emulador para confirmar
el comportamiento antes de tocar nada real:

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8181 node scripts/migrate-company-model.mjs --dry-run=false
```

Puedes correrlo una segunda vez con `--dry-run=false` para confirmar que no
duplica nada (los usuarios recién migrados ahora tienen `companyId`, así que
el script los salta).

### 2. Contra producción — solo un humano con credenciales reales

**Este script nunca debe correrse contra producción desde un entorno de
agente/CI sin supervisión humana directa.** Requiere credenciales reales que
este entorno de desarrollo no tiene y no debe tener.

Requisitos previos:

- Acceso de administrador al proyecto Firebase `gen-lang-client-0951010679`
  (ver `.firebaserc`).
- Credenciales de aplicación por defecto (Application Default Credentials)
  configuradas localmente, por ejemplo:
  ```bash
  gcloud auth application-default login
  ```
  o una cuenta de servicio vía `GOOGLE_APPLICATION_CREDENTIALS` apuntando a
  un JSON de credenciales con permisos de escritura en Firestore sobre ese
  proyecto.

Procedimiento (**siempre en este orden, nunca te saltes el paso 1**):

```bash
# 1. Sin FIRESTORE_EMULATOR_HOST seteado => el script apunta a producción.
#    --dry-run=true (o sin flag, es el default) -- SOLO reporta, no escribe nada.
node scripts/migrate-company-model.mjs --dry-run=true
```

Lee el reporte con calma: cuántos usuarios reales se verían afectados, qué
nombre/industria tendría cada doc `companies/` nuevo. Si algo se ve raro
(un nombre vacío, una industria por defecto que no encaja), para y revisa
los datos de ese usuario a mano antes de continuar.

```bash
# 2. Solo después de revisar el reporte y estar conforme:
node scripts/migrate-company-model.mjs --dry-run=false
```

Guarda la salida de esta corrida (contiene cada `uid` migrado y el
`companyId` que se le asignó) por si hace falta auditar después.

### 3. Verificación posterior

En la consola de Firebase (o con una query rápida), confirma que:

- Los usuarios migrados tienen `companyId` apuntando a un doc real en
  `companies/`.
- Ese doc `companies/{companyId}` tiene `ownerId` igual al `uid` del usuario.
- El conteo de `companies/` creadas coincide con el número de "creados" que
  imprimió el script.

## Notas de diseño

- **Industria por defecto:** si el usuario nunca rellenó su "profesión/
  sector" en `ProfileScreen`, se usa `'Servicios'` — es una de las opciones
  reales del desplegable de industria en `CompaniesScreen.tsx`, no un valor
  inventado sin relación con el resto del producto.
- **`employees`/`website`:** el tipo `Company` (`src/types.ts`) los declara
  como campos requeridos (no opcionales) — para no dejar `undefined`
  renderizándose en la UI de `CompaniesScreen`, el script guarda cadena
  vacía `''` cuando el usuario no los tenía, en vez de omitir el campo.
- **`yearsInMarket`:** sí es opcional en el tipo `Company`, así que el script
  solo lo incluye cuando el usuario lo tenía — no inventa un valor por
  defecto tipo `'0-2'`.
- **Base de datos:** el script lee `projectId`/`firestoreDatabaseId` de
  `firebase-applet-config.json` (la misma fuente que usa el cliente en
  `src/services/firebaseService.ts`), para no desincronizarse si esos
  valores cambian.
