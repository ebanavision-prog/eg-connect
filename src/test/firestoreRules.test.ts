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
import { doc, setDoc, updateDoc, getDoc, deleteDoc, collection, addDoc, deleteField } from 'firebase/firestore';

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

  // --- users: compartir ubicación en el Mapa (opt-in explícito, MapScreen) ---
  await check('El dueño SÍ puede activar compartir su propia ubicación', async () => {
    await assertSucceeds(updateDoc(doc(userA, 'users/user-a'), {
      locationSharing: true,
      location: { lat: 3.75, lng: 8.77, updatedAt: new Date() }
    }));
  });

  await check('Un usuario NO puede escribir la ubicación de otro usuario', async () => {
    await assertFails(updateDoc(doc(userB, 'users/user-a'), {
      locationSharing: true,
      location: { lat: 3.75, lng: 8.77, updatedAt: new Date() }
    }));
  });

  await check('Un usuario NO puede colar isAdmin junto con su propia ubicación', async () => {
    await assertFails(updateDoc(doc(userA, 'users/user-a'), {
      locationSharing: true,
      location: { lat: 3.75, lng: 8.77, updatedAt: new Date() },
      isAdmin: true
    }));
  });

  await check('El dueño SÍ puede apagar el compartir y borrar su ubicación guardada', async () => {
    await assertSucceeds(updateDoc(doc(userA, 'users/user-a'), {
      locationSharing: false,
      location: deleteField()
    }));
  });

  await check('La ubicación queda realmente borrada tras apagar el compartir', async () => {
    const snap = await getDoc(doc(userA, 'users/user-a'));
    if (snap.data()?.location !== undefined) throw new Error('El campo location debería haber sido borrado, no solo locationSharing:false');
    if (snap.data()?.locationSharing !== false) throw new Error('locationSharing debería quedar en false');
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

  // --- notas sobre un contacto guardado: solo el dueño del contacto ---
  await check('El dueño SÍ puede añadir una nota a su propio contacto', async () => {
    await assertSucceeds(addDoc(collection(userA, 'users/user-a/contacts/c1/comments'), {
      authorName: 'Usuario A', text: 'Nos vimos en la conferencia', parentId: null
    }));
  });

  await check('Un usuario NO puede leer las notas de un contacto ajeno', async () => {
    await assertFails(getDoc(doc(userB, 'users/user-a/contacts/c1/comments/x')));
  });

  await check('Un usuario NO puede escribir una nota en el contacto de otro', async () => {
    await assertFails(addDoc(collection(userB, 'users/user-a/contacts/c1/comments'), {
      authorName: 'Intruso', text: 'Nota ajena', parentId: null
    }));
  });

  // --- feedback: cualquiera envía el suyo, nadie lee el de otros salvo admin ---
  await check('Un usuario SÍ puede enviar su propio feedback', async () => {
    await assertSucceeds(addDoc(collection(userA, 'feedback'), { userId: 'user-a', type: 'feedback', rating: 5, message: 'Genial' }));
  });

  await check('Nadie puede enviar feedback en nombre de otro usuario', async () => {
    await assertFails(addDoc(collection(userA, 'feedback'), { userId: 'user-b', type: 'feedback', rating: 1, message: 'Suplantado' }));
  });

  await check('Un usuario normal NO puede leer la bandeja de feedback', async () => {
    // user-b no sirve aquí: una prueba anterior lo ascendió a admin de verdad
    // (mismo estado del emulador para toda la suite) — se usa un usuario
    // fresco, garantizado sin privilegios, para no dar un falso negativo.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/user-plain'), { uid: 'user-plain', name: 'Usuario Normal', profileType: 'individual' });
      await setDoc(doc(ctx.firestore(), 'feedback/fb-1'), { userId: 'user-a', type: 'feedback', message: 'x' });
    });
    const userPlain = testEnv.authenticatedContext('user-plain').firestore();
    await assertFails(getDoc(doc(userPlain, 'feedback/fb-1')));
  });

  await check('Un admin SÍ puede leer la bandeja de feedback', async () => {
    await assertSucceeds(getDoc(doc(admin, 'feedback/fb-1')));
  });

  // --- connectionRequests: emprendedor propone, inversionista decide ---
  let requestId = '';
  await check('Un usuario SÍ puede enviar una solicitud de conexión', async () => {
    const ref = await assertSucceeds(addDoc(collection(userA, 'connectionRequests'), {
      fromUid: 'user-a', toUid: 'admin-a', fromName: 'Usuario A', fromAvatar: '', pitch: 'Mi proyecto...', status: 'pending'
    }));
    requestId = (ref as any).id;
  });

  await check('Nadie puede crear una solicitud suplantando a otro remitente', async () => {
    await assertFails(addDoc(collection(userA, 'connectionRequests'), {
      fromUid: 'user-b', toUid: 'admin-a', fromName: 'Falso', fromAvatar: '', pitch: 'x', status: 'pending'
    }));
  });

  await check('El destinatario SÍ puede aceptar la solicitud', async () => {
    await assertSucceeds(updateDoc(doc(admin, `connectionRequests/${requestId}`), { status: 'accepted' }));
  });

  await check('Alguien que no es el destinatario NO puede responder la solicitud de otro', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'connectionRequests/req-2'), { fromUid: 'user-a', toUid: 'admin-a', fromName: 'A', fromAvatar: '', pitch: 'x', status: 'pending' });
    });
    await assertFails(updateDoc(doc(userB, 'connectionRequests/req-2'), { status: 'accepted' }));
  });

  await check('Un tercero ajeno a la solicitud NO puede leerla', async () => {
    await assertFails(getDoc(doc(userB, `connectionRequests/${requestId}`)));
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

  // --- readReceipts: cada participante solo puede tocar su propia entrada ---
  await check('Un participante SÍ puede marcar su propia entrada de lectura', async () => {
    await assertSucceeds(updateDoc(doc(userB, 'conversations/conv-ab'), { 'readReceipts.user-b': new Date() }));
  });

  await check('Un participante NO puede marcar la entrada de lectura de otro', async () => {
    await assertFails(updateDoc(doc(userB, 'conversations/conv-ab'), { 'readReceipts.user-a': new Date() }));
  });

  await check('Un participante NO puede colar otro campo junto con su lectura', async () => {
    await assertFails(updateDoc(doc(userB, 'conversations/conv-ab'), { 'readReceipts.user-b': new Date(), lastMessage: 'Colado' }));
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
