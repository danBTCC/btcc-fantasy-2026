// js/admin/engine.js
// Copy-first extraction of the admin engine family.
// Keep the original engine code in js/pages/admin.js until this file is confirmed working.

(function () {
  const PPV_LOOKUP_2026 = {
    15: 390,
    16: 438,
    17: 489,
    18: 543,
    19: 600,
    20: 660,
    21: 723,
    22: 789,
    23: 858,
    24: 930,
  };
  const TIER_SPLIT_LOOKUP_2026 = {
    15: { high: 5, middle: 5, low: 5 },
    16: { high: 5, middle: 6, low: 5 },
    17: { high: 5, middle: 7, low: 5 },
    18: { high: 5, middle: 8, low: 5 },
    19: { high: 5, middle: 9, low: 5 },
    20: { high: 6, middle: 8, low: 6 },
    21: { high: 6, middle: 9, low: 6 },
    22: { high: 6, middle: 10, low: 6 },
    23: { high: 7, middle: 9, low: 7 },
    24: { high: 7, middle: 10, low: 7 },
  };
  const PTR_2026 = 0.10;
  const MIN_DRIVER_VALUE_2026 = 0.10;

  function roundMoney2(v) {
    return Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
  }

  function floorMoney2(v) {
    return Math.floor((Number(v || 0) + Number.EPSILON) * 100) / 100;
  }

  function getPpvForActiveDriverCount(activeDriverCount) {
    const count = Number(activeDriverCount || 0);
    if (!Number.isFinite(count)) throw new Error("Invalid active driver count for PPV lookup");

    const ppv = PPV_LOOKUP_2026[count];
    if (typeof ppv !== "number") {
      throw new Error(`No PPV configured for active driver count: ${count}`);
    }

    return ppv;
  }

  function getTierSplitForActiveDriverCount(activeDriverCount) {
    const count = Number(activeDriverCount || 0);
    if (!Number.isFinite(count)) throw new Error("Invalid active driver count for tier lookup");

    const split = TIER_SPLIT_LOOKUP_2026[count];
    if (!split) {
      throw new Error(`No tier split configured for active driver count: ${count}`);
    }

    return split;
  }

  async function getEntryDocsForEvent(eventId) {
    const primary = await window.btccDb.collection("entries").doc(eventId).collection("entries").get();
    if (!primary.empty) return primary;

    const fallback = await window.btccDb.collection("submissions").doc(eventId).collection("entries").get();
    return fallback;
  }

  function safeTeamIdsFromEntry(entry) {
    const candidates = [
      entry?.team,
      entry?.drivers,
      entry?.selectedDrivers,
      entry?.driverIds,
      entry?.picks,
      entry?.selection,
    ];
    const arr = candidates.find((x) => Array.isArray(x));
    const ids = Array.isArray(arr) ? arr.filter(Boolean).map(String) : [];
    if (ids.length < 3 || ids.length > 6) return [];
    return Array.from(new Set(ids));
  }

  function buildCategoryDriverPoints(drivers, gpMap, categoryKey) {
    let pool = [];

    if (categoryKey === "manufacturer") {
      pool = drivers.filter((d) => (d.categories || []).includes("M"));
    } else if (categoryKey === "independent") {
      pool = drivers.filter((d) => (d.categories || []).includes("I"));
    } else if (categoryKey === "jacksears") {
      pool = drivers.filter((d) => (d.categories || []).includes("JS"));
    }

    const sorted = pool
      .map((driver) => ({
        ...driver,
        gp: Number(gpMap.get(driver.id) || 0),
      }))
      .sort((a, b) => {
        if (b.gp !== a.gp) return b.gp - a.gp;
        return a.name.localeCompare(b.name);
      });

    const total = sorted.length;
    const pointsMap = new Map();
    sorted.forEach((driver, idx) => {
      const pts = total - idx;
      pointsMap.set(driver.id, Number(pts || 0));
    });

    return {
      rows: sorted,
      pointsMap,
      categorySize: total,
    };
  }

  async function runCategoryStandingsEngineJ5(root, eventId) {
    if (!window.btccDb) throw new Error("Database not ready");
    if (!eventId) throw new Error("No event selected for category standings engine");

    const eventMeta = root.__eventMeta || {};
    const selectedEventNo = Number(eventMeta.eventNo || 0);

    const [driversSnap, playersSnap, eventsSnap] = await Promise.all([
      window.btccDb.collection("drivers").get(),
      window.btccDb.collection("players").get(),
      window.btccDb.collection("events").orderBy("eventNo").get(),
    ]);

    const activeDrivers = driversSnap.docs
      .map((doc) => {
        const d = doc.data() || {};
        return {
          id: doc.id,
          name: (d.name || doc.id).toString(),
          active: d.active !== false,
          categories: Array.isArray(d.categories) ? d.categories : [],
        };
      })
      .filter((d) => d.active);

    if (!activeDrivers.length) {
      throw new Error("No active drivers found for category standings engine");
    }

    const activePlayers = playersSnap.docs
      .map((doc) => {
        const d = doc.data() || {};
        return {
          uid: doc.id,
          displayName: (d.displayName || d.name || doc.id).toString(),
          active: d.active !== false,
        };
      })
      .filter((p) => p.active);

    const eventRows = eventsSnap.docs
      .map((doc) => {
        const d = doc.data() || {};
        return {
          id: doc.id,
          eventNo: Number(d.eventNo || 0),
        };
      })
      .filter((row) => !selectedEventNo || row.eventNo <= selectedEventNo)
      .sort((a, b) => a.eventNo - b.eventNo);

    const seasonTotals = {
      manufacturer: new Map(),
      independent: new Map(),
      jacksears: new Map(),
    };

    activePlayers.forEach((player) => {
      seasonTotals.manufacturer.set(player.uid, 0);
      seasonTotals.independent.set(player.uid, 0);
      seasonTotals.jacksears.set(player.uid, 0);
    });

    for (const ev of eventRows) {
      const [entriesSnap, scoresSnap] = await Promise.all([
        getEntryDocsForEvent(ev.id),
        window.btccDb.collection("event_scores").doc(ev.id).collection("drivers").get(),
      ]);

      const gpMap = new Map();
      scoresSnap.forEach((doc) => {
        const data = doc.data() || {};
        gpMap.set(String(doc.id), Number(data.pointsTotal || 0));
      });

      const manufacturer = buildCategoryDriverPoints(activeDrivers, gpMap, "manufacturer");
      const independent = buildCategoryDriverPoints(activeDrivers, gpMap, "independent");
      const jacksears = buildCategoryDriverPoints(activeDrivers, gpMap, "jacksears");

      entriesSnap.forEach((doc) => {
        const uid = doc.id;
        if (!seasonTotals.manufacturer.has(uid)) return;

        const entry = doc.data() || {};
        const teamIds = safeTeamIdsFromEntry(entry);

        const mPts = teamIds.reduce((sum, driverId) => sum + Number(manufacturer.pointsMap.get(driverId) || 0), 0);
        const iPts = teamIds.reduce((sum, driverId) => sum + Number(independent.pointsMap.get(driverId) || 0), 0);
        const jsPts = teamIds.reduce((sum, driverId) => sum + Number(jacksears.pointsMap.get(driverId) || 0), 0);

        seasonTotals.manufacturer.set(uid, Number(seasonTotals.manufacturer.get(uid) || 0) + Number(mPts || 0));
        seasonTotals.independent.set(uid, Number(seasonTotals.independent.get(uid) || 0) + Number(iPts || 0));
        seasonTotals.jacksears.set(uid, Number(seasonTotals.jacksears.get(uid) || 0) + Number(jsPts || 0));
      });
    }

    const batch = window.btccDb.batch();
    const categories = [
      { key: "manufacturer", collection: "standings_manufacturer" },
      { key: "independent", collection: "standings_independent" },
      { key: "jacksears", collection: "standings_jacksears" },
    ];

    categories.forEach(({ key, collection }) => {
      const seasonRef = window.btccDb.collection(collection).doc("season_2026");
      batch.set(
        seasonRef,
        {
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastEventId: eventId,
          playerCount: activePlayers.length,
          engineVersion: "J5.0",
        },
        { merge: true }
      );

      activePlayers.forEach((player) => {
        const pointsTotal = Number(seasonTotals[key].get(player.uid) || 0);
        const playerRef = seasonRef.collection("players").doc(player.uid);
        batch.set(
          playerRef,
          {
            uid: player.uid,
            displayName: player.displayName,
            name: player.displayName,
            pointsTotal,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            engineVersion: "J5.0",
          },
          { merge: true }
        );
      });
    });

    await batch.commit();

    return {
      playerCount: activePlayers.length,
      eventCount: eventRows.length,
      manufacturerDrivers: activeDrivers.filter((d) => (d.categories || []).includes("M")).length,
      independentDrivers: activeDrivers.filter((d) => (d.categories || []).includes("I")).length,
      jackSearsDrivers: activeDrivers.filter((d) => (d.categories || []).includes("JS")).length,
    };
  }

  async function runDriverValueEngineJ1(root, eventId) {
    if (!window.btccDb) throw new Error("Database not ready");
    if (!eventId) throw new Error("No event selected for value engine");

    const [driversSnap, scoresSnap] = await Promise.all([
      window.btccDb.collection("drivers").get(),
      window.btccDb.collection("event_scores").doc(eventId).collection("drivers").get(),
    ]);

    const activeDrivers = driversSnap.docs
      .map((doc) => {
        const d = doc.data() || {};
        return {
          id: doc.id,
          name: (d.name || doc.id).toString(),
          active: d.active !== false,
          value: Number(d.value || 0),
          category: d.category || "",
        };
      })
      .filter((d) => d.active);

    if (!activeDrivers.length) {
      throw new Error("No active drivers found for value engine");
    }

    const tdv = activeDrivers.reduce(
      (sum, d) => sum + Math.max(Number(d.value || 0), MIN_DRIVER_VALUE_2026),
      0
    );

    if (!tdv || tdv <= 0) {
      throw new Error("Total Driver Value (TDV) is zero");
    }

    const ppv = getPpvForActiveDriverCount(activeDrivers.length);
    const vv = ppv / tdv;

    const gpMap = new Map();

    scoresSnap.forEach((doc) => {
      const data = doc.data() || {};
      gpMap.set(String(doc.id), Number(data.pointsTotal || 0));
    });

    const calcRows = activeDrivers.map((driver) => {
      const dv = Math.max(Number(driver.value || 0), MIN_DRIVER_VALUE_2026);
      const gp = Number(gpMap.get(driver.id) || 0);
      const ep = vv * dv;
      const diffRatio = ep > 0 ? ((gp - ep) / ep) : 0;
      const appliedChangeRaw = dv * diffRatio * PTR_2026;
      const ndvRaw = dv + appliedChangeRaw;
      const ndv = Math.max(MIN_DRIVER_VALUE_2026, roundMoney2(ndvRaw));
      const ac = roundMoney2(ndv - dv);

      return {
        driverId: driver.id,
        name: driver.name,
        category: driver.category,
        active: true,
        dv: roundMoney2(dv),
        gp: roundMoney2(gp),
        ep: roundMoney2(ep),
        d: Number(diffRatio || 0),
        ptr: PTR_2026,
        ac,
        ndv,
      };
    });

    const batch = window.btccDb.batch();

    calcRows.forEach((row) => {
      const runRef = window.btccDb
        .collection("driver_value_runs")
        .doc(eventId)
        .collection("drivers")
        .doc(row.driverId);

      batch.set(
        runRef,
        {
          eventId,
          driverId: row.driverId,
          name: row.name,
          category: row.category,
          dv: row.dv,
          gp: row.gp,
          ep: row.ep,
          d: row.d,
          ptr: row.ptr,
          ac: row.ac,
          ndv: row.ndv,
          computedAt: firebase.firestore.FieldValue.serverTimestamp(),
          engineVersion: "J1.0",
        },
        { merge: false }
      );

      const driverRef = window.btccDb.collection("drivers").doc(row.driverId);
      batch.set(
        driverRef,
        {
          value: row.ndv,
          previousValue: row.dv,
          lastGp: row.gp,
          lastEp: row.ep,
          lastDiffRatio: row.d,
          lastValueChange: row.ac,
          lastValueEventId: eventId,
          valueUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    batch.set(
      window.btccDb.collection("driver_value_runs").doc(eventId),
      {
        eventId,
        ppv,
        tdv: roundMoney2(tdv),
        vv: roundMoney2(vv),
        ptr: PTR_2026,
        activeDriverCount: activeDrivers.length,
        computedAt: firebase.firestore.FieldValue.serverTimestamp(),
        engineVersion: "J1.0",
      },
      { merge: true }
    );

    await batch.commit();

    return {
      driverCount: calcRows.length,
      tdv: roundMoney2(tdv),
      vv: roundMoney2(vv),
    };
  }

  async function runPlayerBudgetEngineJ2(root, eventId) {
    if (!window.btccDb) throw new Error("Database not ready");
    if (!eventId) throw new Error("No event selected for budget engine");

    const [runSnap, playersSnap, entriesSnapA] = await Promise.all([
      window.btccDb.collection("driver_value_runs").doc(eventId).collection("drivers").get(),
      window.btccDb.collection("players").get(),
      window.btccDb.collection("entries").doc(eventId).collection("entries").get(),
    ]);

    let entriesSnap = entriesSnapA;
    if (entriesSnap.empty) {
      const alt = await window.btccDb.collection("submissions").doc(eventId).collection("entries").get();
      if (!alt.empty) entriesSnap = alt;
    }

    const driverRunMap = new Map();
    runSnap.forEach((doc) => {
      const d = doc.data() || {};
      driverRunMap.set(doc.id, {
        dv: Number(d.dv || 0),
        ndv: Number(d.ndv || 0),
        ac: Number(d.ac || 0),
        gp: Number(d.gp || 0),
      });
    });

    const playerMap = new Map();
    playersSnap.forEach((doc) => {
      const d = doc.data() || {};
      playerMap.set(doc.id, {
        budget: Number(d.budget || d.baseBudget || 10),
        displayName: (d.displayName || d.name || doc.id).toString(),
        active: d.active !== false,
      });
    });


    const batch = window.btccDb.batch();
    let playerCount = 0;

    entriesSnap.forEach((doc) => {
      const uid = doc.id;
      const entry = doc.data() || {};
      const player = playerMap.get(uid) || { budget: 10, displayName: uid, active: true };
      const teamIds = safeTeamIdsFromEntry(entry);

      const perDriverRawChanges = {};
      const perDriverAppliedChanges = {};
      let totalPositive = 0;
      let totalNegative = 0;

      teamIds.forEach((driverId) => {
        const row = driverRunMap.get(driverId);
        const raw = Number(row?.ac || 0);
        const applied = raw < 0 ? Math.max(raw, -0.10) : raw;
        perDriverRawChanges[driverId] = roundMoney2(raw);
        perDriverAppliedChanges[driverId] = roundMoney2(applied);
        if (applied >= 0) totalPositive += applied;
        else totalNegative += applied;
      });

      const cappedNegative = Math.max(totalNegative, -0.60);
      const totalChange = roundMoney2(totalPositive + cappedNegative);
      const startingBudget = roundMoney2(player.budget);
      const newBudget = roundMoney2(startingBudget + totalChange);

      const runRef = window.btccDb.collection("player_budget_runs").doc(eventId).collection("players").doc(uid);
      batch.set(
        runRef,
        {
          eventId,
          uid,
          displayName: player.displayName,
          startingBudget,
          teamIds,
          perDriverRawChanges,
          perDriverAppliedChanges,
          totalPositive: roundMoney2(totalPositive),
          totalNegativeRaw: roundMoney2(totalNegative),
          totalNegativeApplied: roundMoney2(cappedNegative),
          totalChange,
          newBudget,
          computedAt: firebase.firestore.FieldValue.serverTimestamp(),
          engineVersion: "J2.0",
        },
        { merge: false }
      );

      const playerRef = window.btccDb.collection("players").doc(uid);
      batch.set(
        playerRef,
        {
          budget: newBudget,
          baseBudget: newBudget,
          previousBudget: startingBudget,
          lastBudgetChange: totalChange,
          lastBudgetEventId: eventId,
          budgetUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      playerCount += 1;
    });

    batch.set(
      window.btccDb.collection("player_budget_runs").doc(eventId),
      {
        eventId,
        playerCount,
        computedAt: firebase.firestore.FieldValue.serverTimestamp(),
        engineVersion: "J2.0",
      },
      { merge: true }
    );

    await batch.commit();

    return { playerCount };
  }

  async function runDriverTierEngineJ3(root, eventId) {
    if (!window.btccDb) throw new Error("Database not ready");
    if (!eventId) throw new Error("No event selected for tier engine");

    const eventMeta = root.__eventMeta || {};
    const eventNo = Number(eventMeta.eventNo || 0);
    if (eventNo <= 1) {
      return { driverCount: 0, skipped: true, reason: "Event 1 has no tiers" };
    }

    const standingsSnap = await window.btccDb
      .collection("standings_drivers")
      .doc("season_2026")
      .collection("drivers")
      .orderBy("pointsTotal", "desc")
      .get();

    if (standingsSnap.empty) {
      throw new Error("No driver standings found for tier engine");
    }

    const rows = standingsSnap.docs.map((doc, idx) => {
      const d = doc.data() || {};
      return {
        driverId: doc.id,
        name: (d.name || doc.id).toString(),
        pointsTotal: Number(d.pointsTotal || 0),
        standingPos: idx + 1,
      };
    });
    const split = getTierSplitForActiveDriverCount(rows.length);

    const batch = window.btccDb.batch();

    rows.forEach((row) => {
      let tier = "low";
      if (row.standingPos >= 1 && row.standingPos <= split.high) {
        tier = "high";
      } else if (row.standingPos > split.high && row.standingPos <= (split.high + split.middle)) {
        tier = "middle";
      } else {
        tier = "low";
      }

      const runRef = window.btccDb.collection("driver_tier_runs").doc(eventId).collection("drivers").doc(row.driverId);
      batch.set(
        runRef,
        {
          eventId,
          driverId: row.driverId,
          name: row.name,
          standingPos: row.standingPos,
          pointsTotal: row.pointsTotal,
          tier,
          computedAt: firebase.firestore.FieldValue.serverTimestamp(),
          engineVersion: "J3.0",
        },
        { merge: false }
      );

      const driverRef = window.btccDb.collection("drivers").doc(row.driverId);
      batch.set(
        driverRef,
        {
          tier,
          tierStandingPos: row.standingPos,
          tierEventId: eventId,
          tierUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    batch.set(
      window.btccDb.collection("driver_tier_runs").doc(eventId),
      {
        eventId,
        eventNo,
        gridSize: rows.length,
        split,
        computedAt: firebase.firestore.FieldValue.serverTimestamp(),
        engineVersion: "J3.0",
      },
      { merge: true }
    );

    await batch.commit();

    return { driverCount: rows.length, skipped: false };
  }

  async function runBudgetBoostEngineJ4(root, eventId) {
    if (!window.btccDb) throw new Error("Database not ready");
    if (!eventId) throw new Error("No event selected for budget boost engine");

    const eventMeta = root.__eventMeta || {};
    const eventNo = Number(eventMeta.eventNo || 0);

    const ladder = {
      1: 0.00,
      2: 0.01,
      3: 0.02,
      4: 0.03,
      5: 0.04,
      6: 0.05,
      7: 0.06,
      8: 0.07,
      9: 0.08,
      10: 0.10,
      11: 0.12,
      12: 0.14,
      13: 0.15,
      14: 0.16,
      15: 0.17,
      16: 0.18,
      17: 0.19,
      18: 0.20,
    };

    const multiplier = eventNo <= 1 ? 0 : (eventNo === 2 ? 0.5 : 1);

    const standingsSnap = await window.btccDb
      .collection("standings_players")
      .doc("season_2026")
      .collection("players")
      .orderBy("pointsTotal", "desc")
      .get();

    const playersSnap = await window.btccDb.collection("players").get();

    const playersMap = new Map();
    playersSnap.forEach((doc) => {
      const d = doc.data() || {};
      playersMap.set(doc.id, {
        displayName: (d.displayName || d.name || doc.id).toString(),
        budget: Number(d.budget || d.baseBudget || 10),
        active: d.active !== false,
      });
    });

    const standingsRows = standingsSnap.docs.map((doc, idx) => {
      const d = doc.data() || {};
      return {
        uid: doc.id,
        displayName: (d.displayName || d.name || doc.id).toString(),
        pointsTotal: Number(d.pointsTotal || 0),
        standingPos: idx + 1,
      };
    });

    const rankedIds = new Set(standingsRows.map((r) => r.uid));

    const extraRows = [];
    Array.from(playersMap.entries()).forEach(([uid, p]) => {
      if (!p.active) return;
      if (!rankedIds.has(uid)) {
        extraRows.push({
          uid,
          displayName: p.displayName,
          pointsTotal: 0,
          standingPos: null,
        });
      }
    });

    const allRows = [...standingsRows, ...extraRows];

    const batch = window.btccDb.batch();
    let playerCount = 0;

    allRows.forEach((row, idx) => {
      const effectivePos = Number(row.standingPos || (idx + 1));
      const fullBoost = Number(ladder[Math.min(effectivePos, 18)] ?? 0.20);
      const appliedBoost = floorMoney2(fullBoost * multiplier);
      const player = playersMap.get(row.uid) || { budget: 10, displayName: row.displayName };
      const baseBudget = roundMoney2(Number(player.budget || 10));
      const effectiveBudget = roundMoney2(baseBudget + appliedBoost);

      const runRef = window.btccDb.collection("budget_boost_runs").doc(eventId).collection("players").doc(row.uid);
      batch.set(
        runRef,
        {
          eventId,
          uid: row.uid,
          displayName: row.displayName,
          standingPos: effectivePos,
          pointsTotal: Number(row.pointsTotal || 0),
          fullBoost: roundMoney2(fullBoost),
          multiplier,
          appliedBoost,
          baseBudget,
          effectiveBudget,
          computedAt: firebase.firestore.FieldValue.serverTimestamp(),
          engineVersion: "J4.0",
        },
        { merge: false }
      );

      const playerRef = window.btccDb.collection("players").doc(row.uid);
      batch.set(
        playerRef,
        {
          budgetBoost: appliedBoost,
          effectiveBudget,
          budgetBoostEventId: eventId,
          budgetBoostUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      playerCount += 1;
    });

    batch.set(
      window.btccDb.collection("budget_boost_runs").doc(eventId),
      {
        eventId,
        eventNo,
        playerCount,
        multiplier,
        ladder,
        computedAt: firebase.firestore.FieldValue.serverTimestamp(),
        engineVersion: "J4.0",
      },
      { merge: true }
    );

    await batch.commit();

    return {
      playerCount,
      multiplier,
      skipped: multiplier === 0,
    };
  }

  window.PPV_LOOKUP_2026 = PPV_LOOKUP_2026;
  window.TIER_SPLIT_LOOKUP_2026 = TIER_SPLIT_LOOKUP_2026;
  window.getPpvForActiveDriverCount = getPpvForActiveDriverCount;
  window.getTierSplitForActiveDriverCount = getTierSplitForActiveDriverCount;
  window.runDriverValueEngineJ1 = runDriverValueEngineJ1;
  window.runPlayerBudgetEngineJ2 = runPlayerBudgetEngineJ2;
  window.runDriverTierEngineJ3 = runDriverTierEngineJ3;
  window.runBudgetBoostEngineJ4 = runBudgetBoostEngineJ4;
  window.runCategoryStandingsEngineJ5 = runCategoryStandingsEngineJ5;
  window.roundMoney2 = roundMoney2;
  window.floorMoney2 = floorMoney2;
})();