
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc, 
  collection, 
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp 
} from "firebase/firestore";

/**
 * IMPORTANTE: REGLAS DE FIRESTORE REQUERIDAS
 * -----------------------------------------
 * Copia esto en la pestaña "Rules" de Firestore en Firebase Console:
 * 
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     match /email_logs/{logId} {
 *       allow read: if request.auth != null;
 *       allow create: if request.auth != null;
 *       allow delete: if request.auth.token.email == "gerito.diseno@gmail.com";
 *     }
 *     match /whitelisted_users/{user} {
 *       allow read: if request.auth != null;
 *       allow write: if request.auth.token.email == "gerito.diseno@gmail.com";
 *     }
 *   }
 * }
 */

const firebaseConfig = {
  apiKey: "AIzaSyAJpDIsjfgY70m87mg74y3oaEElkyTvyM0",
  authDomain: "ukmails-45f8c.firebaseapp.com",
  projectId: "ukmails-45f8c",
  storageBucket: "ukmails-45f8c.firebasestorage.app",
  messagingSenderId: "587820280661",
  appId: "1:587820280661:web:c50abc80fc9bf4f390dddc",
  measurementId: "G-874GW6WLJ4"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export const ADMIN_EMAIL = "gerito.diseno@gmail.com";
const COLLECTION_NAME = "whitelisted_users";
const LOGS_COLLECTION = "email_logs";

export const isUserAuthorized = async (email: string): Promise<boolean> => {
  if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return true;
  try {
    const docRef = doc(db, COLLECTION_NAME, email.toLowerCase());
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  } catch (e) {
    return false;
  }
};

export const addAuthorizedUser = async (email: string, adminEmail: string) => {
  const emailLower = email.toLowerCase();
  await setDoc(doc(db, COLLECTION_NAME, emailLower), {
    email: emailLower,
    addedAt: Date.now(),
    addedBy: adminEmail
  });
};

export const removeAuthorizedUser = async (email: string) => {
  await deleteDoc(doc(db, COLLECTION_NAME, email.toLowerCase()));
};

export const deleteEmailLog = async (logId: string) => {
  try {
    const docRef = doc(db, LOGS_COLLECTION, logId);
    await deleteDoc(docRef);
    return { success: true };
  } catch (error: any) {
    console.error("Firestore Delete Error:", error);
    throw error;
  }
};

export const saveEmailLog = async (logData: {
  templateName: string;
  templateId: string;
  count: number;
  status: 'success' | 'error' | 'cancelled';
  fromEmail: string;
  error?: string;
}) => {
  try {
    const user = auth.currentUser;
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    const docData = {
      templateName: logData.templateName || "Sin Nombre",
      templateId: logData.templateId || "N/A",
      count: Number(logData.count) || 0,
      status: logData.status || "unknown",
      fromEmail: logData.fromEmail || "info@ukuepa.com",
      error: logData.error || "",
      userEmail: user?.email || 'sistema@ukuepa.com',
      userUid: user?.uid || 'system',
      timestamp: Date.now(),
      dbTimestamp: serverTimestamp(),
      createdAt: new Date().toISOString()
    };
    
    const docRef = doc(db, LOGS_COLLECTION, logId);
    await setDoc(docRef, docData);
    return true;
  } catch (e: any) {
    console.error("Error saving log:", e.message);
    return false;
  }
};
