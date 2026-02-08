// js/pages/standings.js
// Exposes: window.loadStandings()

(function () {
  async function loadStandings() {
    const container = document.getElementById("standings-championship");
    const updatedEl = document.getElementById("standings-updated");
    const playersEl = document.getElementById("standings-players");
    const teamsEl = document.getElementById("standings-teams");

    if (!container) return;

    container.textContent = "Loading…";
        if (playersEl) playersEl.textContent = "Loading…";
            if (teamsEl) teamsEl.textContent = "Loading…";

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

      // ---- Players standings ----
      if (playersEl) {
        const playersSnap = await window.btccDb
          .collection("standings_players")
          .orderBy("pos")
          .get();

        if (playersSnap.empty) {
          playersEl.textContent = "No data yet";
        } else {
          playersEl.innerHTML = `
            <ul class="list">
              ${playersSnap.docs
                .map(doc => {
                  const d = doc.data();
                  const budget = (d.budget ?? 0);
                  const budgetText =
                    (typeof budget === "number") ? budget.toFixed(2) : budget;

                  return `
                    <li>
                      <strong>${d.pos ?? "—"}</strong>
                      ${d.player ?? "Unnamed"} —
                      <span class="muted">£${budgetText}</span> •
                      <span class="muted">${d.pts ?? 0} pts</span>
                    </li>
                  `;
                })
                .join("")}
            </ul>
          `;
        }

        console.log("✅ Players standings loaded:", playersSnap.size);
      }

      // ---- Teams standings ----
      if (teamsEl) {
        const teamsSnap = await window.btccDb
          .collection("standings_teams")
          .orderBy("pos")
          .get();

        if (teamsSnap.empty) {
          teamsEl.textContent = "No data yet";
        } else {
          teamsEl.innerHTML = `
            <ul class="list">
              ${teamsSnap.docs
                .map(doc => {
                  const d = doc.data();
                  return `
                    <li>
                      <strong>${d.pos ?? "—"}</strong>
                      ${d.team ?? "Unnamed team"} —
                      <span class="muted">${d.pts ?? 0} pts</span>
                    </li>
                  `;
                })
                .join("")}
            </ul>
          `;
        }

        console.log("✅ Teams standings loaded:", teamsSnap.size);
      }

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