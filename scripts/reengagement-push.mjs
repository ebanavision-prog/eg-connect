#!/usr/bin/env node
/**
 * RE-ENGANCHE AUTOMÁTICO: push semanal a usuarios inactivos.
 *
 * Por qué existe: sin Cloud Functions (decisión de cero gasto, ver
 * docs/EVALUACION_BLAZE_2026-09-05.md), no hay forma de correr un job
 * programado dentro de Firebase. Este script + el workflow de GitHub Actions
 * (.github/workflows/reengagement.yml) son la alternativa gratis: GitHub
 * Actions ya soporta cron sin costo, y este script usa el Admin SDK
 * directamente (bypassa el proxy PHP de fcm-send.php -- ese proxy existe
 * para que un CLIENTE del navegador pueda pedir un push sin exponer
 * credenciales; acá quien corre el script YA tiene la cuenta de servicio
 * real, no hace falta la capa de idToken/rate-limit pensada para clientes).
 *
 * Qué hace:
 *   1. Lee todos los users/{uid} (colección chica a este volumen, mismo
 *      patrón que GrowthAnalyticsScreen.tsx/getAllUsers -- traer todo y
 *      filtrar en código, no una query nueva).
 *   2. Considera "inactivo" a quien no tiene lastActiveAt (o createdAt como
 *      fallback, para perfiles creados antes de que este campo existiera)
 *      de hace más de INACTIVITY_DAYS.
 *   3. Salta a quien ya recibió un push de re-enganche en los últimos
 *      INACTIVITY_DAYS (lastReengagementPushAt) -- con el cron semanal esto
 *      cap a un máximo de 1 nudge por semana por persona, nunca spam diario.
 *   4. Solo intenta con quien tiene fcmTokens reales guardados (opt-in real,
 *      ver pushService.ts) -- a nadie sin push configurado.
 *   5. Manda el push real vía admin.messaging(), y si FCM devuelve que un
 *      token ya no es válido (dispositivo desinstaló la app, etc.), lo saca
 *      del array fcmTokens de esa persona -- limpieza real, no solo intento.
 *
 * ENTORNO -- igual de importante que en migrate-company-model.mjs:
 *   - FIRESTORE_EMULATOR_HOST seteado -> conecta al emulador local, nunca
 *     toca producción. Modo para probar en desarrollo.
 *   - Sin esa variable -> Application Default Credentials contra
 *     gen-lang-client-0951010679 real. Así es como corre en GitHub Actions
 *     (ver el workflow), con el secreto FIREBASE_SERVICE_ACCOUNT_KEY escrito
 *     a un archivo temporal por el propio workflow.
 *
 * USO:
 *   node scripts/reengagement-push.mjs                  # dry-run (default), solo reporta
 *   node scripts/reengagement-push.mjs --dry-run=false   # manda los push de verdad
 */
import { readFileSync } from 'node:fs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const cfg = JSON.parse(readFileSync(new URL('../firebase-applet-config.json', import.meta.url), 'utf8'));
const PROJECT_ID = cfg.projectId;
const DATABASE_ID = cfg.firestoreDatabaseId;

const INACTIVITY_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const PUSH_TITLE = 'Te extrañamos en EG CONNECT 👋';
const PUSH_BODY = 'Hay empresas y profesionales nuevos en tu red esta semana. Volvé a conectar.';

function parseArgs(argv) {
  let dryRun = true;
  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    if (arg.startsWith('--dry-run=')) dryRun = arg.split('=')[1].toLowerCase() !== 'false';
  }
  return { dryRun };
}

function toMillis(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  return null;
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;

  console.log(`\n📣 [reengagement-push] destino: ${usingEmulator ? `EMULADOR (${process.env.FIRESTORE_EMULATOR_HOST})` : 'PRODUCCIÓN'} -- dry-run: ${dryRun}\n`);

  const app = initializeApp({
    projectId: PROJECT_ID,
    ...(usingEmulator ? {} : { credential: applicationDefault() })
  });
  const db = getFirestore(app, DATABASE_ID);
  const messaging = getMessaging(app);

  const now = Date.now();
  const snap = await db.collection('users').get();

  const candidates = [];
  for (const doc of snap.docs) {
    const u = doc.data();
    const tokens = Array.isArray(u.fcmTokens) ? u.fcmTokens : [];
    if (tokens.length === 0) continue;

    const lastActive = toMillis(u.lastActiveAt) ?? toMillis(u.createdAt);
    if (lastActive === null) continue; // sin ninguna marca de tiempo real, no se adivina
    const daysInactive = (now - lastActive) / DAY_MS;
    if (daysInactive < INACTIVITY_DAYS) continue;

    const lastPush = toMillis(u.lastReengagementPushAt);
    if (lastPush !== null && (now - lastPush) / DAY_MS < INACTIVITY_DAYS) continue; // ya se le mandó esta semana

    candidates.push({ uid: doc.id, name: u.name || '(sin nombre)', tokens, daysInactive: Math.floor(daysInactive) });
  }

  console.log(`Usuarios con fcmTokens: ${snap.docs.filter((d) => (d.data().fcmTokens || []).length > 0).length}`);
  console.log(`Candidatos a re-enganche (>= ${INACTIVITY_DAYS} días inactivos, sin nudge esta semana): ${candidates.length}\n`);

  let sent = 0;
  let cleaned = 0;

  for (const c of candidates) {
    if (dryRun) {
      console.log(`  [dry-run] mandaría push a uid=${c.uid} (${c.name}, ${c.daysInactive} días inactivo, ${c.tokens.length} dispositivo(s))`);
      continue;
    }

    const response = await messaging.sendEachForMulticast({
      tokens: c.tokens,
      notification: { title: PUSH_TITLE, body: PUSH_BODY }
    });

    const deadTokens = [];
    response.responses.forEach((r, i) => {
      if (!r.success && r.error?.code === 'messaging/registration-token-not-registered') {
        deadTokens.push(c.tokens[i]);
      }
    });

    if (deadTokens.length > 0) {
      await db.collection('users').doc(c.uid).update({ fcmTokens: FieldValue.arrayRemove(...deadTokens) });
      cleaned += deadTokens.length;
    }

    await db.collection('users').doc(c.uid).update({ lastReengagementPushAt: FieldValue.serverTimestamp() });

    sent++;
    console.log(`  ✅ uid=${c.uid} (${c.name}): ${response.successCount}/${c.tokens.length} entregados${deadTokens.length ? `, ${deadTokens.length} token(s) muerto(s) limpiado(s)` : ''}`);
  }

  console.log(
    dryRun
      ? `\nReporte (dry-run, nada enviado): ${candidates.length} recibirían el push.\n`
      : `\nCompletado: ${sent} usuarios notificados, ${cleaned} tokens muertos limpiados.\n`
  );
}

main().catch((error) => {
  console.error('Fallo inesperado en el re-enganche:', error);
  process.exitCode = 1;
});
