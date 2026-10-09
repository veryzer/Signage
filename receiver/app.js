/** 
 * receiver app.js
 * Chromecast Receiver Application 
 */

// Fallback Firebase Config in case firebase-config.js fails to load
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDW1rXbbXocBKE8u40lHjcLnH_JXLMFyTM",
  authDomain: "tlvp-signage.firebaseapp.com",
  databaseURL: "https://tlvp-signage-default-rtdb.firebaseio.com",
  projectId: "tlvp-signage",
  storageBucket: "tlvp-signage.firebasestorage.app",
  messagingSenderId: "843561145964",
  appId: "1:843561145964:web:e73a0f9c6c576a56f6aa49",
  measurementId: "G-5WLCRWGKNQ"
};

function getSafeDeviceId() {
  try {
    let id = localStorage.getItem("signage_device_id");
    if (!id) {
      id = "dev_" + Math.random().toString(36).substring(2, 9);
      localStorage.setItem("signage_device_id", id);
    }
    return id;
  } catch (e) {
    if (!window._signage_device_id) {
      window._signage_device_id = "dev_" + Math.random().toString(36).substring(2, 9);
    }
    return window._signage_device_id;
  }
}

function getSafeDatabase() {
  if (typeof window.getDatabase === "function") {
    try {
      return window.getDatabase();
    } catch (e) {
      console.warn("window.getDatabase() error:", e);
    }
  }
  if (typeof firebase !== "undefined" && firebase.database) {
    try {
      if (!firebase.apps || !firebase.apps.length) {
        firebase.initializeApp(window.firebaseConfig || DEFAULT_FIREBASE_CONFIG);
      }
      return firebase.database();
    } catch (e) {
      console.error("Direct firebase.initializeApp error:", e);
    }
  }
  return null;
}

function initReceiverApp() {
  // 1. Immediately show a 4-character pairing code so the screen is never stuck on '----'
  let activePairingCode = null;
  const pairingCodeEl = document.getElementById("pairingCode");
  const pairingScreenEl = document.getElementById("pairing-screen");
  const stageEl = document.getElementById("stage");
  const statusBadge = document.getElementById("statusBadge");

  try {
    activePairingCode = sessionStorage.getItem("signage_pairing_code");
  } catch (e) {}

  if (!activePairingCode) {
    activePairingCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    try {
      sessionStorage.setItem("signage_pairing_code", activePairingCode);
    } catch (e) {}
  }

  if (pairingCodeEl) {
    pairingCodeEl.innerText = activePairingCode;
  }

  // 2. Safely initialize Google Cast Web Receiver Context
  try {
    if (window.cast && cast.framework && cast.framework.CastReceiverContext) {
      const context = cast.framework.CastReceiverContext.getInstance();
      const options = new cast.framework.CastReceiverOptions();
      options.disableIdleTimeout = true;
      options.maxInactivity = 86400; // 24 hours
      context.start(options);
    }
  } catch (e) {
    console.log("Cast Receiver Context note:", e);
  }

  // 3. Obtain Firebase Database
  const db = getSafeDatabase();
  if (!db) {
    if (statusBadge) {
      statusBadge.textContent = "Offline (SDK error)";
      statusBadge.style.color = "#f87171";
    }
    console.error("Firebase Database could not be initialized.");
    return;
  }

  // 4. Update status badge dynamically (Online / Offline)
  const connectedRef = db.ref(".info/connected");
  connectedRef.on("value", (snap) => {
    const isConnected = snap.val() === true;
    if (statusBadge) {
      statusBadge.textContent = isConnected ? "Online" : "Offline";
      statusBadge.style.color = isConnected ? "#4ade80" : "#f87171";
      statusBadge.style.background = isConnected ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)";
      statusBadge.style.border = isConnected ? "1px solid rgba(74, 222, 128, 0.3)" : "1px solid rgba(248, 113, 113, 0.3)";
    }
  });

  const deviceId = getSafeDeviceId();
  const deviceRef = db.ref(`devices/${deviceId}`);
  let currentPlaylistId = null;
  let currentPlaylistRef = null;

  function registerPairingCodeInFirebase() {
    if (!activePairingCode) return;

    // Publish active pairing code to Firebase
    db.ref(`unpaired_devices/${activePairingCode}`).set({
      deviceId: deviceId,
      created: Date.now()
    }).catch((err) => {
      console.warn("Could not write unpaired code:", err);
    });
  }

  function showPairingScreen() {
    stopSlideshow();
    if (stageEl) stageEl.classList.add("hidden");
    if (pairingScreenEl) pairingScreenEl.classList.remove("hidden");
    if (pairingCodeEl) pairingCodeEl.innerText = activePairingCode;

    registerPairingCodeInFirebase();
  }

  function hidePairingScreen() {
    if (activePairingCode) {
      db.ref(`unpaired_devices/${activePairingCode}`).remove().catch(() => {});
    }
    if (pairingScreenEl) pairingScreenEl.classList.add("hidden");
    if (stageEl) stageEl.classList.remove("hidden");
  }

  // Initial pairing code registration
  registerPairingCodeInFirebase();

  // 5. Listen to device assignments in Firebase
  deviceRef.on("value", (snapshot) => {
    const data = snapshot.val();
    const isPaired = Boolean(data && (data.paired === true || (data.paired !== false && data.currentPlaylistId)));

    if (!isPaired) {
      showPairingScreen();
    } else {
      hidePairingScreen();

      if (data.currentPlaylistId) {
        if (data.currentPlaylistId !== currentPlaylistId) {
          currentPlaylistId = data.currentPlaylistId;
          listenToPlaylist(currentPlaylistId);
        }
      } else {
        currentPlaylistId = null;
        if (currentPlaylistRef) {
          currentPlaylistRef.off();
          currentPlaylistRef = null;
        }
        stopSlideshow();
        if (stageEl) {
          stageEl.innerHTML = `
            <div style="color: #888; text-align: center; font-family: inherit;">
              <h2 style="font-size: 2rem; margin-bottom: 0.5rem; color: #fff;">Display Paired</h2>
              <p style="font-size: 1.1rem; color: #aaa;">Awaiting playlist assignment from dashboard...</p>
            </div>
          `;
          stageEl.style.opacity = 1;
        }
      }
    }
  });

  // 5b. Listen for sender-initiated sessions (welcome slide from pairing code)
  if (activePairingCode) {
    const sessionRef = db.ref(`sessions/${activePairingCode}`);
    sessionRef.on("value", (snapshot) => {
      const session = snapshot.val();
      if (!session || !session.playlist) return;

      const playlist = session.playlist;
      const slides = Array.isArray(playlist.slides) ? playlist.slides : Object.values(playlist.slides || {});

      if (slides.length > 0) {
        // Show the welcome slide even while unpaired
        if (pairingScreenEl && !pairingScreenEl.classList.contains("hidden")) {
          pairingScreenEl.classList.add("hidden");
        }
        if (stageEl) stageEl.classList.remove("hidden");
        runSlideshow(slides);
      }
    });
  }

  // 6. Listen to active playlist changes
  function listenToPlaylist(playlistId) {
    if (currentPlaylistRef) {
      currentPlaylistRef.off();
    }
    currentPlaylistRef = db.ref(`playlists/${playlistId}`);
    currentPlaylistRef.on("value", (snapshot) => {
      const playlist = snapshot.val();
      if (playlist && playlist.slides) {
        const slides = Array.isArray(playlist.slides) ? playlist.slides : Object.values(playlist.slides);
        runSlideshow(slides);
      } else {
        stopSlideshow();
        if (stageEl) {
          stageEl.innerHTML = `
            <div style="color: #888; text-align: center;">
              <p style="font-size: 1.2rem; color: #aaa;">Playlist is empty</p>
            </div>
          `;
          stageEl.style.opacity = 1;
        }
      }
    });
  }

  // 7. Flash message listener
  deviceRef.child("flashMessage").on("value", (snapshot) => {
    const msg = snapshot.val();
    const flashEl = document.getElementById("flashMessage");
    if (!flashEl) return;

    if (msg) {
      const text = typeof msg === "object" ? msg.text : msg;
      if (text && String(text).trim()) {
        flashEl.innerText = text;
        flashEl.classList.add("show");
        return;
      }
    }
    flashEl.classList.remove("show");
    flashEl.innerText = "";
  });

  // 8. Heartbeat & Presence
  function sendHeartbeat() {
    deviceRef.child("lastSeen").set(Date.now()).catch(() => {});
    deviceRef.child("online").set(true).catch(() => {});
  }

  sendHeartbeat();
  try {
    deviceRef.child("online").onDisconnect().set(false);
    deviceRef.child("lastSeen").onDisconnect().set(Date.now());
  } catch (e) {}

  setInterval(sendHeartbeat, 30000);
}

