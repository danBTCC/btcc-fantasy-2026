// js/pages/standings.js
// Exposes: window.loadStandings()

(function () {
  async function loadStandings() {
    const updatedEl = document.getElementById("standings-updated");
    const updatedRowEl = updatedEl ? updatedEl.closest("p") : null;
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
    if (updatedEl) updatedEl.textContent = "—";
    if (updatedRowEl) updatedRowEl.hidden = true;

    if (!document.getElementById("standings-table-style")) {
      const style = document.createElement("style");
      style.id = "standings-table-style";
      style.textContent = `
        .standings-table {
          width: 100%;
          border-collapse: separate !important;
          border-spacing: 0 6px;
        }
        .standings-table thead th {
          padding: 8px 10px !important;
          color: rgba(255,255,255,.72);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .04em;
          border-bottom: 1px solid rgba(255,255,255,.12);
        }
        .standings-table tbody tr {
          background: rgba(255,255,255,.035);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.055);
        }
        .standings-table tbody tr:nth-child(odd) {
          background: rgba(255,255,255,.055);
        }
        .standings-table tbody tr:nth-child(1) {
          background: linear-gradient(90deg, rgba(255,215,0,.18), rgba(255,255,255,.04));
        }
        .standings-table tbody tr:nth-child(2) {
          background: linear-gradient(90deg, rgba(192,192,192,.16), rgba(255,255,255,.04));
        }
        .standings-table tbody tr:nth-child(3) {
          background: linear-gradient(90deg, rgba(205,127,50,.16), rgba(255,255,255,.04));
        }
        .standings-table tbody td {
          padding: 9px 10px !important;
          border: 0 !important;
        }
        .standings-table tbody td:first-child {
          border-radius: 10px 0 0 10px;
          color: rgba(255,255,255,.78);
          font-weight: 800;
          width: 44px;
        }
        .standings-table tbody td:last-child {
          border-radius: 0 10px 10px 0;
          font-weight: 900;
          color: #fff;
        }
        .standings-points-pill {
          display: inline-block;
          min-width: 42px;
          padding: 3px 8px;
          border-radius: 999px;
          background: rgba(37,99,235,.22);
          box-shadow: inset 0 0 0 1px rgba(96,165,250,.28);
          text-align: center;
        }
        .standings-move {
          display:inline-block;
          min-width:42px;
          font-weight:800;
        }
        .standings-move.up {
          color:#4ade80;
        }
        .standings-move.down {
          color:#f87171;
        }
        .standings-move.same {
          color:rgba(255,255,255,.55);
        }
      `;
      document.head.appendChild(style);
    }
      // --- Helpers (shared by all tables) ---
      const renderSimplePointsTable = (mountEl, rows, labelName) => {
        if (!mountEl) return;
        if (!rows.length) {
          mountEl.textContent = "No data yet";
          return;
        }
        mountEl.innerHTML = `
          <table class="table tiny standings-table">
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
                      <td style="padding:6px; text-align:right;"><span class="standings-points-pill">${r.points}</span></td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        `;
      };

      // Helper for movement arrows/cells in standings
      const getMovementHtml = (currentPos, previousPos) => {
        if (previousPos == null || previousPos === "") {
          return '<span class="standings-move same">-</span>';
        }
      
        const change = Number(previousPos) - Number(currentPos);
      
        if (change > 0) {
          return `<span class="standings-move up">↑ ${change}</span>`;
        }
      
        if (change < 0) {
          return `<span class="standings-move down">↓ ${Math.abs(change)}</span>`;
        }
      
        return '<span class="standings-move same">-</span>';
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

      const buildRaceRowsFromEventScores = async (raceKey) => {
        const [eventsSnap, playersSnap] = await Promise.all([
          window.btccDb.collection("events").orderBy("eventNo").get(),
          window.btccDb.collection("players").get(),
        ]);

        const playerNames = new Map();
        playersSnap.forEach((doc) => {
          const d = doc.data() || {};
          playerNames.set(doc.id, d.displayName || d.name || "Unnamed");
        });

        const totals = new Map();

        for (const eventDoc of eventsSnap.docs) {
          const eventScorePlayersSnap = await window.btccDb
            .collection("event_scores")
            .doc(eventDoc.id)
            .collection("players")
            .get();

          eventScorePlayersSnap.forEach((playerDoc) => {
            const d = playerDoc.data() || {};
            const breakdown = d.breakdown || {};
            const racePoints = Number(
              breakdown[raceKey] ??
              d[raceKey] ??
              d?.raceBreakdown?.[raceKey] ??
              0
            );

            const existing = totals.get(playerDoc.id) || {
              id: playerDoc.id,
              name: d.displayName || playerNames.get(playerDoc.id) || "Unnamed",
              points: 0,
            };

            existing.points += Number.isFinite(racePoints) ? racePoints : 0;
            if (!existing.name || existing.name === "Unnamed") {
              existing.name = d.displayName || playerNames.get(playerDoc.id) || "Unnamed";
            }
            totals.set(playerDoc.id, existing);
          });
        }

        return Array.from(totals.values()).sort((a, b) => b.points - a.points);
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
            <table class="table tiny standings-table">
              <thead>
                <tr>
                  <th style="text-align:left; padding:6px;">Pos</th>
                  <th style="text-align:left; padding:6px;">Player</th>
                  <th style="text-align:center; padding:6px;">Move</th>
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
                        <td style="padding:6px; text-align:center;">${getMovementHtml(idx + 1, d.previousPosition)}</td>
                        <td style="padding:6px; text-align:right;"><span class="standings-points-pill">${d.pointsTotal ?? d.points ?? 0}</span></td>
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

        // Fallback: if no generated team standings exist, build them from player standings + player team fields.
        if (!teamsDocs.length) {
          const [playerStandingsSnap, playersSnap] = await Promise.all([
            window.btccDb
              .collection("standings_players")
              .doc("season_2026")
              .collection("players")
              .get(),
            window.btccDb.collection("players").get(),
          ]);

          const playerMeta = new Map();
          playersSnap.forEach((doc) => {
            const d = doc.data() || {};
            playerMeta.set(doc.id, {
              teamId: d.teamId || "",
              teamName: d.teamName || "",
            });
          });

          const teamTotals = new Map();
          playerStandingsSnap.forEach((doc) => {
            const d = doc.data() || {};
            const meta = playerMeta.get(doc.id) || {};
            const teamId = String(meta.teamId || d.teamId || "").trim();
            if (!teamId) return;

            const existing = teamTotals.get(teamId) || {
              teamId,
              teamName: meta.teamName || d.teamName || teamId,
              pointsTotal: 0,
              playerCount: 0,
            };

            existing.pointsTotal += Number(d.pointsTotal ?? d.points ?? 0);
            existing.playerCount += 1;
            if (!existing.teamName || existing.teamName === teamId) {
              existing.teamName = meta.teamName || d.teamName || teamId;
            }

            teamTotals.set(teamId, existing);
          });

          teamsDocs = Array.from(teamTotals.values())
            .sort((a, b) => Number(b.pointsTotal || 0) - Number(a.pointsTotal || 0))
            .map((team) => ({
              id: team.teamId,
              data: () => team,
            }));
        }

        if (!teamsDocs.length) {
          teamsEl.textContent = "No data yet";
        } else {
          teamsEl.innerHTML = `
            <table class="table tiny standings-table">
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
                        <td style="padding:6px; text-align:right;"><span class="standings-points-pill">${d.pointsTotal ?? d.points ?? 0}</span></td>
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
            <table class="table tiny standings-table">
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
                        <td style="padding:6px; text-align:right;"><span class="standings-points-pill">${d.pointsTotal ?? d.points ?? 0}</span></td>
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
        const rows = await buildRaceRowsFromEventScores("race1");
        renderSimplePointsTable(race1El, rows, "Player");
        console.log("✅ Race 1 standings loaded from event_scores:", rows.length);
      }

      // ---- Race 2 standings ----
      if (race2El) {
        const rows = await buildRaceRowsFromEventScores("race2");
        renderSimplePointsTable(race2El, rows, "Player");
        console.log("✅ Race 2 standings loaded from event_scores:", rows.length);
      }

      // ---- Race 3 standings ----
      if (race3El) {
        const rows = await buildRaceRowsFromEventScores("race3");
        renderSimplePointsTable(race3El, rows, "Player");
        console.log("✅ Race 3 standings loaded from event_scores:", rows.length);
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