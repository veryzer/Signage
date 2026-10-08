/**
 * Firebase Configuration Template
 * Replace placeholders with your project values from Firebase Console -> Project Settings
 */
const firebaseConfig = {
  apiKey: "AIzaSyDW1rXbbXocBKE8u40lHjcLnH_JXLMFyTM",
  authDomain: "tlvp-signage.firebaseapp.com",
  projectId: "tlvp-signage",
  storageBucket: "tlvp-signage.firebasestorage.app",
  messagingSenderId: "843561145964",
  appId: "1:843561145964:web:e73a0f9c6c576a56f6aa49",
  measurementId: "G-5WLCRWGKNQ"
};

// Initialize Firebase (Compat SDK style)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Export database and auth helpers
const db = firebase.database();

window.firebaseConfig = firebaseConfig;
window.db = db;
