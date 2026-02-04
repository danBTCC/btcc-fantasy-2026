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

document.addEventListener("DOMContentLoaded", () => {
  // Build stamp so you can instantly confirm deploy updated
  const stamp = new Date().toLocaleString();
  const stampEl = document.getElementById("buildStamp");
  if (stampEl) stampEl.textContent = stamp;

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
  } else {
    setFirebaseUI(false);
    console.warn("⚠️ Firebase not initialised");
  }
} catch (err) {
  setFirebaseUI(false);
  console.warn("⚠️ Firebase check failed:", err);
}
});