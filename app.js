console.log("BTCC Fantasy League 2026 loaded");

function setActiveTab(route) {
  // Tabs
  document.querySelectorAll(".tab").forEach(a => {
    a.classList.toggle("active", a.dataset.route === route);
  });

  // Views
  document.querySelectorAll(".view").forEach(v => {
    const isMatch = v.dataset.view === route;
    v.hidden = !isMatch;
  });
}

function getRouteFromHash() {
  const raw = (window.location.hash || "#home").replace("#", "").trim().toLowerCase();
  const allowed = new Set(["home", "submit", "tables", "news", "admin"]);
  return allowed.has(raw) ? raw : "home";
}

document.addEventListener("DOMContentLoaded", async () => {
  // Build stamp so you can instantly confirm deploy updated
  const stamp = new Date().toLocaleString();
  const stampEl = document.getElementById("buildStamp");
  if (stampEl) stampEl.textContent = stamp;
  await loadDrivers();

  // Tile shortcuts
document.querySelectorAll("[data-goto]").forEach(btn => {
  btn.addEventListener("click", () => {
    const route = btn.getAttribute("data-goto");
    window.location.hash = `#${route}`;
  });
});

// Initial route
setActiveTab(getRouteFromHash());

// Handle tab changes + back button
window.addEventListener("hashchange", () => {
  setActiveTab(getRouteFromHash());
});

async function loadDrivers() {
  const container = document.getElementById("drivers-list");
  if (!container) return;

  container.textContent = "Loading drivers...";

  try {
    const snap = await btccDb
      .collection("drivers")
      .where("active", "==", true)
      .orderBy("name")
      .get();

    if (snap.empty) {
      container.textContent = "No active drivers yet.";
      return;
    }

    const trendMeta = (t) => {
  if (t === "up") return { icon: "⬆️", cls: "up" };
  if (t === "down") return { icon: "⬇️", cls: "down" };
  return { icon: "➖", cls: "same" };
};

container.innerHTML = `<ul class="driverList">
  ${snap.docs.map((doc) => {
    const d = doc.data();
    const tr = trendMeta(d.trend);

    const cats = Array.isArray(d.categories)
      ? d.categories.join(", ")
      : (d.category || "");

    return `
      <li class="driverRow">
        <span class="driverMain">
          <strong>${d.name}</strong> <span class="muted">(${cats})</span>
        </span>

        <span class="driverMeta">
          <span class="money">£${Number(d.value).toFixed(2)}</span>
          <span class="muted">• Tier: ${d.tier || "TBD"}</span>
          <span class="trend ${tr.cls}" title="Trend">${tr.icon}</span>
        </span>
      </li>
    `;
  }).join("")}
</ul>`;

  } catch (err) {
    console.error("❌ Driver load failed", err);
    container.textContent = "Failed to load drivers.";
  }
}

// Firebase status pill check
const pill = document.querySelector(".pill");
const firebaseStatus = document.querySelector("#firebase-status");

const setFirebaseUI = (connected) => {
  if (pill) pill.textContent = connected ? "Firebase Connected" : "Offline Mode";

  if (firebaseStatus) {
    firebaseStatus.textContent = connected
      ? "Firebase connected"
      : "Firebase not connected yet";

    firebaseStatus.classList.toggle("ok", connected);
    firebaseStatus.classList.toggle("warn", !connected);
  }
};

try {
  const isInit =
    (typeof firebase !== "undefined") &&
    firebase.apps &&
    firebase.apps.length > 0;

  if (isInit) {
    setFirebaseUI(true);
    console.log("✅ Firebase connected (apps:", firebase.apps.length, ")");
  // Read one Firestore doc: meta/app
try {
  const db = firebase.firestore();
  const snap = await db.collection("meta").doc("app").get();

  if (!snap.exists) {
    console.warn("⚠️ Firestore doc meta/app not found");
  } else {
    const data = snap.data();
    console.log("📦 Firestore meta/app:", data);

    // Show on page (creates a small readout if it doesn't exist)
    let el = document.querySelector("#meta-readout");
    if (!el) {
      el = document.createElement("div");
      el.id = "meta-readout";
      el.style.marginTop = "8px";
      el.style.opacity = "0.85";
      el.style.fontSize = "0.95rem";

      // Try to tuck it into the Status card if we can find it
      const statusSection =
        document.querySelector("#status") ||
        document.querySelector(".status") ||
        document.querySelector("main");

      (statusSection || document.body).appendChild(el);
    }

    const name = data.name ?? "BTCC Fantasy League";
    const version = data.version ?? "";
    el.textContent = `Firestore read OK: ${name} ${version}`.trim();
  }
} catch (err) {
  console.warn("⚠️ Firestore read failed:", err);
}
} else {
    setFirebaseUI(false);
    console.warn("⚠️ Firebase not initialised");
  }
} catch (err) {
  setFirebaseUI(false);
  console.warn("⚠️ Firebase check failed:", err);
}
async function loadDrivers() {
  const container = document.getElementById("drivers-list");
  if (!container) return;

  container.textContent = "Loading drivers...";

  try {
    // Sanity: make sure Firestore exists
    if (!window.btccDb) throw new Error("btccDb is not defined");

    const snap = await window.btccDb
      .collection("drivers")
      .where("active", "==", true)
      .orderBy("name")
      .get();

    const trendMeta = (t) => {
      if (t === "up") return { icon: "⬆️", cls: "up" };
      if (t === "down") return { icon: "⬇️", cls: "down" };
      return { icon: "➖", cls: "same" };
    };

    if (snap.empty) {
      container.textContent = "No active drivers yet.";
      return;
    }

    container.innerHTML = `<ul class="driverList">
      ${snap.docs.map((doc) => {
        const d = doc.data();

        const cats = Array.isArray(d.categories)
          ? d.categories.join(", ")
          : (d.category || "");

        const tr = trendMeta(d.trend);

        return `
          <li class="driverRow">
            <span class="driverMain">
              <strong>${d.name || "Unnamed"}</strong>
              <span class="muted">(${cats})</span>
            </span>

            <span class="driverMeta">
              <span class="money">£${Number(d.value || 0).toFixed(2)}</span>
              <span class="muted">• Tier: ${d.tier || "TBD"}</span>
              <span class="trend ${tr.cls}" title="Trend">${tr.icon}</span>
            </span>
          </li>
        `;
      }).join("")}
    </ul>`;

    console.log("✅ Drivers loaded:", snap.size);
  } catch (err) {
    console.error("❌ loadDrivers failed:", err);
    container.innerHTML = `<div class="note warnNote">
      Failed to load drivers.<br>
      <span class="tiny muted">${err?.message || err}</span>
    </div>`;
  }
}
}
});