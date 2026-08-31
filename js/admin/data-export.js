// js/admin/data-export.js
// Exposes: window.setupAdminDataExport(root, adminEmail)

(function () {
  const SEASON = 2026;
  const EXPORT_VERSION = "1.1";
  const EXPORT_SOURCE = "BTCC Fantasy League Web App";

  const numberOrNull = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };

  const firstNumber = (...values) => {
    for (const value of values) {
      const number = numberOrNull(value);
      if (number !== null) return number;
    }
    return null;
  };

  const roundMoney = (value) => {
    const number = numberOrNull(value);
    return number === null ? null : Math.round((number + Number.EPSILON) * 100) / 100;
  };

  function toIsoString(value) {
    if (!value) return null;
    try {
      if (typeof value.toDate === "function") {
        return value.toDate().toISOString();
      }
      if (value instanceof Date) return value.toISOString();
      if (typeof value === "string") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
      }
    } catch (_) {
      return null;
    }
    return null;
  }

  function normaliseFirestoreValue(value, seen = new WeakSet()) {
    if (value === null || value === undefined) return value ?? null;
    if (["string", "number", "boolean"].includes(typeof value)) return value;

    const timestamp = toIsoString(value);
    if (timestamp !== null) return timestamp;

    if (Array.isArray(value)) {
      if (seen.has(value)) return null;
      seen.add(value);
      const output = value.map((item) => normaliseFirestoreValue(item, seen));
      seen.delete(value);
      return output;
    }

    if (typeof value === "object") {
      if (seen.has(value)) return null;
      seen.add(value);
      const output = {};
      Object.entries(value).forEach(([key, child]) => {
        if (typeof child !== "function") {
          output[key] = normaliseFirestoreValue(child, seen);
        }
      });
      seen.delete(value);
      return output;
    }

    return String(value);
  }

  function downloadJsonFile(filename, data) {
    const serialisable = normaliseFirestoreValue(data);
    const blob = new Blob([JSON.stringify(serialisable, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function safeTeamIds(data) {
    const candidates = [
      data?.driverIds,
      data?.teamIds,
      data?.team,
      data?.drivers,
      data?.selectedDrivers,
      data?.picks,
      data?.selection,
    ];
    const selected = candidates.find((value) => Array.isArray(value)) || [];
    return Array.from(new Set(selected.map((value) => {
      if (typeof value === "string") return value;
      if (value && typeof value === "object") return value.driverId || value.id || null;
      return null;
    }).filter(Boolean).map(String)));
  }

  function isSubmissionInvalid(submission) {
    return submission?.invalidSubmission === true ||
      submission?.invalid === true ||
      submission?.valid === false;
  }

  function snapToMap(snapshot) {
    return new Map(snapshot.docs.map((doc) => [doc.id, doc.data() || {}]));
  }

  function getPlayerDisplayName(uid, players, ...sources) {
    for (const source of sources) {
      if (source?.displayName || source?.name) return String(source.displayName || source.name);
    }
    const player = players.get(uid) || {};
    return String(player.displayName || player.name || uid);
  }

  function dateStamp() {
    return new Date().toISOString().slice(0, 10);
  }

  function exportHeader() {
    return {
      exportVersion: EXPORT_VERSION,
      generatedAt: new Date().toISOString(),
      season: SEASON,
      source: EXPORT_SOURCE,
    };
  }

  function assertAdmin(adminEmail) {
    const user = firebase.auth().currentUser;
    const userEmail = user?.email || "";
    const authorised = !!user &&
      typeof window.isBtccAdminEmail === "function" &&
      window.isBtccAdminEmail(userEmail) &&
      (!adminEmail || userEmail.toLowerCase() === String(adminEmail).toLowerCase());

    if (!authorised) {
      throw new Error("Admin authentication is required for league exports.");
    }
  }

  async function getEntriesForEvent(eventId) {
    const submissionsSnap = await window.btccDb
      .collection("submissions")
      .doc(eventId)
      .collection("entries")
      .get();
    if (!submissionsSnap.empty) {
      return { path: `submissions/${eventId}/entries`, rows: snapToMap(submissionsSnap) };
    }

    const legacySnap = await window.btccDb
      .collection("entries")
      .doc(eventId)
      .collection("entries")
      .get();
    return { path: `entries/${eventId}/entries`, rows: snapToMap(legacySnap) };
  }

  async function loadEventExportContext(eventDoc) {
    const eventData = eventDoc.data() || {};
    const eventId = eventDoc.id;
    const [entries, playerScoresSnap, driverScoresSnap, valueRunsSnap, budgetRunsSnap, boostRunsSnap, tierRunSnap, tierRowsSnap, engineRunSnap, resultsSnap] = await Promise.all([
      getEntriesForEvent(eventId),
      window.btccDb.collection("event_scores").doc(eventId).collection("players").get(),
      window.btccDb.collection("event_scores").doc(eventId).collection("drivers").get(),
      window.btccDb.collection("driver_value_runs").doc(eventId).collection("drivers").get(),
      window.btccDb.collection("player_budget_runs").doc(eventId).collection("players").get(),
      window.btccDb.collection("budget_boost_runs").doc(eventId).collection("players").get(),
      window.btccDb.collection("driver_tier_runs").doc(eventId).get(),
      window.btccDb.collection("driver_tier_runs").doc(eventId).collection("drivers").get(),
      window.btccDb.collection("engine_runs").doc(eventId).get(),
      window.btccDb.collection("results").doc(eventId).get(),
    ]);

    return {
      id: eventId,
      eventNumber: Number(eventData.eventNo || 0),
      eventName: String(eventData.venue || eventData.name || ""),
      status: String(eventData.status || ""),
      resultsLocked: eventData.resultsLocked === true,
      starDriverAId: String(eventData.starDriverAId || eventData.starDriverA || ""),
      starDriverBId: String(eventData.starDriverBId || eventData.starDriverB || ""),
      eventData,
      entriesPath: entries.path,
      entries: entries.rows,
      playerScores: snapToMap(playerScoresSnap),
      driverScores: snapToMap(driverScoresSnap),
      valueRuns: snapToMap(valueRunsSnap),
      budgetRuns: snapToMap(budgetRunsSnap),
      boostRuns: snapToMap(boostRunsSnap),
      tierRun: tierRunSnap.exists ? (tierRunSnap.data() || {}) : null,
      tierRows: snapToMap(tierRowsSnap),
      engineRun: engineRunSnap.exists ? (engineRunSnap.data() || {}) : null,
      results: resultsSnap.exists ? (resultsSnap.data() || {}) : null,
      processed: engineRunSnap.exists || !playerScoresSnap.empty,
    };
  }

  async function loadLeagueExportData() {
    const [playersSnap, driversSnap, eventsSnap, playerStandingsSnap, driverStandingsSnap, pitStopRoundsSnap] = await Promise.all([
      window.btccDb.collection("players").get(),
      window.btccDb.collection("drivers").get(),
      window.btccDb.collection("events").orderBy("eventNo").get(),
      window.btccDb.collection("standings_players").doc("season_2026").collection("players").get(),
      window.btccDb.collection("standings_drivers").doc("season_2026").collection("drivers").get(),
      window.btccDb.collection("pitstop_rounds").get(),
    ]);

    const eventContexts = [];
    for (const eventDoc of eventsSnap.docs) {
      eventContexts.push(await loadEventExportContext(eventDoc));
    }
    eventContexts.sort((a, b) => a.eventNumber - b.eventNumber);

    const boostByTargetEventAndPlayer = new Map();
    eventContexts.forEach((context) => {
      context.boostRuns.forEach((boost, uid) => {
        const targetEventId = String(boost.eventId || "");
        if (targetEventId) boostByTargetEventAndPlayer.set(`${targetEventId}/${uid}`, boost);
      });
    });

    const eventIdByNumber = new Map(eventContexts.map((context) => [context.eventNumber, context.id]));
    const tierByTargetEventAndDriver = new Map();
    eventContexts.forEach((context) => {
      const targetEventNumber = firstNumber(context.tierRun?.appliesToEventNo);
      const targetEventId = targetEventNumber === null ? "" : eventIdByNumber.get(targetEventNumber);
      if (!targetEventId) return;
      context.tierRows.forEach((tierRow, driverId) => {
        if (tierRow?.tier) {
          tierByTargetEventAndDriver.set(`${targetEventId}/${driverId}`, String(tierRow.tier));
        }
      });
    });

    return {
      players: snapToMap(playersSnap),
      drivers: snapToMap(driversSnap),
      playerStandings: snapToMap(playerStandingsSnap),
      driverStandings: snapToMap(driverStandingsSnap),
      events: eventContexts,
      boostByTargetEventAndPlayer,
      tierByTargetEventAndDriver,
      pitStopRounds: pitStopRoundsSnap.docs
        .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
        .sort((a, b) => Number(a.roundNo || 0) - Number(b.roundNo || 0)),
    };
  }

  function getLatestProcessedEvent(events) {
    const processed = events.filter((event) => event.processed && event.eventNumber > 0);
    if (!processed.length) return null;
    return processed.sort((a, b) => b.eventNumber - a.eventNumber)[0];
  }

  function buildPlayerEventSummaries(data, includedEventIds = null) {
    const warnings = new Set();
    const summaries = [];
    const cumulativePoints = new Map();
    const activePlayerIds = Array.from(data.players.entries())
      .filter(([, player]) => player.active !== false)
      .map(([uid]) => uid);

    data.events.forEach((event) => {
      if (event.processed) {
        activePlayerIds.forEach((uid) => {
          if (!cumulativePoints.has(uid)) cumulativePoints.set(uid, 0);
        });
      }

      event.playerScores.forEach((score, uid) => {
        const points = firstNumber(score.pointsTotal, score.points, score.total, score.breakdown?.total) ?? 0;
        cumulativePoints.set(uid, Number(cumulativePoints.get(uid) || 0) + points);
      });

      const eventRank = new Map();
      event.playerScores.forEach((score, uid) => {
        const scorePoints = firstNumber(score.pointsTotal, score.points, score.total, score.breakdown?.total) ?? 0;
        const ahead = Array.from(event.playerScores.values()).filter((other) => {
          const otherPoints = firstNumber(other.pointsTotal, other.points, other.total, other.breakdown?.total) ?? 0;
          return otherPoints > scorePoints;
        }).length;
        eventRank.set(uid, ahead + 1);
      });

      const overallRows = Array.from(cumulativePoints.entries())
        .map(([uid, points]) => ({ uid, points }))
        .sort((a, b) => b.points - a.points || a.uid.localeCompare(b.uid));
      const overallRank = new Map(overallRows.map((row) => [
        row.uid,
        overallRows.filter((other) => other.points > row.points).length + 1,
      ]));

      if (includedEventIds && !includedEventIds.has(event.id)) return;

      const playerIds = new Set([
        ...event.entries.keys(),
        ...event.playerScores.keys(),
        ...event.budgetRuns.keys(),
        ...(event.processed ? activePlayerIds : []),
      ]);

      playerIds.forEach((uid) => {
        const submission = event.entries.get(uid) || null;
        const score = event.playerScores.get(uid) || null;
        const budgetRun = event.budgetRuns.get(uid) || null;
        const boostRun = data.boostByTargetEventAndPlayer.get(`${event.id}/${uid}`) || null;
        const playerName = getPlayerDisplayName(uid, data.players, submission, score, budgetRun);
        const amountSpent = submission ? firstNumber(submission.totalCost, submission.amountSpent) : null;
        const startingBudget = budgetRun ? firstNumber(budgetRun.startingBudget) : null;
        const budgetBoost = event.eventNumber === 1
          ? 0
          : boostRun
            ? firstNumber(boostRun.appliedBoost, boostRun.budgetBoost)
            : null;
        let effectiveBudget = submission
          ? firstNumber(submission.budgetAvailable, submission.effectiveBudget)
          : null;
        if (effectiveBudget === null && boostRun) {
          effectiveBudget = firstNumber(boostRun.effectiveBudget);
        }
        if (effectiveBudget === null && startingBudget !== null && budgetBoost !== null) {
          effectiveBudget = roundMoney(startingBudget + budgetBoost);
        }
        let unusedBudget = submission
          ? firstNumber(submission.budgetRemaining, submission.unusedBudget)
          : null;
        if (unusedBudget === null && effectiveBudget !== null && amountSpent !== null) {
          unusedBudget = roundMoney(effectiveBudget - amountSpent);
        }

        if (event.eventNumber > 1 && budgetBoost === null) {
          warnings.add("Some historical Budget Boost values were not stored for the event they applied to and are exported as null.");
        }
        if (!budgetRun) {
          warnings.add("Some historical starting and post-event budgets were not stored and are exported as null.");
        }
        if (submission && submission.invalidSubmission === undefined && submission.invalid === undefined && submission.valid === undefined) {
          warnings.add("Historical submission validity was not consistently stored; invalidSubmission defaults to false where no explicit flag exists.");
        }
        if (firstNumber(score?.penaltyApplied, submission?.penaltyApplied, submission?.penalty) === null) {
          warnings.add("Per-event player penalties were not consistently snapshotted and are exported as null where unavailable.");
        }

        const explicitInvalid = submission ? isSubmissionInvalid(submission) : false;
        const scoreBreakdown = score?.breakdown || null;
        if (score && [
          scoreBreakdown?.qualifying,
          scoreBreakdown?.race1,
          scoreBreakdown?.race2,
          scoreBreakdown?.race3,
        ].some((value) => numberOrNull(value) === null)) {
          warnings.add("Some player event-score documents do not contain a complete qualifying/Race 1/Race 2/Race 3 breakdown; unavailable session points are exported as null.");
        }
        const missedWithoutScore = event.processed && !submission && !score;

        summaries.push({
          season: SEASON,
          eventNumber: event.eventNumber,
          eventName: event.eventName,
          playerId: uid,
          playerName,
          startingBudget: roundMoney(startingBudget),
          budgetBoost: roundMoney(budgetBoost),
          effectiveBudget: roundMoney(effectiveBudget),
          amountSpent: roundMoney(amountSpent),
          unusedBudget: roundMoney(unusedBudget),
          budgetAfterEvent: roundMoney(budgetRun ? firstNumber(budgetRun.newBudget, budgetRun.budgetAfterEvent) : null),
          playerEventPoints: score
            ? firstNumber(score.pointsTotal, score.points, score.total, score.breakdown?.total)
            : missedWithoutScore ? 0 : null,
          qualifyingPoints: score ? firstNumber(scoreBreakdown?.qualifying) : null,
          race1Points: score ? firstNumber(scoreBreakdown?.race1) : null,
          race2Points: score ? firstNumber(scoreBreakdown?.race2) : null,
          race3Points: score ? firstNumber(scoreBreakdown?.race3) : null,
          eventPosition: score ? (eventRank.get(uid) || null) : null,
          overallPointsAfterEvent: cumulativePoints.has(uid) ? Number(cumulativePoints.get(uid) || 0) : null,
          overallPositionAfterEvent: overallRank.get(uid) || null,
          submissionTimestamp: submission ? (toIsoString(submission.createdAt) || toIsoString(submission.updatedAt)) : null,
          submissionStatus: submission ? (explicitInvalid ? "invalid" : "submitted") : "missed",
          missedSubmission: !submission,
          invalidSubmission: explicitInvalid,
          penaltyApplied: firstNumber(score?.penaltyApplied, submission?.penaltyApplied, submission?.penalty),
        });
      });
    });

    return { summaries, warnings };
  }

  function buildPlayerDriverSelections(data, includedEventIds = null) {
    const warnings = new Set();
    const selections = [];

    data.events.forEach((event) => {
      if (includedEventIds && !includedEventIds.has(event.id)) return;

      event.entries.forEach((submission, uid) => {
        const playerScore = event.playerScores.get(uid) || {};
        const playerName = getPlayerDisplayName(uid, data.players, submission, playerScore);

        safeTeamIds(submission).forEach((driverId) => {
          const currentDriver = data.drivers.get(driverId) || {};
          const driverScore = event.driverScores.get(driverId) || {};
          const valueRun = event.valueRuns.get(driverId) || {};
          const perDriverBreakdown = playerScore.perDriverBreakdown?.[driverId] || {};
          const perDriverBySession = playerScore.perDriverBySession || {};
          const isSLD = String(submission.sldDriverId || "") === driverId;
          const isStarA = !isSLD && event.starDriverAId === driverId;
          const isStarB = !isSLD && event.starDriverBId === driverId;
          const baseValue = firstNumber(valueRun.dv, valueRun.baseValue);
          let eventPrice = null;
          let starDriverType = "";
          let priceAdjustmentType = "";
          let priceAdjustmentPercentage = null;

          if (isSLD) {
            priceAdjustmentType = "SLD premium";
            priceAdjustmentPercentage = 10;
          } else if (isStarA) {
            starDriverType = "A";
            priceAdjustmentType = "Underdog discount";
            priceAdjustmentPercentage = -20;
          } else if (isStarB) {
            starDriverType = "B";
            priceAdjustmentType = "Form premium";
            priceAdjustmentPercentage = 5;
          }

          if (baseValue !== null) {
            const multiplier = isSLD ? 1.10 : isStarA ? 0.80 : isStarB ? 1.05 : 1;
            eventPrice = roundMoney(baseValue * multiplier);
          } else {
            warnings.add("Historical base values and event prices are null where no driver value-run snapshot exists.");
          }

          const historicalTier = data.tierByTargetEventAndDriver.get(`${event.id}/${driverId}`) || "";
          if (!historicalTier) {
            warnings.add("Some historical driver tiers could not be matched to a driver tier-run that applies to the selection event and are exported as an empty string.");
          }
          if (!event.valueRuns.has(driverId)) {
            warnings.add("Some selected drivers have no historical driver value-run snapshot; value and Expected Points fields are exported as null.");
          }
          if (!event.driverScores.has(driverId)) {
            warnings.add("Some selected drivers have no matching historical driver event-score document.");
          }

          const qualifyingPoints = firstNumber(
            perDriverBySession.qualifying?.[driverId],
            perDriverBreakdown.q,
            perDriverBreakdown.qualifying
          );
          const race1Points = firstNumber(
            perDriverBySession.race1?.[driverId],
            perDriverBreakdown.r1,
            perDriverBreakdown.race1
          );
          const race2Points = firstNumber(
            perDriverBySession.race2?.[driverId],
            perDriverBreakdown.r2,
            perDriverBreakdown.race2
          );
          const race3Points = firstNumber(
            perDriverBySession.race3?.[driverId],
            perDriverBreakdown.r3,
            perDriverBreakdown.race3
          );
          if ([qualifyingPoints, race1Points, race2Points, race3Points].some((value) => value === null)) {
            warnings.add("Some selected-driver session breakdowns are unavailable in historical player event-score documents and are exported as null.");
          }

          selections.push({
            season: SEASON,
            eventNumber: event.eventNumber,
            eventName: event.eventName,
            playerId: uid,
            playerName,
            driverId,
            driverName: String(driverScore.name || valueRun.name || currentDriver.name || driverId),
            driverTier: String(historicalTier || ""),
            baseValue: roundMoney(baseValue),
            eventPrice,
            valueAfterEvent: roundMoney(firstNumber(valueRun.ndv)),
            performanceDifferenceRatio: firstNumber(valueRun.d),
            valueChange: roundMoney(firstNumber(
              valueRun.ac,
              numberOrNull(valueRun.ndv) !== null && numberOrNull(valueRun.dv) !== null
                ? Number(valueRun.ndv) - Number(valueRun.dv)
                : null
            )),
            expectedPoints: firstNumber(valueRun.ep, valueRun.expectedPoints),
            driverEventPoints: firstNumber(playerScore.perDriver?.[driverId], playerScore.perDriverBreakdown?.[driverId]?.total, driverScore.pointsTotal),
            qualifyingPoints,
            race1Points,
            race2Points,
            race3Points,
            isSLD,
            starDriverType,
            priceAdjustmentType,
            priceAdjustmentPercentage,
          });
        });
      });
    });

    return { selections, warnings };
  }

  function buildDriverEventResults(data, includedEventIds = null) {
    const warnings = new Set();
    const results = [];

    data.events.forEach((event) => {
      if (!event.processed) return;
      if (includedEventIds && !includedEventIds.has(event.id)) return;

      const validSubmissions = Array.from(event.entries.entries())
        .filter(([, submission]) => !isSubmissionInvalid(submission));
      const selectionCounts = new Map();
      validSubmissions.forEach(([, submission]) => {
        safeTeamIds(submission).forEach((driverId) => {
          selectionCounts.set(driverId, Number(selectionCounts.get(driverId) || 0) + 1);
        });
      });

      if (!event.driverScores.size) {
        warnings.add("Some processed events have no historical driver event-score documents and cannot produce driverEventResults records.");
      }

      event.driverScores.forEach((score, driverId) => {
        const breakdown = score.breakdown || {};
        const qualifyingPoints = firstNumber(breakdown.qualifying);
        const race1Points = firstNumber(breakdown.race1);
        const race2Points = firstNumber(breakdown.race2);
        const race3Points = firstNumber(breakdown.race3);
        if ([qualifyingPoints, race1Points, race2Points, race3Points].some((value) => value === null)) {
          warnings.add("Some historical driver event-score documents do not contain a complete session breakdown; unavailable session points are exported as null.");
        }

        const selectionCount = Number(selectionCounts.get(driverId) || 0);
        results.push({
          season: SEASON,
          eventNumber: event.eventNumber,
          eventName: event.eventName,
          driverId,
          driverName: String(score.name || driverId),
          pointsTotal: firstNumber(score.pointsTotal, score.points),
          breakdown: normaliseFirestoreValue(breakdown),
          qualifyingPoints,
          race1Points,
          race2Points,
          race3Points,
          categories: Array.isArray(score.categories) ? [...score.categories] : [],
          activeDriverCount: firstNumber(score.activeDriverCount, event.engineRun?.activeDriverCount),
          computedAt: toIsoString(score.computedAt),
          engineVersion: String(score.engineVersion || event.engineRun?.engineVersion || ""),
          selectionCount,
          selectionRate: validSubmissions.length
            ? roundMoney((selectionCount / validSubmissions.length) * 100)
            : null,
        });
      });
    });

    return { results, warnings };
  }

  function buildPitStopExport(rounds) {
    const warnings = new Set();
    const pitStopRounds = rounds.map((round) => ({
      roundId: String(round.id || ""),
      roundNo: firstNumber(round.roundNo),
      type: String(round.type || ""),
      drawnPlayer: String(round.drawnPlayer || ""),
      drawnPlayerWon: typeof round.drawnPlayerWon === "boolean" ? round.drawnPlayerWon : null,
      fullPotPrize: roundMoney(firstNumber(round.fullPotPrize)),
      firstPlaceText: String(round.firstPlaceText || ""),
      firstPrize: roundMoney(firstNumber(round.firstPrize)),
      secondPlaceText: String(round.secondPlaceText || ""),
      secondPrize: roundMoney(firstNumber(round.secondPrize)),
      thirdPlaceText: String(round.thirdPlaceText || ""),
      thirdPrize: roundMoney(firstNumber(round.thirdPrize)),
      selectedPlayerPrize: roundMoney(firstNumber(round.selectedPlayerPrize)),
      rolloverAdded: roundMoney(firstNumber(round.rolloverAdded)),
      potValue: roundMoney(firstNumber(round.potValue)),
      specialPayouts: normaliseFirestoreValue(Array.isArray(round.specialPayouts) ? round.specialPayouts : []),
      notes: String(round.notes || ""),
      updatedAt: toIsoString(round.updatedAt),
    }));

    let pitStopPlayerTotals = [];
    if (typeof window.btccBuildPitStopPlayerWinnings === "function") {
      pitStopPlayerTotals = window.btccBuildPitStopPlayerWinnings(rounds).map((row) => ({
        playerName: String(row.player || ""),
        totalWon: roundMoney(row.total),
      }));
    } else if (rounds.length) {
      warnings.add("Pit Stop rounds were exported, but cumulative player winnings could not be calculated because the live Pit Stop payout helper was unavailable.");
    }

    return { pitStopRounds, pitStopPlayerTotals, warnings };
  }

  function buildCurrentDrivers(data) {
    const selectionCounts = new Map();
    data.events.forEach((event) => {
      event.entries.forEach((submission) => {
        safeTeamIds(submission).forEach((driverId) => {
          selectionCounts.set(driverId, Number(selectionCounts.get(driverId) || 0) + 1);
        });
      });
    });

    const activeDrivers = Array.from(data.drivers.entries())
      .filter(([, driver]) => driver.active !== false);
    const tdv = activeDrivers.reduce((sum, [, driver]) => {
      return sum + Number(firstNumber(driver.value, driver.price, driver.cost) || 0);
    }, 0);
    const ppv = typeof window.getPpvForActiveDriverCount === "function"
      ? window.getPpvForActiveDriverCount(activeDrivers.length)
      : null;
    const latestProcessed = getLatestProcessedEvent(data.events);
    const currentEvent = data.events
      .filter((event) => !event.processed && event.eventNumber > Number(latestProcessed?.eventNumber || 0))
      .sort((a, b) => a.eventNumber - b.eventNumber)[0] || latestProcessed;

    return Array.from(data.drivers.entries()).map(([driverId, driver]) => {
      const categories = Array.isArray(driver.categories) ? [...driver.categories] : [];
      const baseValue = firstNumber(driver.value, driver.price, driver.cost);
      const isStarA = currentEvent?.starDriverAId === driverId;
      const isStarB = currentEvent?.starDriverBId === driverId;
      const multiplier = isStarA ? 0.80 : isStarB ? 1.05 : 1;
      const expectedPoints = baseValue !== null && ppv !== null && tdv > 0
        ? Math.round((ppv / tdv) * baseValue)
        : firstNumber(driver.lastEp, driver.ep, driver.expectedPoints);
      const standings = data.driverStandings.get(driverId) || {};

      return {
        driverId,
        driverName: String(driver.name || driverId),
        currentBaseValue: roundMoney(baseValue),
        currentEventPrice: baseValue === null ? null : roundMoney(baseValue * multiplier),
        currentTier: String(driver.tier || ""),
        currentExpectedPoints: expectedPoints,
        seasonFantasyPoints: firstNumber(standings.pointsTotal, standings.points, driver.pointsTotal),
        selectionCount: Number(selectionCounts.get(driverId) || 0),
        categories,
        manufacturerEligible: categories.includes("M"),
        independentEligible: categories.includes("I"),
        jackSearsEligible: categories.includes("JS"),
        active: driver.active !== false,
        starDriverType: isStarA ? "A" : isStarB ? "B" : "",
        currentPriceAdjustmentPercentage: isStarA ? -20 : isStarB ? 5 : null,
      };
    }).sort((a, b) => a.driverName.localeCompare(b.driverName));
  }

  function buildCurrentPlayers(data) {
    const standingsRows = Array.from(data.playerStandings.entries())
      .map(([uid, standing]) => ({
        uid,
        points: firstNumber(standing.pointsTotal, standing.points) ?? 0,
      }))
      .sort((a, b) => b.points - a.points || a.uid.localeCompare(b.uid));
    const positions = new Map(standingsRows.map((row) => [
      row.uid,
      standingsRows.filter((other) => other.points > row.points).length + 1,
    ]));
    const completedEvents = data.events.filter((event) => event.processed);

    return Array.from(data.players.entries()).map(([uid, player]) => {
      const standing = data.playerStandings.get(uid) || {};
      const sldDriverId = String(player.sldDriverId || player.sld || "");
      const sldDriver = data.drivers.get(sldDriverId) || {};
      const missedSubmissionCount = completedEvents.filter((event) => !event.entries.has(uid)).length;
      const budget = firstNumber(player.budget, player.baseBudget);
      const budgetBoost = firstNumber(player.budgetBoost);
      let effectiveBudget = firstNumber(player.effectiveBudget);
      if (effectiveBudget === null && budget !== null && budgetBoost !== null) {
        effectiveBudget = roundMoney(budget + budgetBoost - Number(firstNumber(player.deductibles) || 0));
      }

      return {
        playerId: uid,
        displayName: String(player.displayName || player.name || uid),
        currentBudget: roundMoney(budget),
        currentBudgetBoost: roundMoney(budgetBoost),
        effectiveBudget: roundMoney(effectiveBudget),
        currentDeductibles: roundMoney(firstNumber(player.deductibles)),
        championshipPoints: firstNumber(standing.pointsTotal, standing.points),
        championshipPosition: positions.get(uid) || null,
        missedSubmissionCount,
        currentPenalty: firstNumber(player.penalties, player.penalty),
        sldDriverId: sldDriverId || "",
        sldDriverName: sldDriverId ? String(sldDriver.name || sldDriverId) : "",
        lastSubmittedEvent: String(player.lastSubmissionEventId || ""),
        lastSubmissionTimestamp: toIsoString(player.lastSubmission),
        teamId: String(player.teamId || ""),
        teamName: String(player.teamName || ""),
        active: player.active !== false,
      };
    }).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  function eventMetadata(event) {
    return {
      eventId: event.id,
      eventNumber: event.eventNumber,
      eventName: event.eventName,
      status: event.status,
      resultsLocked: event.resultsLocked,
      processed: event.processed,
      starDriverAId: event.starDriverAId,
      starDriverBId: event.starDriverBId,
      submissionsSource: event.entriesPath,
      engineRunTimestamp: toIsoString(event.engineRun?.ranAt),
      activeDriverCount: firstNumber(event.engineRun?.activeDriverCount),
      engineVersion: String(event.engineRun?.engineVersion || ""),
      engineMode: String(event.engineRun?.mode || ""),
      engineEntryCount: firstNumber(event.engineRun?.entryCount),
      sourceResultsUpdatedAt: toIsoString(event.engineRun?.sourceResultsUpdatedAt),
    };
  }

  async function exportFullLeagueHistory(adminEmail) {
    assertAdmin(adminEmail);
    const data = await loadLeagueExportData();
    const latestEvent = getLatestProcessedEvent(data.events);
    const summariesResult = buildPlayerEventSummaries(data);
    const selectionsResult = buildPlayerDriverSelections(data);
    const driverResultsResult = buildDriverEventResults(data);
    const pitStopResult = buildPitStopExport(data.pitStopRounds);
    const exportWarnings = Array.from(new Set([
      ...summariesResult.warnings,
      ...selectionsResult.warnings,
      ...driverResultsResult.warnings,
      ...pitStopResult.warnings,
    ])).sort();
    const output = {
      ...exportHeader(),
      latestEventNumber: Number(latestEvent?.eventNumber || 0),
      playerEventSummaries: summariesResult.summaries,
      playerDriverSelections: selectionsResult.selections,
      driverEventResults: driverResultsResult.results,
      drivers: buildCurrentDrivers(data),
      players: buildCurrentPlayers(data),
      events: data.events.map(eventMetadata),
      pitStopRounds: pitStopResult.pitStopRounds,
      pitStopPlayerTotals: pitStopResult.pitStopPlayerTotals,
      exportWarnings,
    };
    downloadJsonFile(`BTCC_2026_Full_History_${dateStamp()}.json`, output);
    return output;
  }

  async function exportLatestEvent(adminEmail) {
    assertAdmin(adminEmail);
    const data = await loadLeagueExportData();
    const latestEvent = getLatestProcessedEvent(data.events);
    if (!latestEvent) {
      throw new Error("No processed event could be identified from engine runs or stored event scores.");
    }
    const included = new Set([latestEvent.id]);
    const summariesResult = buildPlayerEventSummaries(data, included);
    const selectionsResult = buildPlayerDriverSelections(data, included);
    const driverResultsResult = buildDriverEventResults(data, included);
    const exportWarnings = Array.from(new Set([
      ...summariesResult.warnings,
      ...selectionsResult.warnings,
      ...driverResultsResult.warnings,
    ])).sort();
    const output = {
      ...exportHeader(),
      event: eventMetadata(latestEvent),
      playerEventSummaries: summariesResult.summaries,
      playerDriverSelections: selectionsResult.selections,
      driverEventResults: driverResultsResult.results,
      exportWarnings,
    };
    const eventNumber = String(latestEvent.eventNumber).padStart(2, "0");
    downloadJsonFile(`BTCC_2026_Event_${eventNumber}_Export_${dateStamp()}.json`, output);
    return output;
  }

  async function exportCurrentDrivers(adminEmail) {
    assertAdmin(adminEmail);
    const data = await loadLeagueExportData();
    const output = {
      ...exportHeader(),
      drivers: buildCurrentDrivers(data),
      exportWarnings: [],
    };
    downloadJsonFile(`BTCC_2026_Current_Drivers_${dateStamp()}.json`, output);
    return output;
  }

  async function exportCurrentPlayers(adminEmail) {
    assertAdmin(adminEmail);
    const data = await loadLeagueExportData();
    const output = {
      ...exportHeader(),
      players: buildCurrentPlayers(data),
      exportWarnings: [
        "Missed submission counts are derived from processed events that have no saved submission for the player.",
      ],
    };
    downloadJsonFile(`BTCC_2026_Current_Players_${dateStamp()}.json`, output);
    return output;
  }

  function setupAdminDataExport(root, adminEmail) {
    const buttons = [
      { element: root.querySelector("#admin-export-full-history"), label: "Full league history", run: exportFullLeagueHistory },
      { element: root.querySelector("#admin-export-latest-event"), label: "Latest event", run: exportLatestEvent },
      { element: root.querySelector("#admin-export-current-drivers"), label: "Current drivers", run: exportCurrentDrivers },
      { element: root.querySelector("#admin-export-current-players"), label: "Current players", run: exportCurrentPlayers },
    ];
    const message = root.querySelector("#admin-data-export-msg");
    if (buttons.some((button) => !button.element) || !message) return;

    const setBusy = (busy) => {
      buttons.forEach(({ element }) => {
        element.disabled = busy;
      });
    };

    buttons.forEach(({ element, label, run }) => {
      element.addEventListener("click", async () => {
        try {
          assertAdmin(adminEmail);
          setBusy(true);
          message.textContent = "Preparing export…";
          const output = await run(adminEmail);
          const rowCount = output.playerEventSummaries?.length ?? output.drivers?.length ?? output.players?.length ?? 0;
          message.textContent = rowCount > 0
            ? `Export complete — ${label} downloaded.`
            : "No data found.";
        } catch (err) {
          console.error(`❌ ${label} export failed:`, err);
          message.textContent = `Export failed: ${err?.message || err}`;
        } finally {
          setBusy(false);
        }
      });
    });
  }

  window.setupAdminDataExport = setupAdminDataExport;
})();
