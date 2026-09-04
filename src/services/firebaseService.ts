import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  deleteUser
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  connectFirestoreEmulator,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  getDocFromServer,
  Timestamp,
  serverTimestamp,
  orderBy,
  limit,
  arrayUnion,
  arrayRemove,
  increment,
  deleteField
} from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, connectStorageEmulator } from 'firebase/storage';
import { connectAuthEmulator } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);

// Persistencia offline real de Firestore (lee/escribe desde caché local y
// sincroniza solo al reconectar) en vez de la cola de sincronización simulada
// que había antes en localDataService — esa nunca hablaba con un backend real.
//
// Single-tab a propósito (2026-07-30), no multi-tab: `persistentMultipleTabManager`
// usa por debajo un protocolo de "elección de pestaña líder" sobre IndexedDB que es
// una causa real y documentada de cuelgues/clics que dejan de responder en apps de
// Firebase — coincide con un problema que el usuario confirma haber visto ya en
// producción. Contra el emulador local esto queda enmascarado por un bug propio y
// ya identificado del SDK (ver github.com/firebase/firebase-js-sdk/issues/9267,
// confirmado por su reportero como exclusivo del emulador), así que no se pudo
// verificar este cambio de forma 100% limpia en local — pero el razonamiento aplica
// igual a producción, y el coste de perder sincronización entre pestañas simultáneas
// del mismo usuario es bajo en una app mobile-first.
export const db = initializeFirestore(
  app,
  { localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }) },
  firebaseConfig.firestoreDatabaseId
);
export const auth = getAuth();
export const storage = getStorage(app);

// Pruebas locales contra el emulador (Firestore+Auth+Storage), nunca contra datos
// reales. Storage funciona en el emulador aunque el proyecto real siga sin activarlo
// (eso solo bloquea producción, ver Fase 0 del plan). Activar con VITE_USE_FIREBASE_EMULATOR=true.
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  connectFirestoreEmulator(db, '127.0.0.1', 8181);
  connectAuthEmulator(auth, 'http://127.0.0.1:9198', { disableWarnings: true });
  connectStorageEmulator(storage, '127.0.0.1', 9197);
  console.log('[eg-connect] Conectado a emuladores locales de Firebase — sin tocar datos reales.');
}

const googleProvider = new GoogleAuthProvider();
const virtualDomain = '@connect.ebanavision.com';

export const loginWithUsername = async (username: string, password: string) => {
  const email = `${username.toLowerCase().trim()}${virtualDomain}`;
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const registerWithUsername = async (username: string, password: string, userData: any) => {
  const email = `${username.toLowerCase().trim()}${virtualDomain}`;
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName: userData.name });

    const avatarUrl = await uploadAvatarIfNeeded(`avatars/${result.user.uid}`, userData.avatar);

    const dataToSave = {
      ...userData,
      avatar: avatarUrl,
      uid: result.user.uid,
      username: username.toLowerCase().trim(),
      email: email,
      createdAt: serverTimestamp()
    };

    await saveUserData(result.user.uid, dataToSave);
    return result.user;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

export const resetPassword = async (emailOrUsername: string) => {
  let email = emailOrUsername;
  if (!emailOrUsername.includes('@')) {
    email = `${emailOrUsername.toLowerCase().trim()}${virtualDomain}`;
  }
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error('Password reset error:', error);
    throw error;
  }
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export interface GoogleImportedContact {
  name: string;
  phone: string;
  company: string;
  role: string;
}

