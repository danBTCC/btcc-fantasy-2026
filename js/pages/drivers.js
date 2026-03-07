// js/pages/drivers.js
// Exposes: window.loadDrivers()

(function () {
  function trendMeta(t) {
    if (t === "up") return { icon: "▲", cls: "up" };
    if (t === "down") return { icon: "▼", cls: "down" };
    return { icon: "—", cls: "same" };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normaliseDriverIdsFromEntry(data) {
    if (!data || typeof data !== "object") return [];

    const candidates = [];

    if (Array.isArray(data.driverIds)) candidates.push(...data.driverIds);
    if (Array.isArray(data.drivers)) candidates.push(...data.drivers);
    if (Array.isArray(data.selectedDrivers)) candidates.push(...data.selectedDrivers);
    if (Array.isArray(data.team)) candidates.push(...data.team);
    if (Array.isArray(data.picks)) candidates.push(...data.picks);
    if (Array.isArray(data.selection)) candidates.push(...data.selection);

    const ids = candidates
      .map((item) => {
        if (!item) return null;
        if (typeof item === "string") return item;
        if (typeof item === "object") {
          return item.driverId || item.id || item.ref || null;
        }
        return null;
      })
      .filter(Boolean);

    return [...new Set(ids)];
  }

  async function loadSelectionCounts(db, events) {
    const totals = new Map();

    for (const eventDoc of events) {
      const eventId = eventDoc.id;

      let entrySnap = null;

      try {
        entrySnap = await db.collection("entries").doc(eventId).collection("entries").get();
      } catch (err) {
        console.warn(`entries/${eventId}/entries read failed`, err);
      }

      if (!entrySnap || entrySnap.empty) {
        try {
          entrySnap = await db.collection("submissions").doc(eventId).collection("entries").get();
        } catch (err) {
          console.warn(`submissions/${eventId}/entries read failed`, err);
          entrySnap = null;
        }
      }

      if (!entrySnap || entrySnap.empty) continue;

      entrySnap.forEach((doc) => {
        const driverIds = normaliseDriverIdsFromEntry(doc.data());
        driverIds.forEach((driverId) => {
          totals.set(driverId, (totals.get(driverId) || 0) + 1);
        });
      });
    }

    return totals;
  }

  async function loadDriverPoints(db, events) {
    const totals = new Map();

    for (const eventDoc of events) {
      const eventId = eventDoc.id;

      let scoresSnap;
      try {
        scoresSnap = await db.collection("event_scores").doc(eventId).collection("players").get();
      } catch (err) {
        console.warn(`event_scores/${eventId}/players read failed`, err);
        continue;
      }

      if (!scoresSnap || scoresSnap.empty) continue;

      scoresSnap.forEach((doc) => {
        const data = doc.data() || {};
        const source = data.perDriverBreakdown || data.perDriverBySession || data.perDriver || {};

        Object.entries(source).forEach(([driverId, value]) => {
          let points = 0;

          if (typeof value === "number") {
            points = value;
          } else if (value && typeof value === "object") {
            points = Number(value.total ?? value.points ?? 0);
          }

          totals.set(driverId, (totals.get(driverId) || 0) + Number(points || 0));
        });
      });
    }

    return totals;
  }

  async function loadStoredDriverStandings(db) {
    const totals = new Map();

    try {
      const snap = await db
        .collection("standings_drivers")
        .doc("season_2026")
        .collection("drivers")
        .get();

      snap.forEach((doc) => {
        const data = doc.data() || {};
        totals.set(doc.id, Number(data.pointsTotal || data.points || 0));
      });
    } catch (err) {
      console.warn("standings_drivers/season_2026/drivers read failed", err);
    }

    return totals;
  }

  function renderDriverList(drivers) {
    return `<ul class="driverList">
      ${drivers
        .map((driver) => {
          const cats = Array.isArray(driver.categories)
            ? driver.categories.join(", ")
            : (driver.category || "");

          const tr = trendMeta(driver.trend);

          return `
            <li class="driverRow">
              <span class="driverMain">
                <strong>${escapeHtml(driver.name || "Unnamed")}</strong>
                <span class="muted">(${escapeHtml(cats)})</span>
              </span>

              <span class="driverMeta">
                <span class="money">£${Number(driver.value || 0).toFixed(2)}</span>
                <span class="muted">• Tier: ${escapeHtml(driver.tier || "TBD")}</span>
                <span class="trend ${tr.cls}" title="Trend">${tr.icon}</span>
              </span>
            </li>
          `;
        })
        .join("")}
    </ul>`;
  }

  function renderStatsTable(title, columns, rows, emptyMessage) {
    const head = columns.map((col) => `<th>${escapeHtml(col)}</th>`).join("");

    const body = rows.length
      ? rows
          .map((row) => {
            const cells = row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("");
            return `<tr>${cells}</tr>`;
          })
          .join("")
      : `<tr><td colspan="${columns.length}" class="muted">${escapeHtml(emptyMessage)}</td></tr>`;

    return `
      <section class="cardSection" style="margin-top:16px;">
        <h3 style="margin:0 0 10px;">${escapeHtml(title)}</h3>
        <div style="overflow-x:auto;">
          <table class="table" style="width:100%;">
            <thead>
              <tr>${head}</tr>
            </thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  async function loadDrivers() {
    const container = document.getElementById("drivers-list");
    if (!container) return;

    container.textContent = "Loading drivers...";

    try {
      if (!window.btccDb) throw new Error("btccDb is not defined (Firestore not ready)");

      const db = window.btccDb;

      const [driversSnap, eventsSnap] = await Promise.all([
        db.collection("drivers").where("active", "==", true).orderBy("name").get(),
        db.collection("events").get(),
      ]);

      if (driversSnap.empty) {
        container.textContent = "No active drivers yet.";
        return;
      }

      const drivers = driversSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const events = eventsSnap.docs;

      const [selectionCounts, storedDriverStandings, driverPoints] = await Promise.all([
        loadSelectionCounts(db, events),
        loadStoredDriverStandings(db),
        loadDriverPoints(db, events),
      ]);

      const getDriverPointsTotal = (driver) => {
        if (storedDriverStandings.has(driver.id)) {
          return Number(storedDriverStandings.get(driver.id) || 0);
        }
        if (typeof driver.pointsTotal === "number") return Number(driver.pointsTotal || 0);
        if (typeof driver.points === "number") return Number(driver.points || 0);
        return Number(driverPoints.get(driver.id) || 0);
      };

      const selectionRows = drivers
        .map((driver) => {
          const name = driver.name || "Unnamed";
          const selections = Number(selectionCounts.get(driver.id) || 0);
          const points = getDriverPointsTotal(driver);
          const pps = selections > 0 ? (points / selections).toFixed(1) : "0.0";

          return {
            name,
            selections,
            pps,
          };
        })
        .sort((a, b) => {
          const countDiff = b.selections - a.selections;
          if (countDiff !== 0) return countDiff;
          return a.name.localeCompare(b.name);
        })
        .map((row, index) => [String(index + 1), row.name, String(row.selections), row.pps]);

      const pointsRows = drivers
        .map((driver) => ({
          name: driver.name || "Unnamed",
          points: getDriverPointsTotal(driver),
        }))
        .sort((a, b) => {
          const pointsDiff = b.points - a.points;
          if (pointsDiff !== 0) return pointsDiff;
          return a.name.localeCompare(b.name);
        })
        .map((row, index) => [String(index + 1), row.name, String(row.points)]);

      container.innerHTML = `
        ${renderDriverList(drivers)}
        ${renderStatsTable(
          "Driver Selection Count",
          ["Pos", "Driver", "Selections", "PPS"],
          selectionRows,
          "No submission data yet."
        )}
        ${renderStatsTable(
          "Driver Points Standings",
          ["Pos", "Driver", "Points"],
          pointsRows,
          "No driver points yet."
        )}
      `;

      console.log("✅ Drivers loaded:", driversSnap.size);
      console.log("✅ Driver selection stats loaded:", selectionRows.length);
      console.log("✅ Driver points standings loaded:", pointsRows.length);
    } catch (err) {
      console.error("❌ loadDrivers failed:", err);
      container.innerHTML = `<div class="note warnNote">
        Failed to load drivers.<br>
        <span class="tiny muted">${escapeHtml(err?.message || err)}</span>
      </div>`;
    }
  }

  // Export so app.js can call it
  window.loadDrivers = loadDrivers;
})();