/** 
 * receiver app.js
 * Chromecast Receiver Application 
 */
document.addEventListener("DOMContentLoaded", () => {
 let context = null;
try {
    context = cast.framework.CastReceiverContext.getInstance();
} catch (e) {
    console.log("Running outside of Cast environment");
}
 const db = window.getDatabase();

 // Get or create persistent device ID
 let deviceId = localStorage.getItem("signage_device_id");
 if (!deviceId) {
   deviceId = "dev_" + Math.random().toString(36).substring(2, 9);
   localStorage.setItem("signage_device_id", deviceId);
 }

 const deviceRef = db.ref(`devices/${deviceId}`);
 let currentPlaylistId = null;

 // Generate 4-character pairing code if unassigned
 function generatePairingCode() {
   const code = Math.random().toString(36).substring(2, 6).toUpperCase();
   db.ref(`unpaired_devices/${code}`).set({
     deviceId: deviceId,
     created: Date.now()
   });
document.getElementById("pairingCode").innerText = code;
    document.getElementById("pairing-screen").classList.remove("hidden");
    document.getElementById("stage").classList.add("hidden");
 }

 // Listen to device assignments in Firebase
 deviceRef.on("value", (snapshot) => {
   const data = snapshot.val();
   if (!data) {
     generatePairingCode();
   } else {
document.getElementById("pairing-screen").classList.add("hidden");
      document.getElementById("stage").classList.remove("hidden");
     if (data.currentPlaylistId !== currentPlaylistId) {
       currentPlaylistId = data.currentPlaylistId;
       loadPlaylist(currentPlaylistId);
     }
   }
 });

 // Heartbeat every 30 seconds
 setInterval(() => {
   deviceRef.child("lastSeen").set(Date.now());
 }, 30000);

if (context) {
    context.start();
}
});

function loadPlaylist(playlistId) {
 if (!playlistId) return;
 const db = window.getDatabase();
 db.ref(`playlists/${playlistId}`).once("value", (snapshot) => {
   const playlist = snapshot.val();
   if (playlist && playlist.slides) {
     runSlideshow(playlist.slides);
   }
 });
}

function runSlideshow(slides) {
    if (!slides || slides.length === 0) {
      document.getElementById("stage").innerHTML = "";
      return;
    }
    let index = 0;
    const stage = document.getElementById("stage");
    stage.style.opacity = 1;

    function showNext() {
      const slide = slides[index];
      stage.style.opacity = 0;
      setTimeout(() => {
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

      index = (index + 1) % slides.length;
      setTimeout(showNext, (slide.durationSec || 10) * 1000);
    }
    showNext();
  }
