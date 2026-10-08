/**
 * Signage Dashboard Application
 * Handles display pairing, playlist creation, slide management, and device monitoring.
 */

const CAST_APP_ID = "92F01C3B";

document.addEventListener("DOMContentLoaded", () => {
  const db = window.getDatabase ? window.getDatabase() : firebase.database();
  const appContainer = document.getElementById("app");

  // State
  let devices = {};
  let playlists = {};
  let activePlaylistId = null;

  // Initialize Cast Sender SDK
  window["__onGCastApiAvailable"] = function (isAvailable) {
    if (isAvailable && window.cast && cast.framework) {
      try {
        cast.framework.CastContext.getInstance().setOptions({
          receiverApplicationId: CAST_APP_ID,
          autoJoinPolicy: chrome.cast.AutoJoinPolicy.TAB_AND_ORIGIN_SCOPED,
        });
      } catch (e) {
        console.warn("Cast SDK setup error:", e);
      }
    }
  };

  // Render initial dashboard layout
  appContainer.innerHTML = `
    <header class="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            S
          </div>
          <div>
            <h1 class="text-xl font-bold text-gray-900 leading-tight">TLVP Signage Studio</h1>
            <p class="text-xs text-gray-500">Display Management & Realtime Content Delivery</p>
          </div>
        </div>
        <div class="flex items-center space-x-3">
          <div class="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-xs font-medium text-gray-600">
            <span id="systemStatusDot" class="w-2 h-2 rounded-full bg-yellow-400"></span>
            <span id="systemStatusText">Connecting...</span>
          </div>
          <button id="openPairModalBtn" class="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition">
            <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            Pair New Display
          </button>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <!-- Section 1: Connected Displays -->
      <section class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 class="text-base font-semibold text-gray-900">Displays</h2>
            <p class="text-xs text-gray-500">Active screens paired to this system</p>
          </div>
          <span id="deviceCountBadge" class="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
            0 Displays
          </span>
        </div>
        <div id="devicesList" class="divide-y divide-gray-100">
          <div class="p-8 text-center text-gray-400 text-sm">Loading paired displays...</div>
        </div>
      </section>

      <!-- Section 2: Playlists & Slide Editor -->
      <section class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Playlists Column -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[650px]">
          <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
            <div>
              <h2 class="text-base font-semibold text-gray-900">Playlists</h2>
              <p class="text-xs text-gray-500">Select or create playlists</p>
            </div>
            <button id="createPlaylistBtn" class="text-xs px-2.5 py-1.5 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-md shadow-sm transition">
              + New Playlist
            </button>
          </div>
          <div id="playlistsList" class="flex-1 overflow-y-auto divide-y divide-gray-100 p-2 space-y-1">
            <div class="p-4 text-center text-gray-400 text-xs">No playlists yet</div>
          </div>
        </div>

        <!-- Slides Editor Column -->
        <div class="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[650px]">
          <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
            <div>
              <h2 id="activePlaylistTitle" class="text-base font-semibold text-gray-900">Select a Playlist</h2>
              <p id="activePlaylistSubtitle" class="text-xs text-gray-500">Configure slides for this playlist</p>
            </div>
            <div class="flex items-center space-x-2">
              <button id="addSlideBtn" disabled class="disabled:opacity-40 disabled:cursor-not-allowed text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm transition">
                + Add Slide
              </button>
            </div>
          </div>
          <div id="slidesContainer" class="flex-1 overflow-y-auto p-6 space-y-4">
            <div class="h-full flex items-center justify-center text-gray-400 text-sm">
              Select or create a playlist on the left to start adding slides.
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- Modal: Pair Display -->
    <div id="pairModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-100">
        <div class="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-lg font-bold text-gray-900">Pair New Display</h3>
          <button id="closePairModalBtn" class="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <form id="pairForm" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              4-Character Pairing Code
            </label>
            <input
              type="text"
              id="pairingCodeInput"
              required
              maxlength="4"
              placeholder="e.g. HQYX"
              class="w-full text-center text-3xl font-mono font-bold tracking-widest uppercase px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            />
            <p class="text-xs text-gray-500 mt-1">Found on the bottom of the unassigned screen.</p>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Display Name
            </label>
            <input
              type="text"
              id="deviceNameInput"
              required
              placeholder="e.g. Lobby Entrance Screen"
              class="w-full text-sm px-3.5 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            />
          </div>
          <div id="pairError" class="text-xs text-red-600 hidden font-medium"></div>
          <div class="pt-2 flex justify-end space-x-3">
            <button type="button" id="cancelPairBtn" class="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" id="submitPairBtn" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition">
              Connect Display
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal: Flash Message -->
    <div id="flashModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-100">
        <div class="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-lg font-bold text-gray-900">Broadcast Flash Message</h3>
          <button id="closeFlashModalBtn" class="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <form id="flashForm" class="p-6 space-y-4">
          <input type="hidden" id="flashTargetDeviceId" />
          <div>
            <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Message Text
            </label>
            <textarea
              id="flashMessageInput"
              rows="3"
              required
              placeholder="e.g. Welcome VIP guests to TLVP!"
              class="w-full text-sm px-3.5 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            ></textarea>
            <p class="text-xs text-gray-500 mt-1">This will display immediately over the active content.</p>
          </div>
          <div class="pt-2 flex justify-between items-center">
            <button type="button" id="clearFlashBtn" class="text-xs text-red-600 hover:underline">
              Clear Current Message
            </button>
            <div class="flex space-x-2">
              <button type="button" id="cancelFlashBtn" class="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition">
                Send to Display
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;

  // System connection listener
  db.ref(".info/connected").on("value", (snap) => {
    const isConnected = snap.val() === true;
    const dot = document.getElementById("systemStatusDot");
    const text = document.getElementById("systemStatusText");
    if (dot && text) {
      dot.className = `w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-red-500"}`;
      text.textContent = isConnected ? "System Online" : "Disconnected";
    }
  });

  // Modal handlers
  const pairModal = document.getElementById("pairModal");
  const openPairModalBtn = document.getElementById("openPairModalBtn");
  const closePairModalBtn = document.getElementById("closePairModalBtn");
  const cancelPairBtn = document.getElementById("cancelPairBtn");
  const pairForm = document.getElementById("pairForm");
  const pairingCodeInput = document.getElementById("pairingCodeInput");
  const deviceNameInput = document.getElementById("deviceNameInput");
  const pairError = document.getElementById("pairError");

  openPairModalBtn.addEventListener("click", () => {
    pairError.classList.add("hidden");
    pairForm.reset();
    pairModal.classList.remove("hidden");
    pairingCodeInput.focus();
  });

  const hidePairModal = () => pairModal.classList.add("hidden");
  closePairModalBtn.addEventListener("click", hidePairModal);
  cancelPairBtn.addEventListener("click", hidePairModal);

  // Pair form submission
  pairForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    pairError.classList.add("hidden");
    const code = pairingCodeInput.value.trim().toUpperCase();
    const name = deviceNameInput.value.trim();

    if (!code || code.length !== 4) {
      pairError.textContent = "Please enter a valid 4-character code.";
      pairError.classList.remove("hidden");
      return;
    }

    try {
      const snap = await db.ref(`unpaired_devices/${code}`).once("value");
      const unpairedData = snap.val();

      if (!unpairedData || !unpairedData.deviceId) {
        pairError.textContent = "Display code not found or has expired. Make sure the screen is turned on.";
        pairError.classList.remove("hidden");
        return;
      }

      const targetDeviceId = unpairedData.deviceId;

      // Assign device in Firebase
      await db.ref(`devices/${targetDeviceId}`).update({
        name: name,
        paired: true,
        pairedAt: Date.now(),
        currentPlaylistId: activePlaylistId || Object.keys(playlists)[0] || null,
      });

      // Remove pairing code from unpaired_devices pool
      await db.ref(`unpaired_devices/${code}`).remove();

      hidePairModal();
    } catch (err) {
      pairError.textContent = "Pairing failed: " + err.message;
      pairError.classList.remove("hidden");
    }
  });

  // Flash Message Modal handlers
  const flashModal = document.getElementById("flashModal");
  const closeFlashModalBtn = document.getElementById("closeFlashModalBtn");
  const cancelFlashBtn = document.getElementById("cancelFlashBtn");
  const flashForm = document.getElementById("flashForm");
  const flashMessageInput = document.getElementById("flashMessageInput");
  const flashTargetDeviceId = document.getElementById("flashTargetDeviceId");
  const clearFlashBtn = document.getElementById("clearFlashBtn");

  const hideFlashModal = () => flashModal.classList.add("hidden");
  closeFlashModalBtn.addEventListener("click", hideFlashModal);
  cancelFlashBtn.addEventListener("click", hideFlashModal);

  flashForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const devId = flashTargetDeviceId.value;
    const msg = flashMessageInput.value.trim();
    if (!devId) return;

    await db.ref(`devices/${devId}/flashMessage`).set(msg);
    hideFlashModal();
  });

  clearFlashBtn.addEventListener("click", async () => {
    const devId = flashTargetDeviceId.value;
    if (!devId) return;
    await db.ref(`devices/${devId}/flashMessage`).remove();
    hideFlashModal();
  });

  // Listen for Devices
  db.ref("devices").on("value", (snapshot) => {
    devices = snapshot.val() || {};
    renderDevices();
  });

  // Listen for Playlists
  db.ref("playlists").on("value", (snapshot) => {
    playlists = snapshot.val() || {};
    if (!activePlaylistId && Object.keys(playlists).length > 0) {
      activePlaylistId = Object.keys(playlists)[0];
    }
    renderPlaylists();
    renderSlides();
  });

  // Create Playlist Button
  document.getElementById("createPlaylistBtn").addEventListener("click", async () => {
    const title = prompt("Enter new playlist name:", "General Signage");
    if (!title) return;

    const newRef = db.ref("playlists").push();
    await newRef.set({
      title: title,
      createdAt: Date.now(),
      slides: [
        {
          type: "html",
          content: `<div class="text-center font-bold text-4xl text-white">Welcome to TLVP</div>`,
          durationSec: 10,
        },
      ],
    });
    activePlaylistId = newRef.key;
  });

  // Add Slide Button
  document.getElementById("addSlideBtn").addEventListener("click", async () => {
    if (!activePlaylistId) return;

    const type = prompt("Select slide type (image, video, iframe, html):", "image");
    if (!type) return;

    const validTypes = ["image", "video", "iframe", "html"];
    const normalizedType = type.toLowerCase().trim();
    if (!validTypes.includes(normalizedType)) {
      alert("Invalid type. Choose one of: image, video, iframe, html");
      return;
    }

    let url = "";
    let content = "";

    if (normalizedType === "html") {
      content = prompt("Enter HTML or announcement text:", "<h1>Special Announcement</h1>");
      if (!content) return;
    } else {
      url = prompt(`Enter ${normalizedType} URL:`, "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1920");
      if (!url) return;
    }

    const duration = parseInt(prompt("Duration in seconds:", "10"), 10) || 10;

    const currentSlides = (playlists[activePlaylistId] && playlists[activePlaylistId].slides)
      ? (Array.isArray(playlists[activePlaylistId].slides) ? [...playlists[activePlaylistId].slides] : Object.values(playlists[activePlaylistId].slides))
      : [];

    currentSlides.push({
      type: normalizedType,
      url: url,
      content: content,
      durationSec: duration,
    });

    await db.ref(`playlists/${activePlaylistId}/slides`).set(currentSlides);
  });

  // Render Functions
  function renderDevices() {
    const list = document.getElementById("devicesList");
    const badge = document.getElementById("deviceCountBadge");
    const deviceKeys = Object.keys(devices);

    badge.textContent = `${deviceKeys.length} Display${deviceKeys.length === 1 ? "" : "s"}`;

    if (deviceKeys.length === 0) {
      list.innerHTML = `
        <div class="p-12 text-center">
          <p class="text-sm font-medium text-gray-500">No paired displays yet.</p>
          <p class="text-xs text-gray-400 mt-1">Click "Pair New Display" and enter the 4-character code on your TV.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = deviceKeys
      .map((id) => {
        const dev = devices[id];
        const isOnline = Boolean(dev.online && dev.lastSeen && Date.now() - dev.lastSeen < 60000);
        const name = dev.name || "Unnamed Display";
        const currentPlaylist = dev.currentPlaylistId || "";

        const playlistOptions = Object.keys(playlists)
          .map((pId) => `<option value="${pId}" ${pId === currentPlaylist ? "selected" : ""}>${playlists[pId].title || "Untitled"}</option>`)
          .join("");

        return `
          <div class="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 transition">
            <div class="flex items-center space-x-3.5">
              <span class="relative flex h-3 w-3">
                ${isOnline ? '<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>' : ""}
                <span class="relative inline-flex rounded-full h-3 w-3 ${isOnline ? "bg-emerald-500" : "bg-gray-300"}"></span>
              </span>
              <div>
                <div class="flex items-center space-x-2">
                  <h4 class="text-sm font-semibold text-gray-900">${name}</h4>
                  <span class="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">${id}</span>
                </div>
                <p class="text-xs text-gray-400">
                  ${isOnline ? "Online" : "Offline"} &bull; Last seen: ${dev.lastSeen ? new Date(dev.lastSeen).toLocaleTimeString() : "Never"}
                </p>
              </div>
            </div>

            <div class="flex items-center space-x-3">
              <div class="flex items-center space-x-2">
                <label class="text-xs text-gray-500 whitespace-nowrap">Playlist:</label>
                <select data-device-id="${id}" class="device-playlist-select text-xs font-medium bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="">-- None --</option>
                  ${playlistOptions}
                </select>
              </div>

              <button data-flash-id="${id}" class="flash-device-btn text-xs px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-medium rounded-lg transition">
                Flash Msg
              </button>

              <button data-unpair-id="${id}" class="unpair-device-btn text-xs px-2.5 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition" title="Unpair screen">
                Unpair
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    // Attach device listeners
    document.querySelectorAll(".device-playlist-select").forEach((select) => {
      select.addEventListener("change", (e) => {
        const devId = e.target.getAttribute("data-device-id");
        const val = e.target.value || null;
        db.ref(`devices/${devId}/currentPlaylistId`).set(val);
      });
    });

    document.querySelectorAll(".flash-device-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const devId = e.target.getAttribute("data-flash-id");
        flashTargetDeviceId.value = devId;
        flashMessageInput.value = (devices[devId] && devices[devId].flashMessage) || "";
        flashModal.classList.remove("hidden");
        flashMessageInput.focus();
      });
    });

    document.querySelectorAll(".unpair-device-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const devId = e.target.getAttribute("data-unpair-id");
        if (confirm(`Are you sure you want to unpair "${devices[devId]?.name || devId}"?`)) {
          await db.ref(`devices/${devId}`).remove();
        }
      });
    });
  }

  function renderPlaylists() {
    const list = document.getElementById("playlistsList");
    const pKeys = Object.keys(playlists);

    if (pKeys.length === 0) {
      list.innerHTML = `<div class="p-6 text-center text-gray-400 text-xs">No playlists created yet.</div>`;
      return;
    }

    list.innerHTML = pKeys
      .map((id) => {
        const pl = playlists[id];
        const isActive = id === activePlaylistId;
        const slideCount = pl.slides ? (Array.isArray(pl.slides) ? pl.slides.length : Object.keys(pl.slides).length) : 0;

        return `
          <div data-playlist-id="${id}" class="playlist-card group p-3 rounded-lg cursor-pointer transition flex items-center justify-between ${
            isActive ? "bg-indigo-50 border border-indigo-200" : "hover:bg-gray-50 border border-transparent"
          }">
            <div>
              <h4 class="text-sm font-semibold ${isActive ? "text-indigo-900" : "text-gray-900"}">${pl.title || "Untitled"}</h4>
              <p class="text-[11px] ${isActive ? "text-indigo-600" : "text-gray-400"}">${slideCount} slide${slideCount === 1 ? "" : "s"}</p>
            </div>
            <button data-delete-playlist="${id}" class="delete-playlist-btn opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 p-1 rounded transition" title="Delete Playlist">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        `;
      })
      .join("");

    document.querySelectorAll(".playlist-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest(".delete-playlist-btn")) return;
        activePlaylistId = card.getAttribute("data-playlist-id");
        renderPlaylists();
        renderSlides();
      });
    });

    document.querySelectorAll(".delete-playlist-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const pId = btn.getAttribute("data-delete-playlist");
        if (confirm(`Delete playlist "${playlists[pId]?.title || pId}"?`)) {
          await db.ref(`playlists/${pId}`).remove();
          if (activePlaylistId === pId) {
            activePlaylistId = Object.keys(playlists).find((k) => k !== pId) || null;
          }
        }
      });
    });
  }

  function renderSlides() {
    const container = document.getElementById("slidesContainer");
    const titleEl = document.getElementById("activePlaylistTitle");
    const subTitleEl = document.getElementById("activePlaylistSubtitle");
    const addBtn = document.getElementById("addSlideBtn");

    if (!activePlaylistId || !playlists[activePlaylistId]) {
      titleEl.textContent = "Select a Playlist";
      subTitleEl.textContent = "Configure slides for this playlist";
      addBtn.disabled = true;
      container.innerHTML = `
        <div class="h-full flex items-center justify-center text-gray-400 text-sm">
          Select or create a playlist on the left to start adding slides.
        </div>
      `;
      return;
    }

    const playlist = playlists[activePlaylistId];
    titleEl.textContent = playlist.title || "Untitled Playlist";
    addBtn.disabled = false;

    const slides = playlist.slides
      ? (Array.isArray(playlist.slides) ? playlist.slides : Object.values(playlist.slides))
      : [];

    subTitleEl.textContent = `${slides.length} slide${slides.length === 1 ? "" : "s"} &bull; Total cycle: ${slides.reduce((acc, s) => acc + (Number(s.durationSec) || 10), 0)}s`;

    if (slides.length === 0) {
      container.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center text-center p-8">
          <p class="text-sm font-medium text-gray-600">This playlist is empty.</p>
          <p class="text-xs text-gray-400 mt-1">Click "+ Add Slide" to insert images, videos, web pages, or announcements.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = slides
      .map((slide, idx) => {
        let preview = "";
        if (slide.type === "image") {
          preview = `<img src="${slide.url}" class="w-16 h-12 object-cover rounded border border-gray-200" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'64\\' height=\\'48\\'><rect width=\\'64\\' height=\\'48\\' fill=\\'%23eee\\'/><text x=\\'50%\\' y=\\'50%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' fill=\\'%23999\\' font-size=\\'10\\'>IMG</text></svg>'">`;
        } else if (slide.type === "video") {
          preview = `<div class="w-16 h-12 rounded bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 text-xs font-bold">VID</div>`;
        } else if (slide.type === "iframe") {
          preview = `<div class="w-16 h-12 rounded bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 text-xs font-bold">WEB</div>`;
        } else {
          preview = `<div class="w-16 h-12 rounded bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 text-xs font-bold">HTML</div>`;
        }

        return `
          <div class="flex items-center justify-between p-4 bg-gray-50/70 border border-gray-200 rounded-xl hover:border-gray-300 transition">
            <div class="flex items-center space-x-4">
              <span class="text-xs font-bold text-gray-400 w-4">${idx + 1}</span>
              ${preview}
              <div>
                <div class="flex items-center space-x-2">
                  <span class="text-xs uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
                    slide.type === "image" ? "bg-emerald-100 text-emerald-800" :
                    slide.type === "video" ? "bg-purple-100 text-purple-800" :
                    slide.type === "iframe" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
                  }">${slide.type}</span>
                  <span class="text-xs text-gray-500">${slide.durationSec || 10} seconds</span>
                </div>
                <p class="text-xs text-gray-600 mt-1 max-w-md truncate font-mono">${slide.url || slide.content || ""}</p>
              </div>
            </div>

            <div class="flex items-center space-x-2">
              <button data-delete-slide="${idx}" class="delete-slide-btn text-gray-400 hover:text-red-600 p-1.5 rounded-lg transition" title="Remove slide">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    document.querySelectorAll(".delete-slide-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const slideIdx = parseInt(btn.getAttribute("data-delete-slide"), 10);
        const updatedSlides = [...slides];
        updatedSlides.splice(slideIdx, 1);
        await db.ref(`playlists/${activePlaylistId}/slides`).set(updatedSlides);
      });
    });
  }
});
