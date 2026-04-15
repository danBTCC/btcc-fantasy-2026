console.log("BTCC Fantasy League 2026 loaded");

// ---------- Routing ----------
function setActiveTab(route) {
  document.querySelectorAll(".tab").forEach(a => {
    a.classList.toggle("active", a.dataset.route === route);
  });

  document.querySelectorAll(".view").forEach(v => {
    v.hidden = v.dataset.view !== route;
  });

  if (route === "home") {
    loadHomeNewsSnippets();
  }

  if (route === "news") {
    window.loadNews?.();
  }

  if (route === "pitstop") {
    window.loadPitStop?.();
}

}

function getRouteFromHash() {
  const raw = (window.location.hash || "#home").replace("#", "").trim().toLowerCase();
 const allowed = new Set(["home", "submit", "tables", "drivers", "results", "news", "pitstop", "admin"]);
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

    } catch (err) {
      console.warn("⚠️ Firestore read failed:", err);
    }
  } catch (err) {
    setFirebaseUI(false);
    console.warn("⚠️ Firebase check failed:", err);
  }
}

function formatCountdownLong(ms) {
  if (ms <= 0) return "0 Days 0 Hours 0 Mins 0 Seconds";

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  return `${days} Days ${hours} Hours ${mins} Mins ${secs} Seconds`;
}

// Loads the editable Home page snippets saved by Admin (meta/homeNews)
async function loadHomeNewsSnippets() {
  try {
    const elLatest = document.getElementById("home-news-latest");
    const elPrev = document.getElementById("home-news-previous");

    // If we're not on the Home view (or markup not present), do nothing.
    if (!elLatest || !elPrev) return;

    const db =
      window.btccDb ||
      (typeof firebase !== "undefined" && firebase.apps?.length ? firebase.firestore() : null);

    if (!db) {
      elLatest.textContent = "—";
      elPrev.textContent = "—";
      return;
    }

    const snap = await db.collection("meta").doc("homeNews").get();
    const d = snap.exists ? (snap.data() || {}) : {};

    const safeText = (v) => (typeof v === "string" && v.trim().length ? v.trim() : "—");

    elLatest.textContent = safeText(d.latestEvent);
    elPrev.textContent = safeText(d.previousEvent);
  } catch (err) {
    console.error("❌ loadHomeNewsSnippets failed:", err);
  }
}

// Finds the next event by dateFrom/eventNo and shows it on the Home "Next event" card.
// Lockout rule (for now): dateFrom @ 14:00 local time (UK users).
async function loadNextEventCountdown() {
  const nameEl = document.getElementById("next-event-name");
  const countdownEl = document.getElementById("next-event-countdown");
  const lockoutEl = document.getElementById("next-event-lockout");
  const statusEl = document.getElementById("next-event-status");

  // If the Home card isn't present, do nothing.
  if (!nameEl || !countdownEl || !lockoutEl) return;

  try {
    const db =
      window.btccDb ||
      (typeof firebase !== "undefined" && firebase.apps?.length ? firebase.firestore() : null);

    if (!db) {
      nameEl.textContent = "Offline mode";
      countdownEl.textContent = "—";
      lockoutEl.textContent = "—";
      if (statusEl) statusEl.textContent = "—";
      return;
    }

    const snap = await db.collection("events").orderBy("eventNo").get();
    const events = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (!events.length) {
      nameEl.textContent = "No events";
      countdownEl.textContent = "—";
      lockoutEl.textContent = "—";
      if (statusEl) statusEl.textContent = "—";
      return;
    }

    // Build lockout datetime from dateFrom (YYYY-MM-DD) at 14:00 local.
    const parsed = events
      .filter(e => typeof e.dateFrom === "string" && e.dateFrom.length >= 10)
      .map(e => {
        const lockout = new Date(`${e.dateFrom}T14:00:00`);
        return { ...e, lockout };
      })
      // ensure ascending by eventNo just in case
      .sort((a, b) => (a.eventNo ?? 999) - (b.eventNo ?? 999));

    const now = Date.now();

    // Choose next event (first event whose lockout is in the future)
    // If all lockouts are past, fall back to the last event.
    const next = parsed.find(e => e.lockout.getTime() > now) || parsed[parsed.length - 1];

    const venue = next.venue || next.name || `Event ${next.eventNo ?? "—"}`;
    nameEl.textContent = venue;

    const lockoutText = `${next.lockout.toLocaleDateString("en-GB")} ${next.lockout.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
    lockoutEl.textContent = `Lockout: ${lockoutText}`;

    // Update once per second
    const tick = () => {
      const msLeft = next.lockout.getTime() - Date.now();

      if (msLeft <= 0) {
        countdownEl.textContent = "0 Days 0 Hours 0 Mins 0 Seconds";
        if (statusEl) statusEl.textContent = "Submissions are locked — Event in progress";
      } else {
        countdownEl.textContent = formatCountdownLong(msLeft);
        if (statusEl) statusEl.textContent = "Submissions are open";
      }
    };

    tick();

    // prevent multiple intervals if user refreshes modules
    if (window.__btccCountdownInterval) clearInterval(window.__btccCountdownInterval);
    window.__btccCountdownInterval = setInterval(tick, 1000);
  } catch (e) {
    console.error("Countdown failed:", e);
    if (nameEl) nameEl.textContent = "Countdown unavailable";
    if (countdownEl) countdownEl.textContent = "—";
    if (lockoutEl) lockoutEl.textContent = "—";
    if (statusEl) statusEl.textContent = "—";
  }
}

async function runPageLoaders() {
  // Page modules expose these on window (see /js/pages/*.js)
  if (window.loadDrivers) await window.loadDrivers();
  if (window.loadStandings) await window.loadStandings();
  if (window.loadResults) await window.loadResults();
  if (window.loadAdmin) await window.loadAdmin();
  if (window.loadSubmit) await window.loadSubmit();
  if (window.loadPitStop) await window.loadPitStop();
}

let isRefreshing = false;

document.addEventListener("touchmove", (e) => {
  if (isRefreshing) return;

  const currentY = e.touches[0].clientY;

  if (window.scrollY === 0 && currentY > startY + 80) {
    isRefreshing = true;
    location.reload();
  }
});


// ---------- App Boot ----------
document.addEventListener("DOMContentLoaded", async () => {
  // Build stamp
  const stampEl = document.getElementById("buildStamp");
  if (stampEl) stampEl.textContent = new Date().toLocaleString();

  // Firebase + Firestore meta read
  await checkFirebaseAndReadMeta();

  await loadNextEventCountdown();
  await loadHomeNewsSnippets();

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