// Importar contactos reales de Gmail — funciona igual en iPhone y Android
// porque es un permiso de la cuenta de Google, no del navegador (a
// diferencia de la Contact Picker API, que solo existe en Chrome/Android).
// Requiere que la API de Contactos ("People API") esté activada en la
// consola de Google Cloud del proyecto — si no lo está, Google devuelve un
// error claro al pedir el permiso, no falla en silencio.
export const importGoogleContacts = async (): Promise<GoogleImportedContact[]> => {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/contacts.readonly');
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;
  if (!accessToken) throw new Error('No se obtuvo permiso de acceso a Contactos de Google.');

  const response = await fetch(
    'https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers,organizations&pageSize=200',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) {
    throw new Error(`Google People API respondió ${response.status}. Verifica que la People API esté activada en Google Cloud Console.`);
  }
  const data = await response.json();
  const connections = (data.connections || []) as any[];

  return connections
    .map((c) => ({
      name: c.names?.[0]?.displayName || '',
      phone: c.phoneNumbers?.[0]?.value || '',
      company: c.organizations?.[0]?.name || '',
      role: c.organizations?.[0]?.title || ''
    }))
    .filter((c) => c.name);
};

export const logout = () => signOut(auth);

export const getUserData = async (uid: string) => {
  const path = `users/${uid}`;
  try {
    const docSnap = await getDoc(doc(db, path));
    return docSnap.exists() ? docSnap.data() : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
};

export const saveUserData = async (uid: string, data: any) => {
  const path = `users/${uid}`;
  try {
    await setDoc(doc(db, path), {
      ...data,
      uid,
      updatedAt: serverTimestamp(),
      createdAt: data.createdAt || serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// Compartir ubicación en el Mapa: opt-in explícito, campo por campo — nunca
// se toca el resto del perfil. `coords` no nulo activa el compartir y guarda
// la posición; `null` lo apaga y BORRA la ubicación guardada (deleteField,
// no solo locationSharing:false) para que no quede una posición vieja
// flotando en la base de datos de alguien que ya dijo que no quiere
// compartirla. Ver firestore.rules: 'location'/'locationSharing' están en
// la lista blanca de auto-edición de users/{userId}, nada más.
export const setUserLocationSharing = async (uid: string, coords: { lat: number; lng: number } | null) => {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, path), coords
      ? {
          locationSharing: true,
          location: { lat: coords.lat, lng: coords.lng, updatedAt: serverTimestamp() },
          updatedAt: serverTimestamp()
        }
      : {
          locationSharing: false,
          location: deleteField(),
          updatedAt: serverTimestamp()
        });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const getAllUsers = async (limitCount: number = 50) => {
  const path = 'users';
  try {
    const q = query(
      collection(db, path), 
      orderBy('createdAt', 'desc'), 
      limit(limitCount)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    })) as any[];
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

// Convierte recursivamente cualquier Timestamp de Firestore a ISO string
// legible — sin esto, un export a JSON de un documento con Timestamp deja
// objetos crudos tipo {seconds, nanoseconds} en vez de una fecha que un
// humano (o cualquier otra herramienta) pueda leer.
function serializeTimestamps(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serializeTimestamps);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = serializeTimestamps(val);
    }
    return out;
  }
  return value;
}

// Exportación completa de los datos del usuario (derecho de acceso/portabilidad):
// el documento de perfil + todos sus contactos (con las notas propias de cada
// uno) + todas sus tareas, en un único objeto JSON serializable. A diferencia
// del export CSV de contactos (más específico, pensado para reimportar en otra
// herramienta de contactos), este es "todo lo que la app sabe de mí".
export const exportAllUserData = async (uid: string) => {
  const path = `users/${uid}`;
  try {
    const profileSnap = await getDoc(doc(db, path));
    const profile = profileSnap.exists() ? serializeTimestamps(profileSnap.data()) : null;

    const contactsSnap = await getDocs(collection(db, `${path}/contacts`));
    const contacts = await Promise.all(contactsSnap.docs.map(async (contactDoc) => {
      const commentsSnap = await getDocs(collection(contactDoc.ref, 'comments'));
      return {
        id: contactDoc.id,
        ...(serializeTimestamps(contactDoc.data()) as Record<string, unknown>),
        comments: commentsSnap.docs.map((c) => ({ id: c.id, ...(serializeTimestamps(c.data()) as Record<string, unknown>) }))
      };
    }));

    const tasksSnap = await getDocs(collection(db, `${path}/tasks`));
    const tasks = tasksSnap.docs.map((d) => ({ id: d.id, ...(serializeTimestamps(d.data()) as Record<string, unknown>) }));

    return {
      exportedAt: new Date().toISOString(),
      uid,
      profile,
      contacts,
      tasks
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
};

// Borrado real de cuenta. Orden deliberado: primero todos los datos de
// Firestore (contactos + sus notas, tareas, el documento de perfil) y solo al
// final la cuenta de Firebase Auth — así, si el paso de Auth falla, los datos
// personales ya quedaron borrados de todas formas (lo más sensible desde el
// punto de vista de privacidad) y lo único pendiente es el registro de acceso.
//
// HONESTIDAD sobre "auth/requires-recent-login": Firebase exige que la sesión
// sea reciente para dejar borrar la cuenta de Auth (evita que una sesión
// robada/vieja borre la cuenta de otra persona). Si `deleteUser` falla con ese
// código, los pasos de Firestore de esta función YA se ejecutaron con éxito —
// el perfil, los contactos y las tareas ya no existen, pero la cuenta de Auth
// sigue viva. La UI debe explicarle esto al usuario y pedirle que cierre
// sesión, vuelva a iniciarla de inmediato, y repita el borrado de cuenta. Por
// eso todos los deletes de Firestore de aquí son idempotentes (borrar un
// documento que ya no existe no falla en Firestore) — un segundo intento
// sobre datos ya borrados no debe reventar.
export const deleteAccount = async (uid: string): Promise<void> => {
  const path = `users/${uid}`;
  try {
    const contactsSnap = await getDocs(collection(db, `${path}/contacts`));
    for (const contactDoc of contactsSnap.docs) {
      const commentsSnap = await getDocs(collection(contactDoc.ref, 'comments'));
      await Promise.all(commentsSnap.docs.map((c) => deleteDoc(c.ref)));
      await deleteDoc(contactDoc.ref);
    }

    const tasksSnap = await getDocs(collection(db, `${path}/tasks`));
    await Promise.all(tasksSnap.docs.map((t) => deleteDoc(t.ref)));

    await deleteDoc(doc(db, path));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }

  // Deliberadamente fuera del try/catch de arriba: si esto lanza
  // auth/requires-recent-login, queremos que el error original (con su
  // `.code` intacto) llegue tal cual a quien llamó a deleteAccount, en vez de
  // quedar envuelto por handleFirestoreError (que es para errores de
  // Firestore, no de Auth).
  if (auth.currentUser) {
    await deleteUser(auth.currentUser);
  }
};

// Fotos de perfil/empresa: se suben a Storage y solo la URL resultante se
// guarda en Firestore (los documentos tienen un límite de 1 MB, y una foto en
// base64 podía superarlo).
export const uploadImage = async (path: string, file: Blob): Promise<string> => {
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
};

// Los formularios de perfil/empresa previsualizan la foto como base64 (FileReader)
// antes de que exista un uid al que subirla. Esto sube esa preview a Storage justo
// antes de guardar y devuelve la URL — si ya es una URL normal (avatar por defecto,
// no tocado), la deja igual.
// Firebase Storage no está activado en este proyecto todavía (exige plan Blaze,
// rechazado por decisión del usuario — ver Fase 0 del plan de eg-connect). Antes,
// esta función igual INTENTABA subir a Storage en cada registro/edición con foto —
// la llamada estaba condenada a fallar siempre, pero el SDK tarda varios segundos
// en darse por vencido antes de caer al base64, así que cada onboarding con foto
// se sentía "colgado" sin motivo real (reportado por el usuario en producción).
// Ahora, mientras VITE_FIREBASE_STORAGE_ENABLED no esté en 'true', ni se intenta —
// va directo al base64, igual de bien mientras el bucket no exista, pero al
// instante. El día que se active Storage, basta con poner esa variable en true.
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

// Contactos guardados por el usuario (CRM / escaneo de tarjetas).
export const addContact = async (ownerId: string, contact: Record<string, unknown>) => {
  const path = `users/${ownerId}/contacts`;
  try {
    await addDoc(collection(db, path), {
      ...contact,
      ownerId,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

// Cambia el estado del embudo CRM (Prospecto/Socio/Aliado/Cliente) de un
// contacto guardado — antes ese estado se inventaba en el cliente a partir
// del índice del contacto en el array, y no se podía cambiar ni persistía.
export const updateContactStatus = async (ownerId: string, contactId: string, crmStatus: string) => {
  const path = `users/${ownerId}/contacts/${contactId}`;
  try {
    await updateDoc(doc(db, path), { crmStatus });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// Tareas personales: subcolección privada del propio usuario.
export const createTask = async (ownerId: string, data: Record<string, unknown>) => {
  const path = `users/${ownerId}/tasks`;
  try {
    await addDoc(collection(db, path), {
      ...data,
      completed: false,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const toggleTaskCompletion = async (ownerId: string, taskId: string, completed: boolean) => {
  const path = `users/${ownerId}/tasks/${taskId}`;
  try {
    await updateDoc(doc(db, path), { completed });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteTask = async (ownerId: string, taskId: string) => {
  const path = `users/${ownerId}/tasks/${taskId}`;
  try {
    await deleteDoc(doc(db, path));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// Notas propias sobre un contacto guardado (antes esto vivía solo en
// localStorage con un autor inventado — ahora es una subcolección privada
// real, igual que el resto de datos del dueño del contacto).
export const addContactComment = async (
  ownerId: string,
  contactId: string,
  data: { authorName: string; text: string; parentId?: string | null }
) => {
  const path = `users/${ownerId}/contacts/${contactId}/comments`;
  try {
    await addDoc(collection(db, path), {
      ...data,
      parentId: data.parentId ?? null,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

// "Destacar" un contacto guardado — antes era un contador local que se
// reiniciaba al recargar y nunca llegaba a Firestore; ahora es un campo real
// del propio documento del contacto.
export const toggleContactKudo = async (ownerId: string, contactId: string, add: boolean) => {
  const path = `users/${ownerId}/contacts/${contactId}`;
  try {
    await updateDoc(doc(db, path), { kudos: increment(add ? 1 : -1) });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// Empresas registradas en el ecosistema.
export const createCompany = async (ownerId: string, data: Record<string, unknown>) => {
  const path = 'companies';
  try {
    const docRef = await addDoc(collection(db, path), {
      ...data,
      ownerId,
      isVerified: false,
      verificationStatus: 'pending',
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

// Anuncios del Marketplace.
export const createMarketplacePost = async (authorId: string, data: Record<string, unknown>) => {
  const path = 'marketplace_posts';
  try {
    const docRef = await addDoc(collection(db, path), {
      ...data,
      authorId,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

// Eventos locales: el creador queda como primer asistente automáticamente.
export const createEvent = async (authorId: string, data: Record<string, unknown>) => {
  const path = 'events';
  try {
    const docRef = await addDoc(collection(db, path), {
      ...data,
      authorId,
      attendeeIds: [authorId],
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const toggleEventAttendance = async (eventId: string, uid: string, attending: boolean) => {
  const path = `events/${eventId}`;
  try {
    await updateDoc(doc(db, path), {
      attendeeIds: attending ? arrayUnion(uid) : arrayRemove(uid)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// Panel de administrador — solo un admin ya existente puede promover a otro
// (las reglas de Firestore lo exigen; esto es un atajo, no el control real).
export const setUserAdmin = async (targetUid: string, isAdmin: boolean) => {
  const path = `users/${targetUid}`;
  try {
    await updateDoc(doc(db, path), { isAdmin });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const createTender = async (data: Record<string, unknown>) => {
  const path = 'tenders';
  try {
    const docRef = await addDoc(collection(db, path), {
      ...data,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const deleteTender = async (tenderId: string) => {
  const path = `tenders/${tenderId}`;
  try {
    await deleteDoc(doc(db, path));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const setCompanyVerified = async (companyId: string, isVerified: boolean) => {
  const path = `companies/${companyId}`;
  try {
    await updateDoc(doc(db, path), {
      isVerified,
      verificationStatus: isVerified ? 'verified' : 'pending'
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const submitFeedback = async (userId: string, data: Record<string, unknown>) => {
  const path = 'feedback';
  try {
    await addDoc(collection(db, path), {
      ...data,
      userId,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

// Solicitudes de conexión con inversionistas — reemplaza el chat abierto
// directo: el emprendedor propone, el inversionista decide.
export const createConnectionRequest = async (fromUid: string, data: Record<string, unknown>) => {
  const path = 'connectionRequests';
  try {
    const docRef = await addDoc(collection(db, path), {
      ...data,
      fromUid,
      status: 'pending',
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const respondToConnectionRequest = async (requestId: string, status: 'accepted' | 'declined') => {
  const path = `connectionRequests/${requestId}`;
  try {
    await updateDoc(doc(db, path), { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// Iniciativas y Proyectos: el creador queda como primer miembro automáticamente.
export const createInitiative = async (creatorId: string, data: Record<string, unknown>) => {
  const path = 'initiatives';
  try {
    const docRef = await addDoc(collection(db, path), {
      ...data,
      creatorId,
      members: [creatorId],
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const toggleInitiativeMembership = async (initiativeId: string, uid: string, joining: boolean) => {
  const path = `initiatives/${initiativeId}`;
  try {
    await updateDoc(doc(db, path), {
      members: joining ? arrayUnion(uid) : arrayRemove(uid)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// Conversaciones 1-a-1: id determinista (uids ordenados) para no crear
// duplicados cuando dos personas se escriben por primera vez desde lados distintos.
export const getOrCreateConversation = async (
  currentUid: string,
  participant: { id: string; name: string; avatar: string }
) => {
  const conversationId = [currentUid, participant.id].sort().join('_');
  const path = `conversations/${conversationId}`;
  try {
    const ref = doc(db, path);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        isGroup: false,
        participants: [currentUid, participant.id],
        lastMessage: '',
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });
    }
    return conversationId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const createGroupConversation = async (
  currentUid: string,
  groupName: string,
  groupAvatar: string,
  participantIds: string[]
) => {
  const path = 'conversations';
  try {
    const docRef = await addDoc(collection(db, path), {
      isGroup: true,
      groupName,
      groupAvatar,
      participants: [currentUid, ...participantIds],
      lastMessage: 'Grupo creado',
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

// Añadir un integrante real a un grupo existente — el botón UserPlus en
// ChatScreen no tenía onClick antes de esto. Solo suma (arrayUnion), nunca
// quita a nadie; ver la regla de update de conversations en firestore.rules.
export const addParticipantToGroup = async (conversationId: string, newUid: string) => {
  const path = `conversations/${conversationId}`;
  try {
    await updateDoc(doc(db, path), { participants: arrayUnion(newUid) });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const sendMessage = async (
  conversationId: string,
  senderId: string,
  message: { text?: string; type: 'text' | 'audio'; audioUrl?: string; audioDuration?: number }
) => {
  const path = `conversations/${conversationId}`;
  try {
    const conversationRef = doc(db, path);
    await addDoc(collection(conversationRef, 'messages'), {
      senderId,
      ...message,
      createdAt: serverTimestamp()
    });
    await updateDoc(conversationRef, {
      lastMessage: message.type === 'audio' ? '🎤 Mensaje de voz' : (message.text || ''),
      lastMessageAt: serverTimestamp(),
      lastSenderId: senderId
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// Antes unreadMessageCount vivía hardcodeado en 0 en App.tsx — el badge de
// mensajes no leídos nunca podía encender. `readReceipts` guarda, por
// conversación, cuándo leyó cada participante por última vez (solo su
// propia entrada del mapa — ver la regla de update en firestore.rules).
export const markConversationRead = async (conversationId: string, uid: string) => {
  const path = `conversations/${conversationId}`;
  try {
    await updateDoc(doc(db, path), { [`readReceipts.${uid}`]: serverTimestamp() });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
