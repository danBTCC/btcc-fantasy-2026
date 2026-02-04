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

    // Firebase init (safe: only runs if config + scripts are present)
  const pill = document.getElementById("pillStatus");

  try {
    if (!window.firebaseConfig) throw new Error("Missing firebaseConfig");
    if (!window.firebase || !firebase?.initializeApp) throw new Error("Firebase scripts not loaded");

    firebase.initializeApp(window.firebaseConfig);

    // Optional: create references so later segments can use them
    window.btccAuth = firebase.auth();
    window.btccDb = firebase.firestore();

    if (pill) pill.textContent = "Firebase Connected";
    console.log("✅ Firebase connected");
  } catch (err) {
    if (pill) pill.textContent = "Offline Mode";
    console.warn("⚠️ Firebase not connected:", err);
  }