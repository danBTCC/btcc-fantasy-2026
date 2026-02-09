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

async function loadEventsList() {
  const el = document.getElementById("events-list");
  if (!el) return;

  el.textContent = "Loading…";

  try {
    if (!window.btccDb) throw new Error("btccDb not available");

    const snap = await window.btccDb
      .collection("events")
      .orderBy("eventNo")
      .get();

    if (snap.empty) {
      el.textContent = "No data yet";
      return;
    }

    const fmtDate = (v) => {
      // Firestore Timestamp
      if (v && typeof v.toDate === "function") {
        return v.toDate().toLocaleDateString("en-GB");
      }
      // ISO string (YYYY-MM-DD)
      if (typeof v === "string" && v.length >= 10) {
        const d = new Date(v);
        if (!isNaN(d)) return d.toLocaleDateString("en-GB");
        return v;
      }
      return "—";
    };

    el.innerHTML = `
      <ul class="list">
        ${snap.docs.map(doc => {
          const d = doc.data();
          const from = fmtDate(d.dateFrom);
          const to = fmtDate(d.dateTo);
          const dates = (from !== "—" && to !== "—") ? `${from}–${to}` : (from !== "—" ? from : "—");
          const status = (d.status || "upcoming").toString();
          const rounds = (d.roundFrom && d.roundTo) ? `R${d.roundFrom}–${d.roundTo}` : "";
        return `
  <li class="eventItem">
    <div class="eventHeader" data-toggle="event-details">
      <strong>Event ${d.eventNo ?? "—"}</strong> — ${d.venue ?? d.name ?? "Unnamed"}<br>
      <span class="tiny muted">${rounds} • ${dates} • ${status}</span>
      <div class="tiny muted">▾ Details</div>
    </div>

    <div class="eventDetails" hidden>
      <ul class="list tiny">
        <li>Qualifying: not available</li>
        <li>Race 1: not available</li>
        <li>Race 2: not available</li>
        <li>Race 3: not available</li>
      </ul>
    </div>
  </li>
`;
        }).join("")}
      </ul>
    `;

        // Toggle event details (UI-only)
    el.querySelectorAll("[data-toggle='event-details']").forEach(header => {
      header.addEventListener("click", () => {
        const details = header.parentElement.querySelector(".eventDetails");
        if (details) details.hidden = !details.hidden;
      });
    });

    console.log("✅ Events loaded:", snap.size);
  } catch (err) {
    console.error("❌ loadEventsList failed:", err);
    el.innerHTML = `
      <div class="note warnNote">
        Failed to load events.<br>
        <span class="tiny muted">${err?.message || err}</span>
      </div>
    `;
  }
}

// ---------- App Boot ----------
document.addEventListener("DOMContentLoaded", async () => {
  // Build stamp
  const stampEl = document.getElementById("buildStamp");
  if (stampEl) stampEl.textContent = new Date().toLocaleString();

  // Firebase + Firestore meta read
  await checkFirebaseAndReadMeta();

  // Drivers list (from drivers.js)
  if (window.loadDrivers) {
    await window.loadDrivers();
  }

 // Standings (from standings.js)
  if (window.loadStandings) {
    await window.loadStandings();
  }

    // Results: Events list (read-only)
  await loadEventsList();

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