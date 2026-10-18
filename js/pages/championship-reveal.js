(function () {
  "use strict";

  const DATA_URL = "./data/season-stats/2026.json";
  const UNLOCK_KEY = "btccFantasy:2026ChampionshipRevealed";
  const SEASON_START = new Date("2027-04-10T14:00:00+01:00");
  const pointsFormatter = new Intl.NumberFormat("en-GB");
  const moneyFormatter = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  });

  let statsData = null;
  let loadPromise = null;
  let countdownTimer = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function ordinal(value) {
    const number = Number(value);
    const mod100 = number % 100;
    const suffix = mod100 >= 11 && mod100 <= 13
      ? "th"
      : ({ 1: "st", 2: "nd", 3: "rd" }[number % 10] || "th");
    return `${number}${suffix}`;
  }

  function unlockFinalStandings() {
    try {
      window.localStorage.setItem(UNLOCK_KEY, "true");
    } catch (_) {
      // The public post-season hub still renders if storage is unavailable.
    }
  }

  function championshipTopThree() {
    return statsData.playerOrder
      .map((slug) => statsData.players[slug])
      .filter((player) => player?.championship?.position <= 3)
      .sort((a, b) => a.championship.position - b.championship.position);
  }

  function teamChampion() {
    return statsData.playerOrder
      .map((slug) => statsData.players[slug]?.fantasyTeam)
      .find((team) => team?.position === 1) || null;
  }

  function pitStopWinner() {
    return statsData.playerOrder
      .map((slug) => statsData.players[slug])
      .find((player) => player?.pitStopPot?.earningsRank === 1) || null;
  }

  function finalEventWinner() {
    const eventTenScores = statsData.playerOrder.flatMap((slug) => {
      const player = statsData.players[slug];
      return (player?.championship?.highestScoringEvents || [])
        .filter((event) => event.eventNumber === 10)
        .map((event) => ({ name: player.name, ...event }));
    });
    return eventTenScores.sort((a, b) => b.score - a.score)[0] || null;
  }

  function podiumMarkup(players) {
    return players.map((player) => `
      <li class="postSeasonPodium__row postSeasonPodium__row--${player.championship.position}">
        <span>${ordinal(player.championship.position)}</span>
        <strong>${escapeHtml(player.name)}</strong>
        <em>${pointsFormatter.format(player.championship.points)} pts</em>
      </li>
    `).join("");
  }

  function hubMarkup() {
    const topThree = championshipTopThree();
    const champion = topThree[0];
    const winningTeam = teamChampion();
    const pitStop = pitStopWinner();
    const finaleWinner = finalEventWinner();

    return `<section class="postSeasonHub" aria-labelledby="post-season-title">
      <div class="postSeasonHero card">
        <div class="postSeasonHero__flag" aria-hidden="true"></div>
        <p class="postSeasonHero__eyebrow">2026 season complete</p>
        <h1 id="post-season-title">2026 Season Complete</h1>
        <p class="postSeasonHero__lead">The chequered flag has fallen on 2026. The results are final, the trophies are decided, and work now begins on the next chapter.</p>

        <div class="postSeasonCountdown" role="timer" aria-label="Countdown to the 2027 season">
          ${["days", "hours", "minutes", "seconds"].map((unit) => `
            <div class="postSeasonCountdown__unit">
              <strong data-countdown-unit="${unit}">0</strong>
              <span>${unit[0].toUpperCase()}${unit.slice(1)}</span>
            </div>
          `).join("")}
        </div>
        <p class="postSeasonCountdown__date" id="post-season-countdown-date">Saturday 10 April 2027 <span aria-hidden="true">•</span> 2:00pm</p>

        <div class="postSeasonHero__actions">
          <a class="championshipRevealButton championshipRevealButton--primary" href="#standings">Final standings</a>
          <a class="championshipRevealButton championshipRevealButton--secondary" href="#season-stats">Season review</a>
          <a class="championshipRevealButton championshipRevealButton--secondary" href="#news">Latest news</a>
        </div>
      </div>

      <div class="postSeasonSummary">
        <article class="card postSeasonChampion">
          <p class="postSeasonSummary__eyebrow">2026 champion</p>
          <div class="postSeasonChampion__trophy" aria-hidden="true">🏆</div>
          <h2>${escapeHtml(champion.name)}</h2>
          <strong>${pointsFormatter.format(champion.championship.points)} points</strong>
          <ol class="postSeasonPodium" aria-label="2026 championship top three">${podiumMarkup(topThree)}</ol>
          <a href="#standings">View the final table <span aria-hidden="true">→</span></a>
        </article>

        <div class="postSeasonHonours">
          ${winningTeam ? `<article class="card postSeasonHonour">
            <span>Team champions</span>
            <strong>${escapeHtml(winningTeam.name)}</strong>
            <em>${pointsFormatter.format(winningTeam.points)} pts</em>
          </article>` : ""}
          ${pitStop ? `<article class="card postSeasonHonour">
            <span>Pit Stop Pot winner</span>
            <strong>${escapeHtml(pitStop.name)}</strong>
            <em>${moneyFormatter.format(pitStop.pitStopPot.totalWon)} won</em>
            <a href="#pitstop">View the 2026 pot <span aria-hidden="true">→</span></a>
          </article>` : ""}
          ${finaleWinner ? `<article class="card postSeasonHonour">
            <span>Final event winner</span>
            <strong>${escapeHtml(finaleWinner.name)}</strong>
            <em>${pointsFormatter.format(finaleWinner.score)} pts · ${escapeHtml(finaleWinner.eventName)}</em>
          </article>` : ""}
          <article class="card postSeasonHonour postSeasonHonour--review">
            <span>Relive the season</span>
            <strong>Every result and story</strong>
            <div class="postSeasonHonour__links">
              <a href="#season-stats">Season review</a>
              <a href="#news">News archive</a>
            </div>
          </article>
        </div>
      </div>
    </section>`;
  }

  function updateCountdown() {
    const remaining = Math.max(0, SEASON_START.getTime() - Date.now());
    const totalSeconds = Math.floor(remaining / 1000);
    const values = {
      days: Math.floor(totalSeconds / 86400),
      hours: Math.floor((totalSeconds % 86400) / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60,
    };

    Object.entries(values).forEach(([unit, value]) => {
      const element = document.querySelector(`[data-countdown-unit="${unit}"]`);
      if (element) element.textContent = String(value).padStart(2, "0");
    });

    if (remaining === 0) {
      const date = document.getElementById("post-season-countdown-date");
      if (date) date.textContent = "The 2027 season is underway";
      window.clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function startCountdown() {
    if (countdownTimer) window.clearInterval(countdownTimer);
    updateCountdown();
    countdownTimer = window.setInterval(updateCountdown, 1000);
  }

  async function fetchStats() {
    const response = await fetch(DATA_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Championship data returned ${response.status}`);
    const data = await response.json();
    if (!data.players?.steve || !data.playerOrder?.length) {
      throw new Error("Championship data is incomplete");
    }
    return data;
  }

  async function loadChampionshipReveal() {
    const root = document.getElementById("championship-reveal-root");
    if (!root) return;

    root.innerHTML = `<section class="card championshipReveal championshipReveal--loading" role="status"><span class="championshipRevealSpinner" aria-hidden="true"></span>Preparing the post-season hub…</section>`;
    try {
      loadPromise ||= fetchStats();
      statsData = await loadPromise;
      unlockFinalStandings();
      root.innerHTML = hubMarkup();
      startCountdown();
    } catch (error) {
      console.error("Post-season hub failed to load", error);
      loadPromise = null;
      root.innerHTML = `<section class="card championshipReveal championshipReveal--error" role="alert">
        <h1>The post-season hub is unavailable</h1>
        <p>We could not load the final 2026 season data. Please try again.</p>
        <button class="championshipRevealButton championshipRevealButton--primary" id="championship-reveal-retry" type="button">Try again</button>
      </section>`;
      root.querySelector("#championship-reveal-retry")?.addEventListener("click", loadChampionshipReveal);
    }
  }

  window.isChampionshipRevealUnlocked = () => true;
  window.loadChampionshipReveal = loadChampionshipReveal;
})();
