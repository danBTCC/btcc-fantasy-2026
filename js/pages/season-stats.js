(function () {
  "use strict";

  const DATA_URL = "./data/season-stats/2026.json";
  const numberFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
  let statsData = null;
  let loadPromise = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatNumber(value) {
    return value === null || value === undefined ? "None" : numberFormatter.format(value);
  }

  function formatMoney(value, signed = false) {
    if (value === null || value === undefined) return "None";
    const amount = Math.abs(Number(value)).toFixed(2);
    if (!signed || Number(value) === 0) return `${Number(value) < 0 ? "−" : ""}£${amount}`;
    return `${Number(value) > 0 ? "+" : "−"}£${amount}`;
  }

  function ordinal(value) {
    if (value === null || value === undefined) return "None";
    const number = Number(value);
    const mod100 = number % 100;
    const suffix = mod100 >= 11 && mod100 <= 13
      ? "th"
      : ({ 1: "st", 2: "nd", 3: "rd" }[number % 10] || "th");
    return `${number}${suffix}`;
  }

  function sessionName(value) {
    return ({ qualifying: "Qualifying", race1: "Race 1", race2: "Race 2", race3: "Race 3" })[value] || value;
  }

  function currentSlug() {
    const parts = (window.location.hash || "").replace(/^#/, "").split("/");
    if (parts[0].toLowerCase() !== "season-stats" || !parts[1]) return null;
    try {
      return decodeURIComponent(parts[1]).toLowerCase();
    } catch (_) {
      return null;
    }
  }

  function playerEntries() {
    if (!statsData) return [];
    return statsData.playerOrder.map((slug) => [slug, statsData.players[slug]]).filter(([, player]) => player);
  }

  function metric(label, value, detail = "") {
    return `
      <div class="seasonStatsMetric">
        <dt>${escapeHtml(label)}</dt>
        <dd>${escapeHtml(value)}</dd>
        ${detail ? `<div class="seasonStatsMetric__detail">${detail}</div>` : ""}
      </div>`;
  }

  function tiedItems(items, formatter) {
    if (!Array.isArray(items) || !items.length) return "None";
    return `<ul class="seasonStatsTies">${items.map((item) => `<li>${formatter(item)}</li>`).join("")}</ul>`;
  }

  function eventScoreItems(items) {
    return tiedItems(items, (item) => `${escapeHtml(item.eventName)} <span>Event ${item.eventNumber} · ${formatNumber(item.score)} pts</span>`);
  }

  function driverItems(items, valueKey, suffix) {
    return tiedItems(items, (item) => `${escapeHtml(item.driverName)} <span>${formatNumber(item[valueKey])} ${suffix}</span>`);
  }

  function selectionItems(items) {
    return tiedItems(items, (item) => `${escapeHtml(item.driverName)} <span>${escapeHtml(item.eventName)} · ${formatNumber(item.points)} pts</span>`);
  }

  function transitionItems(change) {
    if (!change || !Array.isArray(change.transitions) || !change.transitions.length) return "None";
    return tiedItems(change.transitions, (item) => `Event ${item.fromEventNumber} → ${item.toEventNumber} <span>${ordinal(item.fromPosition)} → ${ordinal(item.toPosition)}</span>`);
  }

  function section(title, content, className = "") {
    return `<section class="card seasonStatsSection ${className}" aria-labelledby="season-stats-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}">
      <h2 id="season-stats-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}">${escapeHtml(title)}</h2>
      ${content}
    </section>`;
  }

  function metricGrid(items) {
    return `<dl class="seasonStatsMetrics">${items.join("")}</dl>`;
  }

  function playerPicker(selectedSlug = "") {
    return `<div class="seasonStatsPicker">
      <label for="season-stats-player">Choose a player</label>
      <select id="season-stats-player">
        <option value="">All players</option>
        ${playerEntries().map(([slug, player]) => `<option value="${escapeHtml(slug)}"${slug === selectedSlug ? " selected" : ""}>${escapeHtml(player.name)}</option>`).join("")}
      </select>
    </div>`;
  }

  function playerGrid() {
    return `<div class="seasonStatsPlayerGrid">
      ${playerEntries().map(([slug, player]) => `
        <a class="seasonStatsPlayerCard" href="#season-stats/${encodeURIComponent(slug)}">
          <span class="seasonStatsPlayerCard__position">${ordinal(player.championship.position)}</span>
          <strong>${escapeHtml(player.name)}</strong>
          <span>${formatNumber(player.championship.points)} points</span>
        </a>`).join("")}
    </div>`;
  }

  function renderLanding(root) {
    root.innerHTML = `
      <header class="card seasonStatsIntro">
        <div>
          <p class="seasonStatsEyebrow">2026 SEASON REVIEW</p>
          <h1>Season Stats</h1>
          <p class="muted">Select any player to explore their championship, selections, budget and season highlights.</p>
        </div>
        ${playerPicker()}
      </header>
      <section class="card seasonStatsSection" aria-labelledby="season-stats-players">
        <h2 id="season-stats-players">All 19 players</h2>
        ${playerGrid()}
      </section>`;
    bindPicker(root);
  }

  function renderPlayer(root, slug, player) {
    const c = player.championship;
    const journey = player.championshipJourney;
    const sessions = player.sessions;
    const selections = player.driverSelections;
    const sld = player.seasonLongDriver;
    const stars = player.starDrivers;
    const budget = player.budget;
    const consistency = player.consistency;
    const specialists = player.specialistChampionships;
    const fantasyTeam = player.fantasyTeam;
    const pot = player.pitStopPot;

    const journeyStrip = `<div class="seasonStatsJourney" aria-label="Championship position after each event">
      ${journey.positions.map((item) => `<div class="seasonStatsJourney__stop" title="${escapeHtml(item.eventName)}">
        <span>E${item.eventNumber}</span><strong>${ordinal(item.position)}</strong><small>${escapeHtml(item.eventName)}</small>
      </div>`).join("")}
    </div>`;

    const specialistNames = {
      wingfoot: "WingFoot (Qualifying)", race1: "Race 1 Championship", race2: "Race 2 Championship",
      race3: "Race 3 Championship", manufacturer: "Manufacturer Championship",
      independents: "Independents Championship", jackSears: "Jack Sears Championship",
    };

    root.innerHTML = `
      <header class="card seasonStatsHero">
        <div class="seasonStatsHero__top">
          <a class="seasonStatsBack" href="#season-stats">← All players</a>
          ${playerPicker(slug)}
        </div>
        <div class="seasonStatsHero__body">
          <div class="seasonStatsPosition"><span>Final position</span><strong>${ordinal(c.position)}</strong></div>
          <div>
            <p class="seasonStatsEyebrow">2026 SEASON REVIEW</p>
            <h1>${escapeHtml(player.name)}</h1>
            <p class="seasonStatsHero__team">Fantasy Team: <strong>${escapeHtml(player.fantasyTeamName || "None")}</strong></p>
          </div>
        </div>
        <div class="seasonStatsHero__summary">
          <span><strong>${formatNumber(c.points)}</strong> points</span>
          <span><strong>${c.gapToChampion === 0 ? "Champion" : `${formatNumber(c.gapToChampion)} pts`}</strong> ${c.gapToChampion === 0 ? "" : "to champion"}</span>
          <span><strong>${c.eventsEntered}</strong> entered</span>
          <span><strong>${c.eventsMissed}</strong> missed</span>
        </div>
      </header>

      ${section("Championship", metricGrid([
        metric("Final position", ordinal(c.position)), metric("Final points", formatNumber(c.points)),
        metric("Gap to champion", c.gapToChampion === 0 ? "Champion" : `${formatNumber(c.gapToChampion)} points`),
        metric("Events entered", c.eventsEntered), metric("Events missed", c.eventsMissed),
        metric("Event wins", c.eventWins), metric("Event podiums", c.eventPodiums),
        metric("Top 6 finishes", c.top6Finishes), metric("Average event score", formatNumber(c.averageEventScore)),
        metric("Average event position", formatNumber(c.averageEventPosition)),
        metric("Highest event score", "", eventScoreItems(c.highestScoringEvents)),
        metric("Lowest entered-event score", "", eventScoreItems(c.lowestScoringEnteredEvents)),
        metric("Longest Top 6 streak", `${c.longestTop6Streak} event${c.longestTop6Streak === 1 ? "" : "s"}`),
        metric("Longest podium streak", `${c.longestPodiumStreak} event${c.longestPodiumStreak === 1 ? "" : "s"}`),
      ]))}

      ${section("Championship Journey", `${metricGrid([
        metric("Position after Event 1", ordinal(journey.positionAfterEvent1)), metric("Best position", ordinal(journey.bestPosition)),
        metric("Lowest position", ordinal(journey.lowestPosition)),
        metric("Biggest position gain", `${journey.biggestPositionGain.positions} place${journey.biggestPositionGain.positions === 1 ? "" : "s"}`, transitionItems(journey.biggestPositionGain)),
        metric("Biggest position loss", `${journey.biggestPositionLoss.positions} place${journey.biggestPositionLoss.positions === 1 ? "" : "s"}`, transitionItems(journey.biggestPositionLoss)),
        metric("Final position", ordinal(journey.finalPosition)),
      ])}<h3 class="seasonStatsSubheading">Event-by-event position</h3>${journeyStrip}`)}

      ${section("Session Performance", metricGrid([
        ...["qualifying", "race1", "race2", "race3"].map((key) => metric(`${sessionName(key)} total`, `${formatNumber(sessions.totals[key])} pts`, `Average: ${formatNumber(sessions.averages[key])}`)),
        metric("Strongest session", sessions.strongestSessions.map(sessionName).join(" / ")),
        ...["qualifying", "race1", "race2", "race3"].map((key) => metric(`${sessionName(key)} wins`, sessions.wins[key])),
        metric("Highest single-session score", "", tiedItems(sessions.highestSingleSessionScores, (item) => `${sessionName(item.session)} · ${escapeHtml(item.eventName)} <span>${formatNumber(item.score)} pts</span>`)),
      ]))}

      ${section("Driver Selections", metricGrid([
        metric("Total driver selections", selections.totalSelections), metric("Different drivers used", selections.differentDriversUsed),
        metric("Most-selected driver", "", driverItems(selections.mostSelectedDrivers, "selections", "selections")),
        metric("Highest-scoring driver", "", driverItems(selections.highestScoringDrivers, "points", "pts")),
        metric("Highest-scoring single selection", "", selectionItems(selections.highestScoringSingleSelections)),
        metric("Most-selected High-tier driver", "", driverItems(selections.mostSelectedByTier.high, "selections", "selections")),
        metric("Most-selected Middle-tier driver", "", driverItems(selections.mostSelectedByTier.middle, "selections", "selections")),
        metric("Most-selected Low-tier driver", "", driverItems(selections.mostSelectedByTier.low, "selections", "selections")),
        metric("Average team size", formatNumber(selections.averageTeamSize)),
        metric("Most common team size", "", tiedItems(selections.mostCommonTeamSizes, (item) => `${item.size} drivers <span>${item.events} events</span>`)),
      ]))}

      ${section("Season Long Driver", metricGrid([
        metric("SLD driver", sld.driver ? sld.driver.driverName : "None"), metric("Entered events used", sld.eventsUsed),
        metric("Total SLD points", sld.totalPoints), metric("Average SLD points", formatNumber(sld.averagePoints)),
        metric("Best SLD event", "", tiedItems(sld.bestEvents, (item) => `${escapeHtml(item.eventName)} <span>${formatNumber(item.points)} pts</span>`)),
      ]))}

      ${section("Star Drivers", `<div class="seasonStatsSplit">
        <div><h3>Underdog Driver</h3>${metricGrid([
          metric("Selections", stars.underdog.selections), metric("Total points", stars.underdog.totalPoints),
          metric("Average points", formatNumber(stars.underdog.averagePoints)),
          metric("Best selection", "", selectionItems(stars.underdog.bestSelections)),
        ])}</div>
        <div><h3>Form Driver</h3>${metricGrid([
          metric("Selections", stars.formDriver.selections), metric("Total points", stars.formDriver.totalPoints),
          metric("Average points", formatNumber(stars.formDriver.averagePoints)),
          metric("Best selection", "", selectionItems(stars.formDriver.bestSelections)),
        ])}</div>
      </div>${metricGrid([metric("Total Star Driver selections", stars.totalSelections)])}`)}

      ${section("Budget", metricGrid([
        metric("Starting base budget", formatMoney(budget.startingBaseBudget)), metric("Final base budget", formatMoney(budget.finalBaseBudget)),
        metric("Highest base budget", formatMoney(budget.highestBaseBudget)), metric("Lowest base budget", formatMoney(budget.lowestBaseBudget)),
        metric("Overall base-budget change", formatMoney(budget.overallBaseBudgetChange, true)),
        metric("Average team spend", formatMoney(budget.averageTeamSpend)), metric("Average unused budget", formatMoney(budget.averageUnusedBudget)),
        metric("Closest to full spend", "", tiedItems(budget.closestToFullSpend, (item) => `${escapeHtml(item.eventName)} <span>${formatMoney(item.unusedBudget)} left</span>`)),
        metric("Exact-budget events", budget.exactBudgetEvents),
        metric("Biggest base-budget increase", formatMoney(budget.biggestBaseBudgetIncrease.change, true), tiedItems(budget.biggestBaseBudgetIncrease.events, (item) => `${escapeHtml(item.eventName)} <span>${formatMoney(item.startingBudget)} → ${formatMoney(item.budgetAfterEvent)}</span>`)),
        metric("Biggest base-budget decrease", formatMoney(budget.biggestBaseBudgetDecrease.change, true), tiedItems(budget.biggestBaseBudgetDecrease.events, (item) => `${escapeHtml(item.eventName)} <span>${formatMoney(item.startingBudget)} → ${formatMoney(item.budgetAfterEvent)}</span>`)),
      ]))}

      ${section("Consistency", metricGrid([
        metric("Median event score", consistency.medianEventScore), metric("Event score range", consistency.eventScoreRange),
        metric("Population standard deviation", formatNumber(consistency.populationStandardDeviation)),
      ]))}

      ${section("Specialist Championships", `<div class="seasonStatsTableWrap"><table class="seasonStatsTable">
        <thead><tr><th>Championship</th><th>Position</th><th>Points</th></tr></thead>
        <tbody>${Object.entries(specialistNames).map(([key, label]) => `<tr><td>${escapeHtml(label)}</td><td>${ordinal(specialists[key].position)}</td><td>${formatNumber(specialists[key].points)}</td></tr>`).join("")}</tbody>
      </table></div>`)}

      ${section("Fantasy Team", fantasyTeam
        ? metricGrid([metric("Fantasy team", fantasyTeam.name), metric("Final team position", ordinal(fantasyTeam.position)), metric("Final team points", formatNumber(fantasyTeam.points))])
        : `<div class="seasonStatsNone"><strong>Fantasy Team: None</strong><span>No team was assigned for the 2026 season.</span></div>`)}

      ${section("Pit Stop Pot", metricGrid([
        metric("Total money won", formatMoney(pot.totalWon)), metric("Final earnings rank", ordinal(pot.earningsRank)),
        metric("Payout rounds", pot.payoutRounds),
        metric("Biggest payout", "", tiedItems(pot.biggestPayouts, (item) => `Round ${item.roundNumber} · ${escapeHtml(item.eventName)} <span>${formatMoney(item.amount)}</span>`)),
        metric("Full-pot wins", pot.fullPotWins),
      ]))}`;

    bindPicker(root);
  }

  function bindPicker(root) {
    root.querySelector("#season-stats-player")?.addEventListener("change", (event) => {
      const slug = event.target.value;
      window.location.hash = slug ? `#season-stats/${slug}` : "#season-stats";
    });
  }

  function renderCurrentRoute() {
    const root = document.getElementById("season-stats-root");
    if (!root || !statsData) return;
    const slug = currentSlug();
    if (!slug) {
      renderLanding(root);
      return;
    }
    const player = statsData.players[slug];
    if (!player) {
      root.innerHTML = `<div class="card seasonStatsStatus" role="alert"><h1>Player not found</h1><p class="muted">Choose one of the available 2026 players.</p><a class="seasonStatsButton" href="#season-stats">View all players</a></div>`;
      return;
    }
    renderPlayer(root, slug, player);
  }

  async function fetchStats() {
    const response = await fetch(DATA_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Season Stats returned ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.playerOrder) || !data.players || data.playerOrder.length !== 19) {
      throw new Error("Season Stats data is incomplete");
    }
    return data;
  }

  async function loadSeasonStats() {
    const root = document.getElementById("season-stats-root");
    if (!root) return;
    if (statsData) {
      renderCurrentRoute();
      return;
    }
    root.innerHTML = `<div class="card seasonStatsStatus" role="status"><span class="seasonStatsSpinner" aria-hidden="true"></span>Loading Season Stats…</div>`;
    try {
      loadPromise ||= fetchStats();
      statsData = await loadPromise;
      renderCurrentRoute();
    } catch (error) {
      console.error("Season Stats failed to load", error);
      loadPromise = null;
      root.innerHTML = `<div class="card seasonStatsStatus" role="alert"><h1>Season Stats unavailable</h1><p class="muted">The 2026 stats could not be loaded. Please try again.</p><button class="seasonStatsButton" id="season-stats-retry" type="button">Try again</button></div>`;
      root.querySelector("#season-stats-retry")?.addEventListener("click", loadSeasonStats);
    }
  }

  window.addEventListener("hashchange", () => {
    if ((window.location.hash || "").toLowerCase().startsWith("#season-stats") && statsData) renderCurrentRoute();
  });

  window.loadSeasonStats = loadSeasonStats;
})();
