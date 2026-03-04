// js/pages/standings.js
// Exposes: window.loadStandings()

(function () {
  async function loadStandings() {
    const updatedEl = document.getElementById("standings-updated");
    const playersEl = document.getElementById("standings-players");
    const teamsEl = document.getElementById("standings-teams");
    const teamsWrapEl = document.getElementById("standings-teams-wrap");
    const wingfootEl = document.getElementById("standings-wingfoot");
    const manufacturerEl = document.getElementById("standings-manufacturer");
    const independentEl = document.getElementById("standings-independent");
    const jacksearsEl = document.getElementById("standings-jacksears");
    const race1El = document.getElementById("standings-race1");
    const race2El = document.getElementById("standings-race2");
    const race3El = document.getElementById("standings-race3");

    if (playersEl) playersEl.textContent = "Loading…";
    if (teamsEl) teamsEl.textContent = "Loading…";
    if (wingfootEl) wingfootEl.textContent = "Loading…";
    if (manufacturerEl) manufacturerEl.textContent = "Loading…";
    if (independentEl) independentEl.textContent = "Loading…";
    if (jacksearsEl) jacksearsEl.textContent = "Loading…";
    if (race1El) race1El.textContent = "Loading…";
    if (race2El) race2El.textContent = "Loading…";
    if (race3El) race3El.textContent = "Loading…";
      // --- Helpers (shared by all tables) ---
      const renderSimplePointsTable = (mountEl, rows, labelName) => {
        if (!mountEl) return;
        if (!rows.length) {
          mountEl.textContent = "No data yet";
          return;
        }
        mountEl.innerHTML = `
          <table class="table tiny" style="width:100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="text-align:left; padding:6px;">Pos</th>
                <th style="text-align:left; padding:6px;">${labelName}</th>
                <th style="text-align:right; padding:6px;">Points</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map((r, idx) => {
                  return `
                    <tr>
                      <td style="padding:6px;">${idx + 1}</td>
                      <td style="padding:6px;">${r.name || "Unnamed"}</td>
                      <td style="padding:6px; text-align:right;">${r.points}</td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        `;
      };

      const readSortedPointsDocs = async (colRef) => {
        // Prefer server-side sort if pointsTotal exists
        const orderedSnap = await colRef.orderBy("pointsTotal", "desc").get();
        if (!orderedSnap.empty) return orderedSnap.docs;

        // Fallback: fetch all then sort locally
        const allSnap = await colRef.get();
        return allSnap.docs
          .slice()
          .sort((a, b) => {
            const ap = Number(a.data()?.pointsTotal ?? a.data()?.points ?? 0);
            const bp = Number(b.data()?.pointsTotal ?? b.data()?.points ?? 0);
            return bp - ap;
          });
      };

    try {
      if (!window.btccDb) {
        throw new Error("btccDb not available");
      }

      // UI-only toggle wiring for collapsible sections
      const toggleButtons = document.querySelectorAll('[data-toggle]');
      toggleButtons.forEach((btn) => {
        btn.onclick = () => {
          const targetId = btn.getAttribute('data-toggle');
          const targetEl = document.getElementById(targetId);
          if (targetEl) {
            targetEl.hidden = !targetEl.hidden;
          }
        };
      });

      // ---- Players standings ----
      if (playersEl) {
        let playersDocs = [];

        // Prefer server-side sort if pointsTotal exists
        const orderedSnap = await window.btccDb
          .collection("standings_players")
          .doc("season_2026")
          .collection("players")
          .orderBy("pointsTotal", "desc")
          .get();

        if (!orderedSnap.empty) {
          playersDocs = orderedSnap.docs;
        } else {
          // Fallback: fetch all, then sort locally (handles missing pointsTotal field)
          const allSnap = await window.btccDb
            .collection("standings_players")
            .doc("season_2026")
            .collection("players")
            .get();

          playersDocs = allSnap.docs
            .slice()
            .sort((a, b) => {
              const ap = Number(a.data()?.pointsTotal ?? a.data()?.points ?? 0);
              const bp = Number(b.data()?.pointsTotal ?? b.data()?.points ?? 0);
              return bp - ap;
            });
        }

        if (!playersDocs.length) {
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
                ${playersDocs
                  .map((doc, idx) => {
                    const d = doc.data() || {};
                    return `
                      <tr>
                        <td style="padding:6px;">${idx + 1}</td>
                        <td style="padding:6px;">${d.displayName || "Unnamed"}</td>
                        <td style="padding:6px; text-align:right;">${d.pointsTotal ?? d.points ?? 0}</td>
                      </tr>
                    `;
                  })
                  .join("")}
              </tbody>
            </table>
          `;
        }

        console.log("✅ Players standings loaded:", playersDocs.length);
      }

      // ---- Teams standings ----
      if (teamsEl) {
        let teamsDocs = [];

        const orderedSnap = await window.btccDb
          .collection("standings_teams")
          .doc("season_2026")
          .collection("teams")
          .orderBy("pointsTotal", "desc")
          .get();

        if (!orderedSnap.empty) {
          teamsDocs = orderedSnap.docs;
        } else {
          const allSnap = await window.btccDb
            .collection("standings_teams")
            .doc("season_2026")
            .collection("teams")
            .get();

          teamsDocs = allSnap.docs
            .slice()
            .sort((a, b) => {
              const ap = Number(a.data()?.pointsTotal ?? a.data()?.points ?? 0);
              const bp = Number(b.data()?.pointsTotal ?? b.data()?.points ?? 0);
              return bp - ap;
            });
        }

        if (!teamsDocs.length) {
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
                ${teamsDocs
                  .map((doc, idx) => {
                    const d = doc.data() || {};
                    return `
                      <tr>
                        <td style="padding:6px;">${idx + 1}</td>
                        <td style="padding:6px;">${d.teamName || "Unnamed team"}</td>
                        <td style="padding:6px; text-align:right;">${d.pointsTotal ?? d.points ?? 0}</td>
                      </tr>
                    `;
                  })
                  .join("")}
              </tbody>
            </table>
          `;
        }

        // teamsWrapEl exists and is hidden by default, no change needed to show/hide
        console.log("✅ Teams standings loaded:", teamsDocs.length);
      }

      // ---- WingFoot (Qualifying) standings ----
      if (wingfootEl) {
        let wingDocs = [];

        const orderedSnap = await window.btccDb
          .collection("standings_wingfoot")
          .doc("season_2026")
          .collection("players")
          .orderBy("pointsTotal", "desc")
          .get();

        if (!orderedSnap.empty) {
          wingDocs = orderedSnap.docs;
        } else {
          const allSnap = await window.btccDb
            .collection("standings_wingfoot")
            .doc("season_2026")
            .collection("players")
            .get();

          wingDocs = allSnap.docs
            .slice()
            .sort((a, b) => {
              const ap = Number(a.data()?.pointsTotal ?? a.data()?.points ?? 0);
              const bp = Number(b.data()?.pointsTotal ?? b.data()?.points ?? 0);
              return bp - ap;
            });
        }

        if (!wingDocs.length) {
          wingfootEl.textContent = "No data yet";
        } else {
          wingfootEl.innerHTML = `
            <table class="table tiny" style="width:100%; border-collapse: collapse;">
              <thead>
                <tr>
                  <th style="text-align:left; padding:6px;">Pos</th>
                  <th style="text-align:left; padding:6px;">Player</th>
                  <th style="text-align:right; padding:6px;">Points</th>
                </tr>
              </thead>
              <tbody>
                ${wingDocs
                  .map((doc, idx) => {
                    const d = doc.data() || {};
                    return `
                      <tr>
                        <td style="padding:6px;">${idx + 1}</td>
                        <td style="padding:6px;">${d.displayName || "Unnamed"}</td>
                        <td style="padding:6px; text-align:right;">${d.pointsTotal ?? d.points ?? 0}</td>
                      </tr>
                    `;
                  })
                  .join("")}
              </tbody>
            </table>
          `;
        }

        console.log("✅ WingFoot standings loaded:", wingDocs.length);
      }

      // ---- Manufacturer standings ----
      if (manufacturerEl) {
        const docs = await readSortedPointsDocs(
          window.btccDb
            .collection("standings_manufacturer")
            .doc("season_2026")
            .collection("players")
        );

        const rows = docs.map((doc) => {
          const d = doc.data() || {};
          return {
            name: d.displayName || "Unnamed",
            points: Number(d.pointsTotal ?? d.points ?? 0),
          };
        });

        renderSimplePointsTable(manufacturerEl, rows, "Player");
        console.log("✅ Manufacturer standings loaded:", rows.length);
      }

      // ---- Independent standings ----
      if (independentEl) {
        const docs = await readSortedPointsDocs(
          window.btccDb
            .collection("standings_independent")
            .doc("season_2026")
            .collection("players")
        );

        const rows = docs.map((doc) => {
          const d = doc.data() || {};
          return {
            name: d.displayName || "Unnamed",
            points: Number(d.pointsTotal ?? d.points ?? 0),
          };
        });

        renderSimplePointsTable(independentEl, rows, "Player");
        console.log("✅ Independent standings loaded:", rows.length);
      }

      // ---- Jack Sears standings ----
      if (jacksearsEl) {
        const docs = await readSortedPointsDocs(
          window.btccDb
            .collection("standings_jacksears")
            .doc("season_2026")
            .collection("players")
        );

        const rows = docs.map((doc) => {
          const d = doc.data() || {};
          return {
            name: d.displayName || "Unnamed",
            points: Number(d.pointsTotal ?? d.points ?? 0),
          };
        });

        renderSimplePointsTable(jacksearsEl, rows, "Player");
        console.log("✅ Jack Sears standings loaded:", rows.length);
      }

      // ---- Race 1 standings ----
      if (race1El) {
        const docs = await readSortedPointsDocs(
          window.btccDb
            .collection("standings_race1")
            .doc("season_2026")
            .collection("players")
        );

        const rows = docs.map((doc) => {
          const d = doc.data() || {};
          return {
            name: d.displayName || "Unnamed",
            points: Number(d.pointsTotal ?? d.points ?? 0),
          };
        });

        renderSimplePointsTable(race1El, rows, "Player");
        console.log("✅ Race 1 standings loaded:", rows.length);
      }

      // ---- Race 2 standings ----
      if (race2El) {
        const docs = await readSortedPointsDocs(
          window.btccDb
            .collection("standings_race2")
            .doc("season_2026")
            .collection("players")
        );

        const rows = docs.map((doc) => {
          const d = doc.data() || {};
          return {
            name: d.displayName || "Unnamed",
            points: Number(d.pointsTotal ?? d.points ?? 0),
          };
        });

        renderSimplePointsTable(race2El, rows, "Player");
        console.log("✅ Race 2 standings loaded:", rows.length);
      }

      // ---- Race 3 standings ----
      if (race3El) {
        const docs = await readSortedPointsDocs(
          window.btccDb
            .collection("standings_race3")
            .doc("season_2026")
            .collection("players")
        );

        const rows = docs.map((doc) => {
          const d = doc.data() || {};
          return {
            name: d.displayName || "Unnamed",
            points: Number(d.pointsTotal ?? d.points ?? 0),
          };
        });

        renderSimplePointsTable(race3El, rows, "Player");
        console.log("✅ Race 3 standings loaded:", rows.length);
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