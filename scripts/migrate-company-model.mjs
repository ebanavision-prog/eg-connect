#!/usr/bin/env node
/**
 * MIGRACIÓN: unificación del modelo de "empresa" (ver docs/PLAN_MEJORA_360.md
 * sección 3/7 Fase 2, y docs/MIGRACION_EMPRESA.md para el runbook completo
 * de cómo correr esto algún día contra producción).
 *
 * `companies` pasa a ser la entidad canónica. Este script recorre
 * `users/{uid}` con `profileType === 'company'` que todavía no tienen
 * `companyId` (perfiles creados antes de que existiera el enlace hacia
 * adelante en CompaniesScreen.tsx/ProfileScreen.tsx) y les crea (backfill)
 * el doc `companies/` correspondiente, guardando `companyId` de vuelta en
 * su perfil.
 *
 * ENTORNO -- MUY IMPORTANTE, LEER ANTES DE CORRER:
 *   - Si la variable de entorno FIRESTORE_EMULATOR_HOST está seteada (p.ej.
 *     127.0.0.1:8181, que es justo el puerto que usa `npm run emulators` en
 *     este repo -- ver firebase.json), el Admin SDK de Firebase se conecta
 *     automáticamente al EMULADOR local. Nunca toca datos reales así. Este
 *     es el único modo en el que este script debe correrse en un entorno de
 *     desarrollo/agente como este.
 *   - Si esa variable NO está seteada, el Admin SDK intenta conectarse al
 *     proyecto de PRODUCCIÓN real (ver firebase-applet-config.json /
 *     .firebaserc: gen-lang-client-0951010679) usando credenciales por
 *     defecto de la aplicación (Application Default Credentials --
 *     GOOGLE_APPLICATION_CREDENTIALS apuntando a una cuenta de servicio, o
 *     `gcloud auth application-default login`). Este script NUNCA debe
 *     correrse contra producción desde un entorno de agente/CI sin
 *     supervisión humana directa -- ver docs/MIGRACION_EMPRESA.md.
 *
 * USO:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8181 node scripts/migrate-company-model.mjs                  # dry-run (default)
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8181 node scripts/migrate-company-model.mjs --dry-run=true    # dry-run explícito
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8181 node scripts/migrate-company-model.mjs --dry-run=false   # escribe de verdad
 *
 * `--dry-run` es TRUE por defecto -- hay que pasar `--dry-run=false`
 * explícitamente para que el script escriba algo. Es idempotente: si un
 * usuario ya tiene `companyId`, se salta sin crear un doc duplicado en
 * `companies/`, en cualquier corrida posterior.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Misma fuente de verdad que usa el cliente (src/services/firebaseService.ts)
// para projectId/database -- así nunca se desincroniza si cambian.
const firebaseConfig = JSON.parse(
  readFileSync(path.join(__dirname, '..', 'firebase-applet-config.json'), 'utf8')
);
const PROJECT_ID = firebaseConfig.projectId;
const DATABASE_ID = firebaseConfig.firestoreDatabaseId;

// Valor por defecto razonable cuando el usuario nunca rellenó "profesión/
// sector" en su perfil -- 'Servicios' es una de las opciones reales del
// desplegable de industria en CompaniesScreen.tsx, no un valor inventado.
const DEFAULT_INDUSTRY = 'Servicios';

function parseArgs(argv) {
  let dryRun = true;
  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg.startsWith('--dry-run=')) {
      const value = arg.split('=')[1];
      dryRun = value.toLowerCase() !== 'false';
    }
  }
  return { dryRun };
}

// Genera el mismo logo por defecto que createCompany()/CompaniesScreen.tsx
// usan al registrar una empresa a mano, para que un doc creado por backfill
// se vea igual que uno creado por un usuario real.
function buildCompanyLogo(name) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || '')}&background=045C68&color=fff&size=256`;
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;

  if (!usingEmulator) {
    console.log('\n⚠️  FIRESTORE_EMULATOR_HOST no está seteado -- este script va a intentar conectarse a PRODUCCIÓN.');
    console.log(`    Proyecto: ${PROJECT_ID} / base de datos: ${DATABASE_ID}.`);
    console.log('    Un entorno de agente/desarrollo sin credenciales reales fallará aquí de forma segura.');
    console.log('    Lee docs/MIGRACION_EMPRESA.md antes de continuar contra producción.\n');
  }

  const app = initializeApp({
    projectId: PROJECT_ID,
    ...(usingEmulator ? {} : { credential: applicationDefault() })
  });
  const db = getFirestore(app, DATABASE_ID);

  console.log(`\n🏢 [migrate-company-model] destino: ${usingEmulator ? `EMULADOR (${process.env.FIRESTORE_EMULATOR_HOST})` : 'PRODUCCIÓN'} -- dry-run: ${dryRun}\n`);

  const snap = await db.collection('users').where('profileType', '==', 'company').get();
  const candidates = snap.docs.filter((d) => !d.data().companyId);
  const alreadyLinked = snap.docs.length - candidates.length;

  console.log(`Usuarios con profileType='company' encontrados: ${snap.docs.length}`);
  console.log(`  Ya tienen companyId (se saltan, idempotencia): ${alreadyLinked}`);
  console.log(`  Candidatos a migrar: ${candidates.length}\n`);

  let created = 0;
  let errors = 0;

  for (const userDoc of candidates) {
    const user = userDoc.data();
    const uid = userDoc.id;

    const companyData = {
      ownerId: uid,
      name: user.name || '(sin nombre)',
      employees: user.employees || '',
      website: user.website || '',
      isVerified: false,
      verificationStatus: 'pending',
      industry: user.profession || DEFAULT_INDUSTRY,
      description: '',
      logo: buildCompanyLogo(user.name),
      tags: []
    };
    // yearsInMarket es opcional en el tipo Company -- solo se incluye si el
    // usuario lo tiene, en vez de forzar un valor inventado tipo '0-2'.
    if (user.yearsInMarket) companyData.yearsInMarket = user.yearsInMarket;

    if (dryRun) {
      console.log(`  [dry-run] crearía companies/<auto-id> para uid=${uid} (name="${companyData.name}", industry="${companyData.industry}") -> luego users/${uid}.companyId = <ese id>`);
      continue;
    }

    try {
      const companyRef = await db.collection('companies').add({
        ...companyData,
        createdAt: FieldValue.serverTimestamp()
      });
      await db.collection('users').doc(uid).update({ companyId: companyRef.id });
      created++;
      console.log(`  ✅ uid=${uid} -> companies/${companyRef.id}`);
    } catch (error) {
      errors++;
      console.error(`  ❌ uid=${uid}: ${error.message}`);
    }
  }

  console.log(
    dryRun
      ? `\nReporte (dry-run, nada escrito): ${candidates.length} se migrarían, ${alreadyLinked} ya enlazados (se saltarían).\n`
      : `\nMigración completada: ${created} creados, ${alreadyLinked} ya enlazados (saltados), ${errors} errores.\n`
  );

  if (errors > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('Fallo inesperado en la migración:', error);
  process.exitCode = 1;
});
