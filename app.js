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

  // Status pill (we’ll replace later when Firebase is wired)
  const pill = document.getElementById("pillStatus");
  if (pill) pill.textContent = "Offline Mode";
});