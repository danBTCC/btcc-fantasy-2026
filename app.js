console.log("BTCC Fantasy League 2026 loaded");

const loadedRoutes = new Set();
const SHOW_CROFT_RESULTS_WARNING = false;

function showCroftResultsWarning() {
  const modal = document.createElement("div");
  modal.className = "spoiler-warning";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "spoiler-warning-title");
  modal.setAttribute("aria-describedby", "spoiler-warning-message");

  modal.innerHTML = `
    <div class="spoiler-warning__card">
      <div class="spoiler-warning__flag" aria-hidden="true">🏁</div>
      <h1 id="spoiler-warning-title">Spoiler Warning</h1>
      <div id="spoiler-warning-message" class="spoiler-warning__message">
        <div>Do not enter if you have not watched all the races.</div>
        <div>Event 8 — Croft results are now live.</div>
      </div>
      <a href="#results" class="spoiler-warning__news">
        View Event 8 — Croft Results
      </a>
      <button type="button" class="spoiler-warning__continue">
        Continue to Home
      </button>
    </div>
  `;

  const continueButton = modal.querySelector(".spoiler-warning__continue");
  const resultsLink = modal.querySelector(".spoiler-warning__news");
  const appShell = document.getElementById("app-shell");
  const previousOverflow = document.body.style.overflow;

  if (appShell) appShell.inert = true;
  document.body.style.overflow = "hidden";
  document.body.appendChild(modal);
  continueButton.focus();

  const dismissAndNavigate = (route) => {
    if (appShell) appShell.inert = false;
    document.body.style.overflow = previousOverflow;
    modal.remove();
    window.location.hash = `#${route}`;
  };

  continueButton.addEventListener("click", () => {
    dismissAndNavigate("home");
  }, { once: true });

  resultsLink.addEventListener("click", (event) => {
    event.preventDefault();
    dismissAndNavigate("results");
  }, { once: true });
}

async function loadRouteData(route) {
  if (!route || loadedRoutes.has(route)) return;

  const loaders = {
    home: async () => {
      await Promise.all([
        loadNextEventCountdown(),
        loadHomeNewsSnippets(),
        loadFinaleFeature(),
      ]);
    },
    submit: () => window.loadSubmit?.(),
    drivers: () => window.loadDrivers?.(),
    tables: () => window.loadStandings?.(),
    results: () => window.loadResults?.(),
    news: () => window.loadNews?.(),
    pitstop: () => window.loadPitStop?.(),
    admin: () => window.loadAdmin?.(),
  };

  const loader = loaders[route];
  if (typeof loader !== "function") return;

  try {
    loadedRoutes.add(route);
    await loader();
  } catch (err) {
    loadedRoutes.delete(route);
    console.error(`❌ Route loader failed: ${route}`, err);
  }
}

