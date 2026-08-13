/**
 * Pruebas reales de firestore.rules contra el emulador local — no simulan
 * las reglas, las cargan y ejecutan de verdad (@firebase/rules-unit-testing).
 * Cubre los caminos de seguridad más sensibles, sobre todo los tocados esta
 * noche: que isAdmin nunca sea auto-otorgable, y las reglas de propiedad ya
 * existentes (contactos, tareas, empresas, conversaciones).
 *
 * Requiere el emulador de Firestore corriendo (`npm run emulators`) en el
 * puerto configurado en firebase.json (8181). No toca producción — usa un
 * proyecto de prueba dedicado, no gen-lang-client-0951010679.
 */
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { doc, setDoc, updateDoc, getDoc, deleteDoc, collection, addDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;
let passed = 0;
let failed = 0;

async function check(label: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ ${label}`);
    passed++;
  } catch (err: any) {
    console.log(`  ❌ ${label}`);
    console.log(`     ${err.message}`);
    failed++;
  }
}

async function main() {
  testEnv = await initializeTestEnvironment({
    projectId: 'eg-connect-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8181
    }
  });

  console.log('\n🔒 [Firestore Rules] Iniciando suite real contra el emulador...\n');

  // --- Setup: dos usuarios normales + un admin, insertados sin pasar por reglas ---
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/user-a'), { uid: 'user-a', name: 'Usuario A', profileType: 'individual' });
    await setDoc(doc(db, 'users/user-b'), { uid: 'user-b', name: 'Usuario B', profileType: 'individual' });
    await setDoc(doc(db, 'users/admin-a'), { uid: 'admin-a', name: 'Admin A', profileType: 'individual', isAdmin: true });
    await setDoc(doc(db, 'companies/company-a'), { name: 'Empresa A', ownerId: 'user-a', isVerified: false });
    await setDoc(doc(db, 'conversations/conv-ab'), { participants: ['user-a', 'user-b'], lastMessage: '', isGroup: false });
  });

  const userA = testEnv.authenticatedContext('user-a').firestore();
  const userB = testEnv.authenticatedContext('user-b').firestore();
  const admin = testEnv.authenticatedContext('admin-a').firestore();
  const anon = testEnv.unauthenticatedContext().firestore();

  // --- users: auto-escalación de admin ---
  await check('Un usuario normal NO puede ponerse isAdmin:true a sí mismo', async () => {
    await assertFails(updateDoc(doc(userA, 'users/user-a'), { isAdmin: true }));
  });

  await check('Un usuario normal NO puede crear su perfil ya con isAdmin:true', async () => {
    await assertFails(setDoc(doc(userB, 'users/user-b-fresh'), { uid: 'user-b-fresh', name: 'X', profileType: 'individual', isAdmin: true }));
  });

  await check('Un admin SÍ puede otorgar isAdmin a otro usuario (y solo ese campo)', async () => {
    await assertSucceeds(updateDoc(doc(admin, 'users/user-b'), { isAdmin: true }));
  });

  await check('Un admin NO puede tocar otros campos del perfil de otro usuario de paso', async () => {
    await assertFails(updateDoc(doc(admin, 'users/user-a'), { isAdmin: true, name: 'Nombre Cambiado' }));
  });

  await check('Un usuario normal (no admin) NO puede otorgar isAdmin a otro', async () => {
    await assertFails(updateDoc(doc(userA, 'users/user-b'), { isAdmin: true }));
  });

  // --- companies: verificación solo por admin ---
  await check('El dueño de una empresa NO puede auto-verificarla', async () => {
    await assertFails(updateDoc(doc(userA, 'companies/company-a'), { isVerified: true }));
  });

  await check('Un admin SÍ puede verificar la empresa de otro', async () => {
    await assertSucceeds(updateDoc(doc(admin, 'companies/company-a'), { isVerified: true, verificationStatus: 'verified' }));
  });

  await check('Alguien que no es el dueño NO puede editar la empresa', async () => {
    await assertFails(updateDoc(doc(userB, 'companies/company-a'), { name: 'Hackeada' }));
  });

  // --- tenders: solo admin escribe ---
  await check('Un usuario normal NO puede publicar una licitación', async () => {
    await assertFails(addDoc(collection(userA, 'tenders'), { title: 'Falsa', companyName: 'X' }));
  });

  await check('Un admin SÍ puede publicar una licitación', async () => {
    await assertSucceeds(addDoc(collection(admin, 'tenders'), { title: 'Real', companyName: 'Ministerio' }));
  });

  await check('Cualquier usuario logueado puede leer licitaciones', async () => {
    await assertSucceeds(getDoc(doc(userA, 'tenders/no-existe')));
  });

  await check('Un anónimo (sin sesión) NO puede leer licitaciones', async () => {
    await assertFails(getDoc(doc(anon, 'tenders/no-existe')));
  });

  // --- contacts / tasks: solo el dueño ---
  await check('Un usuario NO puede leer los contactos privados de otro', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/user-a/contacts/c1'), { name: 'Contacto Privado' });
    });
    await assertFails(getDoc(doc(userB, 'users/user-a/contacts/c1')));
  });

  await check('El dueño SÍ puede leer sus propios contactos', async () => {
    await assertSucceeds(getDoc(doc(userA, 'users/user-a/contacts/c1')));
  });

  await check('Un usuario NO puede escribir tareas de otro', async () => {
    await assertFails(setDoc(doc(userB, 'users/user-a/tasks/t1'), { title: 'Intrusa' }));
  });

  // --- conversations: solo participantes ---
  await check('Un tercero (no participante) NO puede leer una conversación ajena', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/user-c'), { uid: 'user-c', name: 'Usuario C', profileType: 'individual' });
    });
    const userC = testEnv.authenticatedContext('user-c').firestore();
    await assertFails(getDoc(doc(userC, 'conversations/conv-ab')));
  });

  await check('Un participante SÍ puede leer su conversación', async () => {
    await assertSucceeds(getDoc(doc(userA, 'conversations/conv-ab')));
  });

  await check('Un tercero NO puede enviar un mensaje suplantando a otro (senderId falso)', async () => {
    await assertFails(addDoc(collection(userB, 'conversations/conv-ab/messages'), { senderId: 'user-a', text: 'Suplantado', type: 'text' }));
  });

  console.log(`\n📊 [Firestore Rules] ${passed}/${passed + failed} aserciones pasaron con éxito.\n`);

  await testEnv.cleanup();

  if (failed > 0) {
    console.error(`${failed} prueba(s) de reglas fallaron.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error fatal ejecutando las pruebas de reglas:', err);
  process.exit(1);
});
