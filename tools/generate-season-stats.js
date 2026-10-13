#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const SEASON = 2026;
const HISTORY_FILENAME = "BTCC_2026_Full_History_2026-10-13.json";
const projectRoot = path.resolve(__dirname, "..");

function firstExisting(paths) {
  return paths.find((candidate) => fs.existsSync(candidate)) || paths[0];
}

const historyPath = path.resolve(process.argv[2] || firstExisting([
  path.join(projectRoot, HISTORY_FILENAME),
  path.join(projectRoot, "..", HISTORY_FILENAME),
]));
const extraPath = path.resolve(
  process.argv[3] || path.join(projectRoot, "data", "season-stats-source", "2026-extra.json")
);
const outputPath = path.resolve(
  process.argv[4] || path.join(projectRoot, "data", "season-stats", "2026.json")
);

function fail(message) {
  throw new Error(message);
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) fail(`Input file not found: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function round(value, places = 2) {
  if (value === null || value === undefined) return null;
  const factor = 10 ** places;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function average(values) {
  return values.length ? round(sum(values) / values.length) : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : round((sorted[middle - 1] + sorted[middle]) / 2);
}

function populationStandardDeviation(values) {
  if (!values.length) return null;
  const mean = sum(values) / values.length;
  const variance = sum(values.map((value) => (value - mean) ** 2)) / values.length;
  return round(Math.sqrt(variance));
}

function groupBy(rows, keyFn) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = keyFn(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return groups;
}

function countBy(rows, keyFn) {
  return Array.from(groupBy(rows, keyFn).entries()).map(([key, matches]) => ({
    key,
    count: matches.length,
    rows: matches,
  }));
}

function tiedMaximum(rows, valueFn) {
  if (!rows.length) return [];
  const maximum = Math.max(...rows.map(valueFn));
  return rows.filter((row) => valueFn(row) === maximum);
}

function tiedMinimum(rows, valueFn) {
  if (!rows.length) return [];
  const minimum = Math.min(...rows.map(valueFn));
  return rows.filter((row) => valueFn(row) === minimum);
}

function eventFact(row, valueKey, outputKey = "score") {
  return {
    eventNumber: row.eventNumber,
    eventName: row.eventName,
    [outputKey]: row[valueKey],
  };
}

function driverFact(row, pointsKey = null) {
  const fact = {
    driverId: row.driverId,
    driverName: row.driverName,
  };
  if (pointsKey) fact.points = row[pointsKey];
  return fact;
}

function driverEventFact(row, pointsKey = "driverEventPoints") {
  return {
    driverId: row.driverId,
    driverName: row.driverName,
    eventNumber: row.eventNumber,
    eventName: row.eventName,
    points: row[pointsKey],
  };
}

function longestStreak(rows, predicate) {
  let current = 0;
  let longest = 0;
  rows.forEach((row) => {
    current = !row.missedSubmission && predicate(row) ? current + 1 : 0;
    longest = Math.max(longest, current);
  });
  return longest;
}

function normaliseTier(value) {
  const tier = String(value || "").trim().toLowerCase();
  if (tier === "lower") return "low";
  if (["high", "middle", "low"].includes(tier)) return tier;
  return "";
}

function splitPayoutNames(value) {
  return String(value || "")
    .split("/")
    .map((name) => name.trim())
    .filter((name) => name && name !== "-");
}

function roundPayoutEntries(roundRow) {
  const entries = [];
  const addSplitPrize = (label, playerText, amount) => {
    const names = splitPayoutNames(playerText);
    const total = Number(amount || 0);
    if (!names.length || total <= 0) return;
    names.forEach((playerName) => {
      entries.push({
        roundNumber: Number(roundRow.roundNo),
        label,
        playerName,
        amount: round(total / names.length),
      });
    });
  };

  const shared = roundRow.type === "special_round_10" || roundRow.type === "special_shared_payout";
  if (shared) {
    (roundRow.specialPayouts || []).forEach((payout) => {
      addSplitPrize(`Position ${Number(payout.position || 0)}`, payout.player, payout.amount);
    });
    return entries;
  }

  if (roundRow.drawnPlayerWon === true) {
    addSplitPrize("Full Pot", roundRow.drawnPlayer, roundRow.fullPotPrize || roundRow.potValue);
    return entries;
  }

  addSplitPrize("Selected", roundRow.drawnPlayer, roundRow.selectedPlayerPrize);
  addSplitPrize("1st", roundRow.firstPlaceText, roundRow.firstPrize);
  addSplitPrize("2nd", roundRow.secondPlaceText, roundRow.secondPrize);
  addSplitPrize("3rd", roundRow.thirdPlaceText, roundRow.thirdPrize);
  return entries;
}

function biggestPositionChanges(journeyRows, type) {
  const transitions = [];
  for (let index = 1; index < journeyRows.length; index += 1) {
    const previous = journeyRows[index - 1];
    const current = journeyRows[index];
    const signedChange = previous.position - current.position;
    const positions = type === "gain" ? signedChange : -signedChange;
    transitions.push({
      fromEventNumber: previous.eventNumber,
      toEventNumber: current.eventNumber,
      fromPosition: previous.position,
      toPosition: current.position,
      positions,
    });
  }
  const best = tiedMaximum(transitions, (row) => row.positions);
  const magnitude = best.length && best[0].positions > 0 ? best[0].positions : 0;
  return {
    positions: magnitude,
    transitions: magnitude ? best : [],
  };
}

function sessionWinsByPlayer(allSummaries, sessionKey) {
  const wins = new Map();
  groupBy(allSummaries.filter((row) => !row.missedSubmission), (row) => row.eventNumber)
    .forEach((eventRows) => {
      const eligible = eventRows.filter((row) => Number.isFinite(Number(row[sessionKey])));
      if (!eligible.length) return;
      const maximum = Math.max(...eligible.map((row) => Number(row[sessionKey])));
      eligible.filter((row) => Number(row[sessionKey]) === maximum).forEach((row) => {
        wins.set(row.playerId, Number(wins.get(row.playerId) || 0) + 1);
      });
    });
  return wins;
}

function applyTierOverrides(selections, extra) {
  const overrides = extra.historicalDriverTiers?.manualOverrides || [];
  const overrideMap = new Map();
  overrides.forEach((override) => {
    const key = `${override.eventNumber}/${override.driverId}`;
    if (overrideMap.has(key)) fail(`Duplicate historical tier override: ${key}`);
    const tier = normaliseTier(override.tier);
    if (!tier) fail(`Invalid historical tier override: ${key}`);
    overrideMap.set(key, { ...override, tier });
  });

  const appliedCounts = new Map();
  const output = selections.map((selection) => {
    if (selection.eventNumber === 1) return { ...selection, driverTier: "" };
    const storedTier = normaliseTier(selection.driverTier);
    if (storedTier) return { ...selection, driverTier: storedTier };
    const key = `${selection.eventNumber}/${selection.driverId}`;
    const override = overrideMap.get(key);
    if (!override) fail(`No historical tier or manual override for ${key}`);
    appliedCounts.set(key, Number(appliedCounts.get(key) || 0) + 1);
    return { ...selection, driverTier: override.tier };
  });

  overrides.forEach((override) => {
    const key = `${override.eventNumber}/${override.driverId}`;
    const applied = Number(appliedCounts.get(key) || 0);
    if (applied !== Number(override.affectedSelections)) {
      fail(`Tier override ${key} expected ${override.affectedSelections} selections but applied to ${applied}`);
    }
  });
  return output;
}

function buildTierMostSelected(selections, tier) {
  const rows = selections.filter((row) => row.eventNumber >= 2 && row.driverTier === tier);
  const counts = countBy(rows, (row) => row.driverId).map((group) => ({
    driverId: group.key,
    driverName: group.rows[0].driverName,
    selections: group.count,
  }));
  return tiedMaximum(counts, (row) => row.selections)
    .sort((a, b) => a.driverName.localeCompare(b.driverName));
}

function buildDriverSelections(playerSelections) {
  const byDriver = countBy(playerSelections, (row) => row.driverId).map((group) => ({
    driverId: group.key,
    driverName: group.rows[0].driverName,
    selections: group.count,
    points: sum(group.rows.map((row) => row.driverEventPoints)),
  }));
  const teamSizes = Array.from(groupBy(playerSelections, (row) => row.eventNumber).values())
    .map((rows) => rows.length);
  const teamSizeCounts = countBy(teamSizes, (size) => size).map((group) => ({
    size: Number(group.key),
    events: group.count,
  }));

  return {
    totalSelections: playerSelections.length,
    differentDriversUsed: new Set(playerSelections.map((row) => row.driverId)).size,
    mostSelectedDrivers: tiedMaximum(byDriver, (row) => row.selections)
      .map(({ points, ...row }) => row)
      .sort((a, b) => a.driverName.localeCompare(b.driverName)),
    highestScoringDrivers: tiedMaximum(byDriver, (row) => row.points)
      .map(({ selections, ...row }) => row)
      .sort((a, b) => a.driverName.localeCompare(b.driverName)),
    highestScoringSingleSelections: tiedMaximum(playerSelections, (row) => Number(row.driverEventPoints))
      .map((row) => driverEventFact(row))
      .sort((a, b) => a.eventNumber - b.eventNumber || a.driverName.localeCompare(b.driverName)),
    mostSelectedByTier: {
      high: buildTierMostSelected(playerSelections, "high"),
      middle: buildTierMostSelected(playerSelections, "middle"),
      low: buildTierMostSelected(playerSelections, "low"),
    },
    averageTeamSize: average(teamSizes),
    mostCommonTeamSizes: tiedMaximum(teamSizeCounts, (row) => row.events)
      .sort((a, b) => a.size - b.size),
  };
}

function buildSld(player, playerSelections) {
  const rows = playerSelections.filter((row) => row.isSLD === true);
  if (!player.sldDriverId || !rows.length) {
    return {
      driver: null,
      eventsUsed: 0,
      totalPoints: 0,
      averagePoints: null,
      bestEvents: [],
    };
  }
  return {
    driver: driverFact(rows[0]),
    eventsUsed: rows.length,
    totalPoints: sum(rows.map((row) => row.driverEventPoints)),
    averagePoints: average(rows.map((row) => row.driverEventPoints)),
    bestEvents: tiedMaximum(rows, (row) => Number(row.driverEventPoints))
      .map((row) => driverEventFact(row))
      .sort((a, b) => a.eventNumber - b.eventNumber),
  };
}

function buildStarDriver(rows) {
  return {
    selections: rows.length,
    totalPoints: sum(rows.map((row) => row.driverEventPoints)),
    averagePoints: average(rows.map((row) => row.driverEventPoints)),
    bestSelections: tiedMaximum(rows, (row) => Number(row.driverEventPoints))
      .map((row) => driverEventFact(row))
      .sort((a, b) => a.eventNumber - b.eventNumber || a.driverName.localeCompare(b.driverName)),
  };
}

function buildBudget(player, summaries) {
  let carriedBudget = 10;
  const timeline = summaries.map((row) => {
    if (row.missedSubmission) {
      return {
        eventNumber: row.eventNumber,
        eventName: row.eventName,
        entered: false,
        startingBudget: carriedBudget,
        budgetAfterEvent: carriedBudget,
        change: 0,
      };
    }
    if (!Number.isFinite(Number(row.startingBudget)) || !Number.isFinite(Number(row.budgetAfterEvent))) {
      fail(`Missing entered-event budget for ${player.displayName}, Event ${row.eventNumber}`);
    }
    const startingBudget = round(row.startingBudget);
    const budgetAfterEvent = round(row.budgetAfterEvent);
    const change = round(budgetAfterEvent - startingBudget);
    carriedBudget = budgetAfterEvent;
    return {
      eventNumber: row.eventNumber,
      eventName: row.eventName,
      entered: true,
      startingBudget,
      budgetAfterEvent,
      change,
    };
  });

  const entered = summaries.filter((row) => !row.missedSubmission);
  const baseBudgetValues = [10, ...timeline.flatMap((row) => [row.startingBudget, row.budgetAfterEvent])];
  const closestRows = tiedMinimum(entered, (row) => Number(row.unusedBudget));
  const increaseRows = tiedMaximum(timeline, (row) => row.change);
  const decreaseRows = tiedMinimum(timeline, (row) => row.change);

  return {
    startingBaseBudget: 10,
    finalBaseBudget: round(player.currentBudget),
    highestBaseBudget: Math.max(...baseBudgetValues),
    lowestBaseBudget: Math.min(...baseBudgetValues),
    overallBaseBudgetChange: round(Number(player.currentBudget) - 10),
    averageTeamSpend: average(entered.map((row) => row.amountSpent)),
    averageUnusedBudget: average(entered.map((row) => row.unusedBudget)),
    closestToFullSpend: closestRows.map((row) => eventFact(row, "unusedBudget", "unusedBudget")),
    exactBudgetEvents: entered.filter((row) => Number(row.unusedBudget) === 0).length,
    biggestBaseBudgetIncrease: {
      change: increaseRows[0]?.change || 0,
      events: increaseRows.filter((row) => row.change > 0),
    },
    biggestBaseBudgetDecrease: {
      change: decreaseRows[0]?.change || 0,
      events: decreaseRows.filter((row) => row.change < 0),
    },
  };
}

function buildPitStop(playerName, history, eventByNumber) {
  const allEntries = history.pitStopRounds.flatMap(roundPayoutEntries);
  const playerEntries = allEntries.filter((entry) => entry.playerName === playerName);
  const byRound = Array.from(groupBy(playerEntries, (entry) => entry.roundNumber).entries())
    .map(([roundNumber, entries]) => ({
      roundNumber: Number(roundNumber),
      eventNumber: Math.ceil(Number(roundNumber) / 3),
      eventName: eventByNumber.get(Math.ceil(Number(roundNumber) / 3))?.eventName || null,
      amount: round(sum(entries.map((entry) => entry.amount))),
    }));
  const biggest = tiedMaximum(byRound, (row) => row.amount).sort((a, b) => a.roundNumber - b.roundNumber);
  const totals = history.pitStopPlayerTotals.map((row) => ({
    playerName: row.playerName,
    totalWon: round(row.totalWon),
  }));
  const totalRow = totals.find((row) => row.playerName === playerName);
  if (!totalRow) fail(`Missing Pit Stop total for ${playerName}`);
  const totalFromRounds = round(sum(playerEntries.map((entry) => entry.amount)));
  if (totalFromRounds !== totalRow.totalWon) {
    fail(`Pit Stop total mismatch for ${playerName}: ${totalFromRounds} vs ${totalRow.totalWon}`);
  }
  const fullPotWins = history.pitStopRounds.filter((roundRow) => {
    return roundRow.drawnPlayerWon === true && splitPayoutNames(roundRow.drawnPlayer).includes(playerName);
  }).length;

  return {
    totalWon: totalRow.totalWon,
    earningsRank: 1 + totals.filter((row) => row.totalWon > totalRow.totalWon).length,
    payoutRounds: byRound.length,
    biggestPayouts: biggest,
    fullPotWins,
  };
}

function specialistForPlayer(extra, slug) {
  const output = {};
  Object.entries(extra.specialistChampionships).forEach(([key, rows]) => {
    const value = rows[slug];
    if (!Array.isArray(value) || value.length !== 2) {
      fail(`Missing ${key} standings for ${slug}`);
    }
    output[key] = { position: value[0], points: value[1] };
  });
  return output;
}

function assertFiniteTree(value, location = "output") {
  if (typeof value === "number" && !Number.isFinite(value)) fail(`Invalid number at ${location}`);
  if (value === undefined) fail(`Undefined value at ${location}`);
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertFiniteTree(child, `${location}[${index}]`));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => assertFiniteTree(child, `${location}.${key}`));
  }
}

function main() {
  const history = readJson(historyPath);
  const extra = readJson(extraPath);
  if (Number(history.season) !== SEASON || Number(extra.season) !== SEASON) {
    fail("Both input files must describe the 2026 season");
  }

  const activePlayers = history.players.filter((player) => player.active !== false);
  if (activePlayers.length !== 19) fail(`Expected 19 active players, found ${activePlayers.length}`);
  const slugByName = extra.publicPlayerSlugs || {};
  const slugs = activePlayers.map((player) => slugByName[player.displayName]);
  if (slugs.some((slug) => !slug) || new Set(slugs).size !== activePlayers.length) {
    fail("Every active player must have a unique public slug");
  }

  const eventRows = history.events.slice().sort((a, b) => a.eventNumber - b.eventNumber);
  const eventByNumber = new Map(eventRows.map((row) => [row.eventNumber, row]));
  const summaries = history.playerEventSummaries.slice().sort((a, b) => a.eventNumber - b.eventNumber);
  const selections = applyTierOverrides(history.playerDriverSelections, extra);
  const summariesByPlayer = groupBy(summaries, (row) => row.playerId);
  const selectionsByPlayer = groupBy(selections, (row) => row.playerId);
  const sessionKeys = {
    qualifying: "qualifyingPoints",
    race1: "race1Points",
    race2: "race2Points",
    race3: "race3Points",
  };
  const sessionWins = Object.fromEntries(
    Object.entries(sessionKeys).map(([name, key]) => [name, sessionWinsByPlayer(summaries, key)])
  );
  const championPoints = Math.max(...activePlayers.map((player) => Number(player.championshipPoints)));

  const players = {};
  activePlayers
    .slice()
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .forEach((player) => {
      const slug = slugByName[player.displayName];
      const playerSummaries = (summariesByPlayer.get(player.playerId) || [])
        .slice()
        .sort((a, b) => a.eventNumber - b.eventNumber);
      if (playerSummaries.length !== eventRows.length) {
        fail(`${player.displayName} has ${playerSummaries.length} event summaries; expected ${eventRows.length}`);
      }
      const entered = playerSummaries.filter((row) => row.missedSubmission !== true);
      const missed = playerSummaries.filter((row) => row.missedSubmission === true);
      const playerSelections = selectionsByPlayer.get(player.playerId) || [];
      const eventScores = entered.map((row) => Number(row.playerEventPoints));
      const eventPositions = entered.map((row) => Number(row.eventPosition));
      const pointsFromEvents = sum(eventScores);
      if (pointsFromEvents !== Number(player.championshipPoints)) {
        fail(`${player.displayName} event total ${pointsFromEvents} does not match final standings ${player.championshipPoints}`);
      }

      const journeyPositions = playerSummaries.map((row) => ({
        eventNumber: row.eventNumber,
        eventName: row.eventName,
        position: row.overallPositionAfterEvent,
      }));
      const sessionTotals = Object.fromEntries(
        Object.entries(sessionKeys).map(([name, key]) => [name, sum(entered.map((row) => row[key]))])
      );
      const sessionAverages = Object.fromEntries(
        Object.entries(sessionTotals).map(([name, total]) => [name, entered.length ? round(total / entered.length) : null])
      );
      const strongestAverage = Math.max(...Object.values(sessionAverages));
      const strongestSessions = Object.entries(sessionAverages)
        .filter(([, value]) => value === strongestAverage)
        .map(([name]) => name);
      const sessionOccurrences = entered.flatMap((row) => Object.entries(sessionKeys).map(([session, key]) => ({
        session,
        eventNumber: row.eventNumber,
        eventName: row.eventName,
        score: Number(row[key]),
      })));
      const highestSessions = tiedMaximum(sessionOccurrences, (row) => row.score)
        .sort((a, b) => a.eventNumber - b.eventNumber || a.session.localeCompare(b.session));

      const underdogRows = playerSelections.filter((row) => row.starDriverType === "A");
      const formRows = playerSelections.filter((row) => row.starDriverType === "B");
      const fantasyTeam = player.teamId
        ? (() => {
            const team = extra.fantasyTeams[player.teamId];
            if (!team) fail(`Missing fantasy-team standings for ${player.displayName}`);
            return {
              teamId: player.teamId,
              name: team.name,
              position: team.position,
              points: team.points,
            };
          })()
        : null;

      players[slug] = {
        name: player.displayName,
        fantasyTeamName: fantasyTeam?.name || null,
        championship: {
          position: player.championshipPosition,
          points: player.championshipPoints,
          gapToChampion: championPoints - Number(player.championshipPoints),
          eventsEntered: entered.length,
          eventsMissed: missed.length,
          eventWins: entered.filter((row) => row.eventPosition === 1).length,
          eventPodiums: entered.filter((row) => row.eventPosition <= 3).length,
          top6Finishes: entered.filter((row) => row.eventPosition <= 6).length,
          averageEventScore: average(eventScores),
          averageEventPosition: average(eventPositions),
          highestScoringEvents: tiedMaximum(entered, (row) => Number(row.playerEventPoints))
            .map((row) => eventFact(row, "playerEventPoints")),
          lowestScoringEnteredEvents: tiedMinimum(entered, (row) => Number(row.playerEventPoints))
            .map((row) => eventFact(row, "playerEventPoints")),
          longestTop6Streak: longestStreak(playerSummaries, (row) => row.eventPosition <= 6),
          longestPodiumStreak: longestStreak(playerSummaries, (row) => row.eventPosition <= 3),
        },
        championshipJourney: {
          positionAfterEvent1: journeyPositions[0].position,
          bestPosition: Math.min(...journeyPositions.map((row) => row.position)),
          lowestPosition: Math.max(...journeyPositions.map((row) => row.position)),
          biggestPositionGain: biggestPositionChanges(journeyPositions, "gain"),
          biggestPositionLoss: biggestPositionChanges(journeyPositions, "loss"),
          finalPosition: player.championshipPosition,
          positions: journeyPositions,
        },
        sessions: {
          totals: sessionTotals,
          averages: sessionAverages,
          strongestSessions,
          wins: Object.fromEntries(
            Object.keys(sessionKeys).map((name) => [name, Number(sessionWins[name].get(player.playerId) || 0)])
          ),
          highestSingleSessionScores: highestSessions,
        },
        driverSelections: buildDriverSelections(playerSelections),
        seasonLongDriver: buildSld(player, playerSelections),
        starDrivers: {
          underdog: buildStarDriver(underdogRows),
          formDriver: buildStarDriver(formRows),
          totalSelections: underdogRows.length + formRows.length,
        },
        budget: buildBudget(player, playerSummaries),
        consistency: {
          medianEventScore: median(eventScores),
          eventScoreRange: Math.max(...eventScores) - Math.min(...eventScores),
          populationStandardDeviation: populationStandardDeviation(eventScores),
        },
        specialistChampionships: specialistForPlayer(extra, slug),
        fantasyTeam,
        pitStopPot: buildPitStop(player.displayName, history, eventByNumber),
      };
    });

  const output = {
    schemaVersion: 1,
    season: SEASON,
    playerOrder: Object.keys(players),
    players,
  };
  assertFiniteTree(output);

  if (Object.keys(players).length !== 19) fail("Generated output does not contain 19 players");
  activePlayers.forEach((sourcePlayer) => {
    const generated = players[slugByName[sourcePlayer.displayName]];
    if (
      generated.championship.position !== sourcePlayer.championshipPosition ||
      generated.championship.points !== sourcePlayer.championshipPoints
    ) {
      fail(`Final standings mismatch for ${sourcePlayer.displayName}`);
    }
  });

  const serialised = `${JSON.stringify(output, null, 2)}\n`;
  activePlayers.forEach((player) => {
    if (serialised.includes(player.playerId)) fail(`Private Firebase UID leaked for ${player.displayName}`);
  });
  ["submissionTimestamp", "engineVersion", "computedAt", "updatedAt"].forEach((forbidden) => {
    if (serialised.includes(`"${forbidden}"`)) fail(`Forbidden internal field leaked: ${forbidden}`);
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, serialised, "utf8");
  console.log(`Generated ${path.relative(projectRoot, outputPath)} for ${Object.keys(players).length} players.`);
}

main();
