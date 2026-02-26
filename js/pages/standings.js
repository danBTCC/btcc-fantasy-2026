// js/pages/standings.js
// Exposes: window.loadStandings()

(function () {
  async function loadStandings() {
    const updatedEl = document.getElementById("standings-updated");
    const playersEl = document.getElementById("standings-players");
    const teamsEl = document.getElementById("standings-teams");

    if (playersEl) playersEl.textContent = "Loading…";
    if (teamsEl) teamsEl.textContent = "Loading…";

    try {
      if (!window.btccDb) {
        throw new Error("btccDb not available");
      }

      // ---- Players standings ----
      if (playersEl) {
        const playersSnap = await window.btccDb
          .collection("standings_players")
          .doc("season_2026")
          .collection("players")
          .orderBy("points", "desc")
          .get();

        if (playersSnap.empty) {
          playersEl.textContent = "No data yet";
        } else {
          playersEl.innerHTML = `
            <table class="table tiny" style="width:100%; border-collapse: collapse;">
              <thead>
                <tr>
                  <th style="text-align:left; padding:6px;">Pos</th>
                  <th style="text-align:left; padding:6px;">Player</th>
                  <th style="text-align:right; padding:6px;">Points</th>
                </tr>
              </thead>
              <tbody>
                ${playersSnap.docs
                  .map((doc, idx) => {
                    const d = doc.data() || {};
                    return `
                      <tr>
                        <td style="padding:6px;">${idx + 1}</td>
                        <td style="padding:6px;">${d.displayName || "Unnamed"}</td>
                        <td style="padding:6px; text-align:right;">${d.points ?? 0}</td>
                      </tr>
                    `;
                  })
                  .join("")}
              </tbody>
            </table>
          `;
        }

        console.log("✅ Players standings loaded:", playersSnap.size);
      }

      // ---- Teams standings ----
      if (teamsEl) {
        const teamsSnap = await window.btccDb
          .collection("standings_teams")
          .doc("season_2026")
          .collection("teams")
          .orderBy("points", "desc")
          .get();

        if (teamsSnap.empty) {
          teamsEl.textContent = "No data yet";
        } else {
          teamsEl.innerHTML = `
            <table class="table tiny" style="width:100%; border-collapse: collapse;">
              <thead>
                <tr>
                  <th style="text-align:left; padding:6px;">Pos</th>
                  <th style="text-align:left; padding:6px;">Team</th>
                  <th style="text-align:right; padding:6px;">Points</th>
                </tr>
              </thead>
              <tbody>
                ${teamsSnap.docs
                  .map((doc, idx) => {
                    const d = doc.data() || {};
                    return `
                      <tr>
                        <td style="padding:6px;">${idx + 1}</td>
                        <td style="padding:6px;">${d.teamName || "Unnamed team"}</td>
                        <td style="padding:6px; text-align:right;">${d.points ?? 0}</td>
                      </tr>
                    `;
                  })
                  .join("")}
              </tbody>
            </table>
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
      if (playersEl) {
        playersEl.innerHTML = `
          <div class="note warnNote">
            Failed to load standings.<br>
            <span class="tiny muted">${err.message}</span>
          </div>
        `;
      }
      if (teamsEl) {
        teamsEl.innerHTML = `
          <div class="note warnNote">
            Failed to load standings.<br>
            <span class="tiny muted">${err.message}</span>
          </div>
        `;
      }
    }
  }

  // Export so app.js can call it later
  window.loadStandings = loadStandings;
})();