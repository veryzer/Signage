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

// Export database and auth helpers if needed
const db = firebase.database();
const auth = firebase.auth();

let _firebaseInitialized = false;

function initFirebase() {
  if (_firebaseInitialized) return;
  if (typeof firebase === "undefined") {
    console.error("Firebase SDK script failed to load.");
    return;
  }
  firebase.initializeApp(FirebaseConfig);
  _firebaseInitialized = true;
}

window.FirebaseConfig = FirebaseConfig;
window.initFirebase = initFirebase;
window.getDatabase = function () {
  initFirebase();
  return firebase.database();
};
