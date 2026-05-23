import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, deleteDoc } from 'firebase/firestore';

export interface AppConfig {
  escalaApiKey?: string;
  escalaAccountId?: string;
  escalaIsActive?: boolean;
  trainingData?: string;
  userId: string;
}

export interface CrmLog {
  id: string;
  timestamp: string;
  customerName: string;
  summary: string;
  actionTaken: string;
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  provider?: 'Internal' | 'Escala';
  userId: string;
}

export interface CallRecording {
  id: string;
  name: string;
  timestamp: string;
  duration: string;
  blobUrl?: string;
  transcript?: string;
  userId: string;
}

export const getUserId = (): string | null => {
  return auth.currentUser?.uid || (sessionStorage.getItem('unitec_local_admin') === 'true' ? 'mock_unitec_admin' : null);
};

// AppConfig
export const getAppConfig = async (): Promise<AppConfig | null> => {
  const userId = getUserId();
  if (!userId) return null;

  const path = `users/${userId}/config/main`;
  try {
    const docRef = doc(db, path);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as AppConfig;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const saveAppConfig = async (config: Partial<AppConfig>): Promise<void> => {
  const userId = getUserId();
  if (!userId) throw new Error("User not authenticated");

  const path = `users/${userId}/config/main`;
  try {
    const docRef = doc(db, path);
    await setDoc(docRef, { ...config, userId }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// CrmLog
export const getCrmLogs = async (): Promise<CrmLog[]> => {
  const userId = getUserId();
  if (!userId) return [];

  const path = `users/${userId}/crmLogs`;
  try {
    const q = query(collection(db, path), orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as CrmLog);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const addCrmLog = async (log: Omit<CrmLog, 'userId'>): Promise<void> => {
  const userId = getUserId();
  if (!userId) throw new Error("User not authenticated");

  const path = `users/${userId}/crmLogs/${log.id}`;
  try {
    const docRef = doc(db, path);
    await setDoc(docRef, { ...log, userId });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

// CallRecording
export const getCallRecordings = async (): Promise<CallRecording[]> => {
  const userId = getUserId();
  if (!userId) return [];

  const path = `users/${userId}/callRecordings`;
  try {
    const q = query(collection(db, path), orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as CallRecording);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const addCallRecording = async (recording: Omit<CallRecording, 'userId'>): Promise<void> => {
  const userId = getUserId();
  if (!userId) throw new Error("User not authenticated");

  const path = `users/${userId}/callRecordings/${recording.id}`;
  try {
    const docRef = doc(db, path);
    await setDoc(docRef, { ...recording, userId });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const deleteCallRecording = async (recordingId: string): Promise<void> => {
  const userId = getUserId();
  if (!userId) throw new Error("User not authenticated");

  const path = `users/${userId}/callRecordings/${recordingId}`;
  try {
    const docRef = doc(db, path);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};
