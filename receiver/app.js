/** 
 * receiver app.js
 * Chromecast Receiver Application 
 */
document.addEventListener("DOMContentLoaded", () => {
  let context = null;
  try {
    if (window.cast && cast.framework && cast.framework.CastReceiverContext) {
      context = cast.framework.CastReceiverContext.getInstance();
    }
  } catch (e) {
    console.log("Running outside of Cast environment", e);
  }

  const db = window.getDatabase();

  // Status Badge handling (Online / Offline based on Firebase connection)
  const statusBadge = document.getElementById("statusBadge");
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

  // Get or create persistent device ID
  let deviceId = localStorage.getItem("signage_device_id");
  if (!deviceId) {
    deviceId = "dev_" + Math.random().toString(36).substring(2, 9);
    localStorage.setItem("signage_device_id", deviceId);
  }

  const deviceRef = db.ref(`devices/${deviceId}`);
  let currentPlaylistId = null;
  let currentPlaylistRef = null;
  let activePairingCode = null;

  // Manage pairing screen & code
  function showPairingScreen() {
    stopSlideshow();
    document.getElementById("stage").classList.add("hidden");
    document.getElementById("pairing-screen").classList.remove("hidden");

    if (!activePairingCode) {
      activePairingCode = Math.random().toString(36).substring(2, 6).toUpperCase();

      // Clean up any stale unpaired codes for this deviceId first
      db.ref("unpaired_devices").orderByChild("deviceId").equalTo(deviceId).once("value", (snap) => {
        if (snap.exists()) {
          snap.forEach((child) => {
            child.ref.remove();
          });
        }
        // Save current active pairing code in Firebase
        db.ref(`unpaired_devices/${activePairingCode}`).set({
          deviceId: deviceId,
          created: Date.now()
        });
      });

      document.getElementById("pairingCode").innerText = activePairingCode;
    }
  }

  function hidePairingScreen() {
    if (activePairingCode) {
      db.ref(`unpaired_devices/${activePairingCode}`).remove();
      activePairingCode = null;
    }
    // Clean up any other orphaned codes for this device
    db.ref("unpaired_devices").orderByChild("deviceId").equalTo(deviceId).once("value", (snap) => {
      if (snap.exists()) {
        snap.forEach((child) => {
          child.ref.remove();
        });
      }
    });

    document.getElementById("pairing-screen").classList.add("hidden");
    document.getElementById("stage").classList.remove("hidden");
  }

  // Listen to device assignments in Firebase
  deviceRef.on("value", (snapshot) => {
    const data = snapshot.val();
    // Device is considered paired if explicit paired flag is true or a playlist is assigned
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
        // Paired, but no playlist assigned yet
        currentPlaylistId = null;
        if (currentPlaylistRef) {
          currentPlaylistRef.off();
          currentPlaylistRef = null;
        }
        stopSlideshow();
        const stage = document.getElementById("stage");
        stage.innerHTML = `
          <div style="color: #888; text-align: center; font-family: inherit;">
            <h2 style="font-size: 2rem; margin-bottom: 0.5rem; color: #fff;">Display Paired</h2>
            <p style="font-size: 1.1rem; color: #aaa;">Awaiting playlist assignment from dashboard...</p>
          </div>
        `;
        stage.style.opacity = 1;
      }
    }
  });

  // Listen to active playlist changes
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
        const stage = document.getElementById("stage");
        stage.innerHTML = `
          <div style="color: #888; text-align: center;">
            <p style="font-size: 1.2rem; color: #aaa;">Playlist is empty</p>
          </div>
        `;
        stage.style.opacity = 1;
      }
    });
  }

  // Flash / Emergency message listener
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

  // Heartbeat & Presence
  function sendHeartbeat() {
    deviceRef.child("lastSeen").set(Date.now());
    deviceRef.child("online").set(true);
  }

  // Send initial presence & setup onDisconnect
  sendHeartbeat();
  deviceRef.child("online").onDisconnect().set(false);
  deviceRef.child("lastSeen").onDisconnect().set(Date.now());

  // Heartbeat every 30 seconds
  setInterval(sendHeartbeat, 30000);

  if (context) {
    context.start();
  }
});

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
