/** 
 * receiver app.js
 * Chromecast Receiver Application 
 */
document.addEventListener("DOMContentLoaded", () => {
 const context = cast.framework.CastReceiverContext.getInstance();
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
   document.getElementById("pairing-code").innerText = code;
   document.getElementById("pairing-screen").classList.remove("hidden");
   document.getElementById("signage-screen").classList.add("hidden");
 }

 // Listen to device assignments in Firebase
 deviceRef.on("value", (snapshot) => {
   const data = snapshot.val();
   if (!data) {
     generatePairingCode();
   } else {
     document.getElementById("pairing-screen").classList.add("hidden");
     document.getElementById("signage-screen").classList.remove("hidden");
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

 context.start();
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
 let index = 0;
 function showNext() {
   if (!slides || slides.length === 0) return;
   const slide = slides[index];
   const container = document.getElementById("slide-container");
   
   if (slide.type === "image") {
     container.innerHTML = `<img src="${slide.url}" class="w-full h-full object-cover">`;
   } else if (slide.type === "html") {
     container.innerHTML = `<div class="p-8 text-white">${slide.content}</div>`;
   }

   index = (index + 1) % slides.length;
   setTimeout(showNext, (slide.durationSec || 10) * 1000);
 }
 showNext();
}
