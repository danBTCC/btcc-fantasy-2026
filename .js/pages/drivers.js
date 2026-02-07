// js/pages/drivers.js
// Exposes: window.loadDrivers()

(function () {
  function trendMeta(t) {
    if (t === "up") return { icon: "▲", cls: "up" };
    if (t === "down") return { icon: "▼", cls: "down" };
    return { icon: "—", cls: "same" };
  }

  async function loadDrivers() {
    const container = document.getElementById("drivers-list");
    if (!container) return;

    container.textContent = "Loading drivers...";

    try {
      if (!window.btccDb) throw new Error("btccDb is not defined (Firestore not ready)");

      const snap = await window.btccDb
        .collection("drivers")
        .where("active", "==", true)
        .orderBy("name")
        .get();

      if (snap.empty) {
        container.textContent = "No active drivers yet.";
        return;
      }

      container.innerHTML = `<ul class="driverList">
        ${snap.docs
          .map((doc) => {
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
          })
          .join("")}
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

  // Export so app.js can call it
  window.loadDrivers = loadDrivers;
})();