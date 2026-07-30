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
  sendPasswordResetEmail
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  getDocFromServer,
  Timestamp,
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();
export const storage = getStorage(app);
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
export const uploadAvatarIfNeeded = async (path: string, avatarValue: string): Promise<string> => {
  if (!avatarValue || !avatarValue.startsWith('data:')) return avatarValue;
  const blob = await (await fetch(avatarValue)).blob();
  return uploadImage(path, blob);
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
      lastMessageAt: serverTimestamp()
    });
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
