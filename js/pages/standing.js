// js/pages/standings.js
// Exposes: window.loadStandings()

(function () {
  async function loadStandings() {
    const container = document.getElementById("standings-championship");
    const updatedEl = document.getElementById("standings-updated");

    if (!container) return;

    container.textContent = "Loading…";

    try {
      if (!window.btccDb) {
        throw new Error("btccDb not available");
      }

      // ---- Championship standings ----
      const snap = await window.btccDb
        .collection("standings_championship")
        .orderBy("pos")
        .get();

      if (snap.empty) {
        container.textContent = "No data yet";
      } else {
        container.innerHTML = `
          <ul class="list">
            ${snap.docs
              .map(doc => {
                const d = doc.data();
                return `
                  <li>
                    <strong>${d.pos ?? "—"}</strong>
                    ${d.player ?? "Unnamed"} — 
                    <span class="muted">${d.pts ?? 0} pts</span>
                  </li>
                `;
              })
              .join("")}
          </ul>
        `;
      }

      console.log("✅ Championship standings loaded:", snap.size);

      // ---- Last updated ----
      try {
        const metaSnap = await window.btccDb
          .collection("meta")
          .doc("standings")
          .get();

        if (metaSnap.exists && updatedEl) {
          const ts = metaSnap.data().updatedAt;
          if (ts && ts.toDate) {
            updatedEl.textContent = ts.toDate().toLocaleString();
          }
        }
      } catch (err) {
        console.warn("⚠ Could not read meta/standings:", err);
      }

    } catch (err) {
      console.error("❌ loadStandings failed:", err);
      container.innerHTML = `
        <div class="note warnNote">
          Failed to load standings.<br>
          <span class="tiny muted">${err.message}</span>
        </div>
      `;
    }
  }

  // Export so app.js can call it later
  window.loadStandings = loadStandings;
})();