// Ensure execution regardless of script load timing
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initReceiverApp);
} else {
  initReceiverApp();
}

let slideshowTimer = null;
let fadeTimer = null;

function stopSlideshow() {
  if (slideshowTimer) {
    clearTimeout(slideshowTimer);
    slideshowTimer = null;
  }
  if (fadeTimer) {
    clearTimeout(fadeTimer);
    fadeTimer = null;
  }
}

function runSlideshow(slides) {
  stopSlideshow();

  const slideList = (Array.isArray(slides) ? slides : Object.values(slides || {})).filter(Boolean);
  const stage = document.getElementById("stage");
  if (!stage) return;

  if (slideList.length === 0) {
    stage.innerHTML = "";
    return;
  }

  let index = 0;
  stage.style.opacity = 1;

  function showNext() {
    const slide = slideList[index];
    if (!slide) {
      index = (index + 1) % slideList.length;
      slideshowTimer = setTimeout(showNext, 1000);
      return;
    }

    stage.style.opacity = 0;
    fadeTimer = setTimeout(() => {
      if (slide.type === "image") {
        stage.innerHTML = `<img src="${slide.url}" style="width:100%;height:100%;object-fit:contain;">`;
      } else if (slide.type === "html") {
        stage.innerHTML = `<div class="p-8 text-white w-full h-full flex items-center justify-center">${slide.content || ""}</div>`;
      } else if (slide.type === "iframe") {
        stage.innerHTML = `<iframe src="${slide.url}" style="width:100%;height:100%;border:0;"></iframe>`;
      } else if (slide.type === "video") {
        stage.innerHTML = `<video src="${slide.url}" autoplay muted loop playsinline style="width:100%;height:100%;object-fit:contain;"></video>`;
      } else {
        stage.innerHTML = "";
      }
      stage.style.opacity = 1;
    }, 300);

    const durationSec = Number(slide.durationSec) > 0 ? Number(slide.durationSec) : 10;
    index = (index + 1) % slideList.length;
    slideshowTimer = setTimeout(showNext, durationSec * 1000);
  }

  showNext();
}
