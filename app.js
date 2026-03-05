console.log("BTCC Fantasy League 2026 loaded");

// ---------- Routing ----------
function setActiveTab(route) {
  document.querySelectorAll(".tab").forEach(a => {
    a.classList.toggle("active", a.dataset.route === route);
  });

  document.querySelectorAll(".view").forEach(v => {
    v.hidden = v.dataset.view !== route;
  });
}

function getRouteFromHash() {
  const raw = (window.location.hash || "#home").replace("#", "").trim().toLowerCase();
 const allowed = new Set(["home", "submit", "tables", "drivers", "results", "news", "admin"]);
  return allowed.has(raw) ? raw : "home";
}

// ---------- Firebase Status UI ----------
function setFirebaseUI(connected) {
  const pill = document.querySelector(".pill");
  const firebaseStatus = document.querySelector("#firebase-status");

  if (pill) pill.textContent = connected ? "Firebase Connected" : "Offline Mode";

  if (firebaseStatus) {
    firebaseStatus.textContent = connected ? "Firebase connected" : "Firebase not connected yet";
    firebaseStatus.classList.toggle("ok", connected);
    firebaseStatus.classList.toggle("warn", !connected);
  }
}

async function checkFirebaseAndReadMeta() {
  try {
    const isInit =
      (typeof firebase !== "undefined") &&
      firebase.apps &&
      firebase.apps.length > 0;

    if (!isInit) {
      setFirebaseUI(false);
      console.warn("⚠️ Firebase not initialised");
      return;
    }

    setFirebaseUI(true);
    console.log("✅ Firebase connected (apps:", firebase.apps.length, ")");

    // Read one Firestore doc: meta/app
    try {
      const db = firebase.firestore();
      const snap = await db.collection("meta").doc("app").get();

      if (!snap.exists) {
        console.warn("⚠️ Firestore doc meta/app not found");
        return;
      }

      const data = snap.data();
      console.log("📦 Firestore meta/app:", data);

      // Show on page
      let el = document.querySelector("#meta-readout");
      if (!el) {
        el = document.createElement("div");
        el.id = "meta-readout";
        el.style.marginTop = "8px";
        el.style.opacity = "0.85";
        el.style.fontSize = "0.95rem";

        const statusCard =
          document.querySelector("#status") ||
          document.querySelector(".status") ||
          document.querySelector("main");

        (statusCard || document.body).appendChild(el);
      }

      const name = data.name ?? "BTCC Fantasy League";
      const version = data.version ?? "";
      el.textContent = `Firestore read OK: ${name} ${version}`.trim();
    } catch (err) {
      console.warn("⚠️ Firestore read failed:", err);
    }
  } catch (err) {
    setFirebaseUI(false);
    console.warn("⚠️ Firebase check failed:", err);
  }
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatCountdown(ms) {
  if (ms <= 0) return "00:00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${days}:${pad2(hours)}:${pad2(mins)}:${pad2(secs)}`;
}

// Finds the next event by dateFrom/eventNo and shows:
// "Submissions for Event X close in DD:HH:MM:SS"
async function loadNextEventCountdown() {
  const el = document.getElementById("nextEventCountdown");
  if (!el) return;

  try {
    const db =
      window.btccDb ||
      (typeof firebase !== "undefined" && firebase.apps?.length ? firebase.firestore() : null);

    if (!db) {
      el.textContent = "Offline mode (no countdown).";
      return;
    }

    const snap = await db.collection("events").orderBy("eventNo").get();
    const events = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (!events.length) {
      el.textContent = "No events found.";
      return;
    }

    // Lockout rule (for now): dateFrom @ 15:00 UK local time
    const now = new Date();

    const withLockout = events
      .filter(e => typeof e.dateFrom === "string" && e.dateFrom.length >= 10)
      .map(e => {
        // This uses the viewer's local timezone (fine for UK users)
        const lockout = new Date(`${e.dateFrom}T15:00:00`);
        return { ...e, lockout };
      });

    // Next upcoming lockout in the future
    const next = withLockout.find(e => e.lockout.getTime() > now.getTime()) || null;

    if (!next) {
      el.textContent = "All events are past lockout.";
      return;
    }

    const label = `Submissions for Event ${next.eventNo} close in`;

    // Update once per second
    const tick = () => {
      const msLeft = next.lockout.getTime() - Date.now();
      el.textContent = `${label} ${formatCountdown(msLeft)}`;
    };

    tick();
    // prevent multiple intervals if user refreshes modules
    if (window.__btccCountdownInterval) clearInterval(window.__btccCountdownInterval);
    window.__btccCountdownInterval = setInterval(tick, 1000);
  } catch (e) {
    console.error("Countdown failed:", e);
    const el = document.getElementById("nextEventCountdown");
    if (el) el.textContent = "Countdown unavailable.";
  }
}

async function runPageLoaders() {
  // Page modules expose these on window (see /js/pages/*.js)
  if (window.loadDrivers) await window.loadDrivers();
  if (window.loadStandings) await window.loadStandings();
  if (window.loadResults) await window.loadResults();
  if (window.loadAdmin) await window.loadAdmin();
  if (window.loadSubmit) await window.loadSubmit();
}

// ---------- App Boot ----------
document.addEventListener("DOMContentLoaded", async () => {
  // Build stamp
  const stampEl = document.getElementById("buildStamp");
  if (stampEl) stampEl.textContent = new Date().toLocaleString();

  // Firebase + Firestore meta read
  await checkFirebaseAndReadMeta();

  await loadNextEventCountdown();

  // Page data (read-only at this stage)
  await runPageLoaders();

  // Tile shortcuts
  document.querySelectorAll("[data-goto]").forEach(btn => {
    btn.addEventListener("click", () => {
      const route = btn.getAttribute("data-goto");
      window.location.hash = `#${route}`;
    });
  });

  // Routing
  setActiveTab(getRouteFromHash());
  window.addEventListener("hashchange", () =>
    setActiveTab(getRouteFromHash())
  );
});