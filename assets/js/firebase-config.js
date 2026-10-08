/**
 * Firebase Configuration Template
 * Replace placeholders with your project values from Firebase Console -> Project Settings
 */
const FirebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com"
};

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