// ---------- Routing ----------
function setActiveTab(route) {
  document.querySelectorAll(".tab").forEach(a => {
    a.classList.toggle("active", a.dataset.route === route);
  });

  document.querySelectorAll(".view").forEach(v => {
    v.hidden = v.dataset.view !== route;
  });

  loadRouteData(route);
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

function escapeFinaleHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function loadFinaleFeature() {
  const feature = document.getElementById("finale-feature");
  const fallback = document.getElementById("home-intro-fallback");
  const battlesEl = document.getElementById("finale-battles");
  const remainingEl = document.getElementById("finale-remaining");
  if (!feature || !fallback || !battlesEl || !remainingEl || !window.btccDb) return;

  try {
    const db = window.btccDb;
    const [eventsSnap, standingsSnap] = await Promise.all([
      db.collection("events").get(),
      db.collection("standings_players").doc("season_2026").collection("players").get(),
    ]);

    const remaining = eventsSnap.docs.filter((doc) => {
      const event = doc.data() || {};
      return event.resultsLocked !== true && String(event.status || "").toLowerCase() !== "complete";
    }).length;

    // This is a run-in feature, not a permanent second standings table.
    if (remaining < 1 || remaining > 2 || standingsSnap.empty) return;

    const players = standingsSnap.docs
      .map((doc) => {
        const data = doc.data() || {};
        return {
          id: doc.id,
          name: data.displayName || data.name || "Unnamed",
          points: Number(data.pointsTotal ?? data.points ?? 0),
        };
      })
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
      .map((player, index) => ({ ...player, position: index + 1 }));

    if (players.length < 3) return;

    const renderBattle = (title, kicker, rows, targetIndex, theme) => {
      const target = players[targetIndex];
      if (!target || !rows.length) return "";

      return `
        <article class="finaleBattle finaleBattle--${theme}">
          <div class="finaleBattle__kicker">${escapeFinaleHtml(kicker)}</div>
          <h2>${escapeFinaleHtml(title)}</h2>
          <div class="finaleBattle__rows">
            ${rows.map((player) => {
              const gap = player.points - target.points;
              const gapText = gap > 0 ? `+${gap}` : gap < 0 ? String(gap) : "—";
              return `
                <div class="finaleBattle__row${gap === 0 ? " finaleBattle__row--target" : ""}">
                  <span class="finaleBattle__position">${player.position}</span>
                  <span class="finaleBattle__name">${escapeFinaleHtml(player.name)}</span>
                  <span class="finaleBattle__points">${player.points}</span>
                  <span class="finaleBattle__gap" aria-label="${gap === 0 ? "At the target position" : `${Math.abs(gap)} points ${gap > 0 ? "ahead of" : "behind"} the target position`}">${gapText}</span>
                </div>
              `;
            }).join("")}
          </div>
          <div class="finaleBattle__foot">Gap to ${targetIndex === 0 ? "1st" : targetIndex === 2 ? "3rd" : "6th"}</div>
        </article>
      `;
    };

    battlesEl.innerHTML = [
      renderBattle("Battle for 1st", "THE TITLE", players.slice(0, 2), 0, "title"),
      renderBattle("Podium race", "BATTLE FOR THIRD", players.slice(2, 5), 2, "podium"),
      renderBattle("Mid-pack battle", "THE MID-PACK BATTLE", players.slice(5, 14), 5, "midpack"),
    ].join("");

    remainingEl.textContent = `${remaining} event${remaining === 1 ? "" : "s"} to go. Three battles to watch.`;
    feature.hidden = false;
    fallback.hidden = true;
  } catch (err) {
    console.warn("Finale feature unavailable", err);
  }
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

    const parsed = events
      .filter(e => typeof e.dateFrom === "string" && e.dateFrom.length >= 10)
      .map(e => {
        const lockout = new Date(`${e.dateFrom}T14:00:00`);
        return {
          ...e,
          lockout,
          status: String(e.status || "").toLowerCase(),
        };
      })
      // ensure ascending by eventNo just in case
      .sort((a, b) => (a.eventNo ?? 999) - (b.eventNo ?? 999));

    const now = Date.now();

    const liveEvent = parsed.find(e => e.status === "live");
    const upcomingEvent = parsed.find(e => e.status === "upcoming");

    // Prefer the live event, then the next upcoming event, then fall back to date-based selection.
    const next = liveEvent || upcomingEvent || parsed.find(e => e.lockout.getTime() > now) || parsed[parsed.length - 1];

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

// ---------- App Boot ----------
document.addEventListener("DOMContentLoaded", async () => {
  if (SHOW_CROFT_RESULTS_WARNING) {
    showCroftResultsWarning();
  }

  // Build stamp
  const stampEl = document.getElementById("buildStamp");
  if (stampEl) stampEl.textContent = new Date().toLocaleString();

  // Routing first: tabs must work even if Firebase/page loaders are slow.
  setActiveTab(getRouteFromHash());
  window.addEventListener("hashchange", () =>
    setActiveTab(getRouteFromHash())
  );

  // Tile shortcuts
  document.querySelectorAll("[data-goto]").forEach(btn => {
    btn.addEventListener("click", () => {
      const route = btn.getAttribute("data-goto");
      window.location.hash = `#${route}`;
    });
  });

  // Firebase + Firestore meta read only. Page data now lazy-loads per tab.
  checkFirebaseAndReadMeta();
});
