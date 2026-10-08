/**
 * Firebase Configuration
 *
 * Replace the values below with your own Firebase project configuration.
 * Create a Firebase project at https://console.firebase.google.com and copy
 * the client-side configuration object from Project Settings > General.
 */
const FirebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_IDfirebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  databaseURL: "https://YOUR_PROJECT_ID-rtdb.firebaseio.com"
};

// Initialize Firebase SDKs lazily to avoid errors when running offline.
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

// Expose helpers for consumers.
window.FirebaseConfig = FirebaseConfig;
window.initFirebase = initFirebase;
window.getDatabase = function () {
  initFirebase();
  return firebase.database();
};
window.getAuth = function () {
  initFirebase();
  return firebase.auth();
};