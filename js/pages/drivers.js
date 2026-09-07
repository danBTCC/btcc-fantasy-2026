// js/pages/drivers.js
// Exposes: window.loadDrivers()

(function () {
  function trendMeta(driver) {
    const change = Number(driver?.lastValueChange);

    if (Number.isFinite(change) && change > 0) return { icon: "▲", cls: "up" };
    if (Number.isFinite(change) && change < 0) return { icon: "▼", cls: "down" };

    const fallback = String(driver?.trend || "").toLowerCase();
    if (fallback === "up") return { icon: "▲", cls: "up" };
    if (fallback === "down") return { icon: "▼", cls: "down" };
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

  function formatTier(driver) {
    return String(driver?.tier || "TBD");
  }

  function calculateExpectedPoints(value, tdv, ppv) {
    const safeValue = Number(value || 0);
    const safeTdv = Number(tdv || 0);
    if (safeValue <= 0 || safeTdv <= 0) return 0;
    const vv = Number(ppv || 0) / safeTdv;
    return safeValue * vv;
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

  async function loadStoredDriverEventScores(db, events) {
    const totals = new Map();

    for (const eventDoc of events) {
      const eventId = eventDoc.id;

      try {
        const snap = await db.collection("event_scores").doc(eventId).collection("drivers").get();
        snap.forEach((doc) => {
          const data = doc.data() || {};
          totals.set(doc.id, Number(totals.get(doc.id) || 0) + Number(data.pointsTotal || data.points || 0));
        });
      } catch (err) {
        console.warn(`event_scores/${eventId}/drivers read failed`, err);
      }
    }

    return totals;
  }

  function normaliseFastestLapIds(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    return [String(value)];
  }

  async function loadDriverRaceStats(db, events, drivers) {
    const stats = new Map(
      drivers.map((driver) => [
        String(driver.id),
        { bestFinish: null, lowestFinish: null, podiums: 0, fastestLaps: 0 },
      ])
    );

    const completedEvents = events.filter((eventDoc) => {
      const data = eventDoc.data() || {};
      const status = String(data.status || "").toLowerCase();
      return data.resultsLocked === true || status === "complete";
    });

    await Promise.all(
      completedEvents.map(async (eventDoc) => {
        try {
          const resultDoc = await db.collection("results").doc(eventDoc.id).get();
          if (!resultDoc.exists) return;

          const data = resultDoc.data() || {};

          [1, 2, 3].forEach((raceNumber) => {
            const raceKey = `race${raceNumber}`;
            const classified = Array.isArray(data[raceKey]) ? data[raceKey] : [];

            classified.forEach((driverId, index) => {
              const driverStats = stats.get(String(driverId));
              if (!driverStats) return;

              const position = index + 1;
              driverStats.bestFinish = driverStats.bestFinish === null
                ? position
                : Math.min(driverStats.bestFinish, position);
              driverStats.lowestFinish = driverStats.lowestFinish === null
                ? position
                : Math.max(driverStats.lowestFinish, position);
              if (position <= 3) driverStats.podiums += 1;
            });

            const fastestLapIds = normaliseFastestLapIds(
              data[`${raceKey}FastestLapDriverIds`] ||
              data[`${raceKey}FastestLapIds`] ||
              data[`${raceKey}FastestLapDriverId`] ||
              data[`${raceKey}FastestLap`]
            );

            fastestLapIds.forEach((driverId) => {
              const driverStats = stats.get(driverId);
              if (driverStats) driverStats.fastestLaps += 1;
            });
          });
        } catch (err) {
          console.warn(`results/${eventDoc.id} read failed`, err);
        }
      })
    );

    return stats;
  }

  function formatOrdinal(position) {
    const value = Number(position);
    if (!Number.isInteger(value) || value < 1) return "—";

    const lastTwo = value % 100;
    const suffix = lastTwo >= 11 && lastTwo <= 13
      ? "th"
      : value % 10 === 1
      ? "st"
      : value % 10 === 2
      ? "nd"
      : value % 10 === 3
      ? "rd"
      : "th";

    return `${value}${suffix}`;
  }


  function renderStatsTable(title, columns, rows, emptyMessage) {
    const head = columns.map((col) => `<th>${col}</th>`).join("");

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
        <h3 style="margin:0 0 6px;">${escapeHtml(title)}</h3>
        <div class="tiny muted" style="margin-bottom:10px;">Tap any column with arrows to sort.</div>
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
        db.collection("drivers").orderBy("name").get(),
        db.collection("events").get(),
      ]);

      const drivers = driversSnap.docs
        .filter((doc) => {
          const data = doc.data() || {};
          return data.active !== false;
        })
        .map((doc) => ({ id: doc.id, ...doc.data() }));

      if (!drivers.length) {
        container.textContent = "No active drivers yet.";
        return;
      }

      const tdv = drivers.reduce((sum, driver) => sum + Number(driver.value || driver.cost || driver.price || 0), 0);
      const ppv = window.getPpvForActiveDriverCount(drivers.length);
      const events = eventsSnap.docs;

      const [selectionCounts, storedDriverEventScores, storedDriverStandings, driverPoints, driverRaceStats] = await Promise.all([
        loadSelectionCounts(db, events),
        loadStoredDriverEventScores(db, events),
        loadStoredDriverStandings(db),
        loadDriverPoints(db, events),
        loadDriverRaceStats(db, events, drivers),
      ]);

      const getDriverPointsTotal = (driver) => {
        if (storedDriverEventScores.has(driver.id)) {
          return Number(storedDriverEventScores.get(driver.id) || 0);
        }
        if (typeof driver.pointsTotal === "number") return Number(driver.pointsTotal || 0);
        if (typeof driver.points === "number") return Number(driver.points || 0);
        if (storedDriverStandings.has(driver.id)) {
          return Number(storedDriverStandings.get(driver.id) || 0);
        }
        return Number(driverPoints.get(driver.id) || 0);
      };

      let sortKey = "points";
      let sortDir = "desc";

      const driverOverviewData = drivers
        .map((driver) => {
          const name = driver.name || "Unnamed";
          const cats = Array.isArray(driver.categories)
            ? driver.categories.join(", ")
            : (driver.category || "");
          const value = Number(driver.value || driver.cost || driver.price || 0);
          const tier = formatTier(driver);
          const ep = calculateExpectedPoints(value, tdv, ppv);
          const points = getDriverPointsTotal(driver);
          const selections = Number(selectionCounts.get(driver.id) || 0);
          const raceStats = driverRaceStats.get(String(driver.id)) || {
            bestFinish: null,
            lowestFinish: null,
            podiums: 0,
            fastestLaps: 0,
          };
          const tr = trendMeta(driver);

          return {
            name,
            cats,
            value,
            tier,
            ep,
            points,
            selections,
            bestFinish: raceStats.bestFinish,
            lowestFinish: raceStats.lowestFinish,
            podiums: raceStats.podiums,
            fastestLaps: raceStats.fastestLaps,
            trendIcon: tr.icon,
          };
        });

      const getSortedRows = () => {
        const sorted = [...driverOverviewData].sort((a, b) => {
          const dir = sortDir === "asc" ? 1 : -1;

          if (sortKey === "name") return dir * a.name.localeCompare(b.name);
          if (sortKey === "value") return dir * (a.value - b.value);
          if (sortKey === "tier") return dir * a.tier.localeCompare(b.tier);
          if (sortKey === "ep") return dir * (a.ep - b.ep);
          if (sortKey === "points") return dir * (a.points - b.points);
          if (sortKey === "selections") return dir * (a.selections - b.selections);
          if (sortKey === "bestFinish" || sortKey === "lowestFinish") {
            const aValue = a[sortKey];
            const bValue = b[sortKey];
            if (aValue === null && bValue === null) return a.name.localeCompare(b.name);
            if (aValue === null) return 1;
            if (bValue === null) return -1;
            return dir * (aValue - bValue);
          }
          if (sortKey === "podiums") return dir * (a.podiums - b.podiums);
          if (sortKey === "fastestLaps") return dir * (a.fastestLaps - b.fastestLaps);

          return 0;
        });

        return sorted.map((row, index) => [
          String(index + 1),
          row.cats ? `${row.name} (${row.cats})` : row.name,
          `£${row.value.toFixed(2)}`,
          row.tier,
          Math.round(row.ep),
          String(row.points),
          String(row.selections),
          formatOrdinal(row.bestFinish),
          formatOrdinal(row.lowestFinish),
          String(row.podiums),
          String(row.fastestLaps),
          row.trendIcon,
        ]);
      };

      let driverOverviewRows = getSortedRows();

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
        <div class="tiny muted" style="margin-bottom:10px;">Current PPV: ${ppv} • Active Driver Total Value: £${tdv.toFixed(2)}</div>
        ${renderStatsTable(
          "Drivers Overview",
          [
            '<span data-sort="pos">Pos</span>',
            '<span data-sort="name">Driver ⇅</span>',
            '<span data-sort="value">Value ⇅</span>',
            '<span data-sort="tier">Tier ⇅</span>',
            '<span data-sort="ep">EP ⇅</span>',
            '<span data-sort="points">Points ↓</span>',
            '<span data-sort="selections">Selections ⇅</span>',
            '<span data-sort="bestFinish" title="Best classified race finish">Best Finish ⇅</span>',
            '<span data-sort="lowestFinish" title="Lowest classified race finish">Lowest Classified ⇅</span>',
            '<span data-sort="podiums">Podiums ⇅</span>',
            '<span data-sort="fastestLaps">Fastest Laps ⇅</span>',
            'Trend'
          ],
          driverOverviewRows,
          "No drivers available yet."
        )}
      `;

      container.querySelectorAll("[data-sort]").forEach((el) => {
        el.style.cursor = "pointer";
        el.setAttribute("title", "Tap to sort");
        el.addEventListener("click", () => {
          const key = el.getAttribute("data-sort");
          if (!key || key === "pos") return;

          if (sortKey === key) {
            sortDir = sortDir === "asc" ? "desc" : "asc";
          } else {
            sortKey = key;
            sortDir = "desc";
          }

          driverOverviewRows = getSortedRows();

          container.querySelector("tbody").innerHTML = driverOverviewRows
            .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
            .join("");

          container.querySelectorAll("[data-sort]").forEach((headerEl) => {
            const headerKey = headerEl.getAttribute("data-sort");
            if (!headerKey || headerKey === "pos") return;
            const label = headerKey === "name"
              ? "Driver"
              : headerKey === "value"
              ? "Value"
              : headerKey === "tier"
              ? "Tier"
              : headerKey === "ep"
              ? "EP"
              : headerKey === "points"
              ? "Points"
              : headerKey === "selections"
              ? "Selections"
              : headerKey === "bestFinish"
              ? "Best Finish"
              : headerKey === "lowestFinish"
              ? "Lowest Classified"
              : headerKey === "podiums"
              ? "Podiums"
              : headerKey === "fastestLaps"
              ? "Fastest Laps"
              : headerEl.textContent.replace(/[⇅↑↓]/g, "").trim();
            headerEl.textContent = `${label} ${sortKey === headerKey ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}`;
          });
        });
      });

      console.log("✅ Drivers loaded:", drivers.length, "TDV:", tdv);
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
