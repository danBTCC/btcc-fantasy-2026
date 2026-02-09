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

// Results (from results.js)
if (window.loadResults) {
  await window.loadResults();
}

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