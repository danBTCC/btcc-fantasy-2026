// js/admin/engine.js
// Copy-first extraction of the admin engine family.
// Keep the original engine code in js/pages/admin.js until this file is confirmed working.

(function () {
  const PPV_2026 = 930;
  const PTR_2026 = 0.10;
  const MIN_DRIVER_VALUE_2026 = 0.10;

  function roundMoney2(v) {
    return Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
  }

  async function runDriverValueEngineJ1(root, eventId) {
    if (!window.btccDb) throw new Error("Database not ready");
    if (!eventId) throw new Error("No event selected for value engine");

    const [driversSnap, scoresSnap] = await Promise.all([
      window.btccDb.collection("drivers").get(),
      window.btccDb.collection("event_scores").doc(eventId).collection("players").get(),
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

    const vv = PPV_2026 / tdv;

    const gpMap = new Map();

    scoresSnap.forEach((doc) => {
      const data = doc.data() || {};
      const perDriver = data.perDriver || {};
      Object.entries(perDriver).forEach(([driverId, pts]) => {
        const prev = Number(gpMap.get(driverId) || 0);
        gpMap.set(String(driverId), prev + Number(pts || 0));
      });
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
        ppv: PPV_2026,
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

    const safeTeamIdsFromEntry = (entry) => {
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
    };

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

    const batch = window.btccDb.batch();

    rows.forEach((row) => {
      let tier = "low";
      if (row.standingPos >= 1 && row.standingPos <= 7) tier = "high";
      else if (row.standingPos >= 8 && row.standingPos <= 17) tier = "middle";
      else tier = "low";

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
        split: { high: 7, middle: 10, low: 7 },
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
      const fullBoost = Number(ladder[Math.min(effectivePos, 16)] ?? 0.18);
      const appliedBoost = roundMoney2(fullBoost * multiplier);
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

  window.runDriverValueEngineJ1 = runDriverValueEngineJ1;
  window.runPlayerBudgetEngineJ2 = runPlayerBudgetEngineJ2;
  window.runDriverTierEngineJ3 = runDriverTierEngineJ3;
  window.runBudgetBoostEngineJ4 = runBudgetBoostEngineJ4;
  window.roundMoney2 = roundMoney2;
})();