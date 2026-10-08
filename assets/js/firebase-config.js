/**
 * Firebase Configuration Template
 * Replace placeholders with your project values from Firebase Console -> Project Settings
 */
const firebaseConfig = {
    apiKey: "AIzaSyDW1rXbbXocBKE8u40lHjcLnH_JXLMFyTM",
    authDomain: "tlvp-signage.firebaseapp.com",
    databaseURL: "https://tlvp-signage-default-rtdb.firebaseio.com", // <-- Add this line
    projectId: "tlvp-signage",
    storageBucket: "tlvp-signage.firebasestorage.app",
    messagingSenderId: "843561145964",
    appId: "1:843561145964:web:e73a0f9c6c576a56f6aa49",
    measurementId: "G-5WLCRWGKNQ"
};

// Initialize Firebase (using your existing config keys)
firebase.initializeApp(firebaseConfig);

// Provide the helper function that app.js is looking for
window.getDatabase = function() {
    return firebase.database();
};
