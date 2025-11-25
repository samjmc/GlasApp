import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut, onAuthStateChanged, type User } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_PROJECT_ID + ".firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_PROJECT_ID + ".appspot.com",
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase only if it hasn't been initialized already
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Handle redirect result immediately when this module loads
getRedirectResult(auth)
  .then((result) => {
    if (result) {
      console.log("Redirect sign-in successful:", result.user);
      // Firebase auth state will automatically update
    } else {
      console.log("No redirect result found.");
    }
  })
  .catch((error) => {
    console.error("Error getting redirect result:", error);
  });

export const signInWithGoogle = async () => {
  try {
    // Debug: Log complete Firebase configuration
    console.log('Complete Firebase config:', firebaseConfig);
    console.log("Origin:", window.location.origin);
    console.log('Environment variables check:', {
      VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY?.substring(0, 10) + '...',
      VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID?.substring(0, 10) + '...',
      currentOrigin: window.location.origin,
      currentHostname: window.location.hostname,
      protocol: window.location.protocol,
      port: window.location.port
    });
    
    if (!import.meta.env.VITE_FIREBASE_API_KEY) {
      throw new Error('Firebase API key not configured');
    }
    
    // Try popup first (more flexible for development)
    console.log('Trying popup authentication...');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log('Popup sign-in successful:', result.user);
      return result;
    } catch (popupError: any) {
      console.log('Popup sign-in failed:', popupError);
      
      // If popup fails due to domain issues, provide clear guidance
      if (popupError.code === 'auth/unauthorized-domain') {
        console.log('Domain authorization failed. Current domain:', window.location.hostname);
        console.log('Add this domain to Firebase Console → Authentication → Settings → Authorized domains');
        throw new Error(`Domain '${window.location.hostname}' not authorized. Add it to Firebase authorized domains.`);
      }
      
      // If popup was blocked, provide guidance instead of redirect fallback
      if (popupError.code === 'auth/popup-blocked') {
        throw new Error('Popup was blocked by browser. Please allow popups for this site and try again.');
      }
      
      if (popupError.code === 'auth/cancelled-popup-request') {
        throw new Error('Sign-in was cancelled. Please try again.');
      }
      
      throw popupError;
    }
    
  } catch (error: any) {
    console.error('Firebase sign-in error:', error);
    throw error;
  }
};

export const handleRedirectResult = () => {
  return getRedirectResult(auth);
};

export const signOutUser = () => {
  return signOut(auth);
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export type { User };