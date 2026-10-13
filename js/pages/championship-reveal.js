(function () {
  "use strict";

  const DATA_URL = "./data/season-stats/2026.json";
  const UNLOCK_KEY = "btccFantasy:2026ChampionshipRevealed";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pointsFormatter = new Intl.NumberFormat("en-GB");

  let statsData = null;
  let loadPromise = null;
  let memoryUnlocked = false;
  let revealRun = 0;

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

  function isUnlocked() {
    try {
      return window.localStorage.getItem(UNLOCK_KEY) === "true" || memoryUnlocked;
    } catch (_) {
      return memoryUnlocked;
    }
  }

  function unlockStandings() {
    memoryUnlocked = true;
    try {
      window.localStorage.setItem(UNLOCK_KEY, "true");
    } catch (_) {
      // The current page session remains unlocked if storage is unavailable.
    }
  }

  function entrants() {
    return statsData.playerOrder
      .map((slug) => ({ slug, ...statsData.players[slug] }))
      .filter((player) => player.championship)
      .sort((a, b) => b.championship.position - a.championship.position);
  }

  function podiumClass(position) {
    if (position === 1) return " championshipRevealResult--champion";
    if (position === 2) return " championshipRevealResult--silver";
    if (position === 3) return " championshipRevealResult--bronze";
    return "";
  }

  function resultRow(player, current = false) {
    const position = player.championship.position;
    return `<li class="championshipRevealResult${podiumClass(position)}${current ? " championshipRevealResult--current" : ""}" data-position="${position}">
      <span class="championshipRevealResult__position">${ordinal(position)}</span>
      <strong class="championshipRevealResult__name">${escapeHtml(player.name)}</strong>
      <span class="championshipRevealResult__points">${pointsFormatter.format(player.championship.points)} pts</span>
    </li>`;
  }

  function introMarkup() {
    return `<section class="card championshipReveal championshipReveal--intro" aria-labelledby="championship-reveal-title">
      <div class="championshipReveal__flag" aria-hidden="true"></div>
      <p class="championshipReveal__eyebrow">2026 SEASON FINALE</p>
      <div class="championshipReveal__trophy" aria-hidden="true">🏆</div>
      <h1 id="championship-reveal-title">The championship is decided.</h1>
      <p class="championshipReveal__lead">Nineteen players. Ten events. One final table.</p>
      <button class="championshipRevealButton championshipRevealButton--primary" id="championship-reveal-start" type="button">
        Reveal the 2026 Championship
      </button>
      <p class="championshipReveal__hint">The standings will be revealed from 19th place to the 2026 Champion.</p>
    </section>`;
  }

  function stageMarkup() {
    return `<section class="card championshipReveal championshipReveal--stage" aria-labelledby="championship-reveal-stage-title">
      <div class="championshipReveal__stageHeader">
        <div>
          <p class="championshipReveal__eyebrow">FINAL OVERALL CHAMPIONSHIP</p>
          <h1 id="championship-reveal-stage-title">The final standings</h1>
        </div>
        <span class="championshipReveal__counter" id="championship-reveal-counter">0 / 19</span>
      </div>
      <div class="championshipReveal__progress" aria-hidden="true"><span id="championship-reveal-progress"></span></div>
      <div class="championshipReveal__live" id="championship-reveal-live" aria-live="polite"></div>
      <ol class="championshipRevealResults" id="championship-reveal-results" aria-label="Revealed championship positions"></ol>
      <div id="championship-reveal-finish"></div>
    </section>`;
  }

  function championMarkup() {
    const champion = statsData.players.steve;
    const runnerUp = statsData.players.daniel;
    const lead = runnerUp.championship.gapToChampion;

    return `<div class="championshipRevealChampion" aria-labelledby="championship-reveal-champion-title">
      <div class="championshipRevealChampion__crown" aria-hidden="true">🏆</div>
      <p class="championshipReveal__eyebrow">YOUR 2026 CHAMPION</p>
      <h2 id="championship-reveal-champion-title">Steve is the 2026 BTCC Fantasy League Champion!</h2>
      <p><strong>${pointsFormatter.format(champion.championship.points)} points</strong></p>
      <p>${pointsFormatter.format(lead)} points ahead of Daniel.</p>
      <div class="championshipRevealActions">
        <a class="championshipRevealButton championshipRevealButton--primary" href="#standings">View Full 2026 Standings</a>
        <button class="championshipRevealButton championshipRevealButton--secondary" id="championship-reveal-replay" type="button">Replay Reveal</button>
      </div>
    </div>`;
  }

  function delayFor(position) {
    if (position === 1) return 3200;
    if (position === 2) return 2600;
    if (position === 3) return 2100;
    if (position <= 6) return 1250;
    if (position <= 10) return 950;
    return 750;
  }

  function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  function updateStage(player, revealed, total) {
    const results = document.getElementById("championship-reveal-results");
    const live = document.getElementById("championship-reveal-live");
    const counter = document.getElementById("championship-reveal-counter");
    const progress = document.getElementById("championship-reveal-progress");
    if (!results || !live || !counter || !progress) return;

    results.querySelector(".championshipRevealResult--current")?.classList.remove("championshipRevealResult--current");
    results.insertAdjacentHTML("afterbegin", resultRow(player, true));
    live.textContent = `${ordinal(player.championship.position)} place: ${player.name}, ${pointsFormatter.format(player.championship.points)} points`;
    counter.textContent = `${revealed} / ${total}`;
    progress.style.width = `${(revealed / total) * 100}%`;
  }

  function finishReveal() {
    unlockStandings();
    document.getElementById("championship-reveal-results")
      ?.querySelector(".championshipRevealResult--current")
      ?.classList.remove("championshipRevealResult--current");
    const finish = document.getElementById("championship-reveal-finish");
    if (finish) {
      finish.innerHTML = championMarkup();
      finish.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "nearest" });
      bindReplay();
    }
  }

  async function startReveal() {
    const root = document.getElementById("championship-reveal-root");
    if (!root || !statsData) return;

    const run = ++revealRun;
    const players = entrants();
    root.innerHTML = stageMarkup();

    if (reducedMotion.matches) {
      players.forEach((player, index) => updateStage(player, index + 1, players.length));
      finishReveal();
      return;
    }

    await wait(350);
    for (let index = 0; index < players.length; index += 1) {
      if (run !== revealRun) return;
      const player = players[index];
      updateStage(player, index + 1, players.length);
      await wait(delayFor(player.championship.position));
    }

    if (run === revealRun) finishReveal();
  }

  function bindReplay() {
    document.getElementById("championship-reveal-replay")?.addEventListener("click", startReveal);
  }

  function renderCompleted(root) {
    const players = entrants();
    root.innerHTML = stageMarkup();
    const results = document.getElementById("championship-reveal-results");
    const counter = document.getElementById("championship-reveal-counter");
    const progress = document.getElementById("championship-reveal-progress");
    if (results) results.innerHTML = players.slice().reverse().map((player) => resultRow(player)).join("");
    if (counter) counter.textContent = `${players.length} / ${players.length}`;
    if (progress) progress.style.width = "100%";
    const finish = document.getElementById("championship-reveal-finish");
    if (finish) finish.innerHTML = championMarkup();
    bindReplay();
  }

  function renderIntro(root) {
    root.innerHTML = introMarkup();
    root.querySelector("#championship-reveal-start")?.addEventListener("click", startReveal);
  }

  async function fetchStats() {
    const response = await fetch(DATA_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Championship data returned ${response.status}`);
    const data = await response.json();
    if (!data.players?.steve || !data.players?.daniel || data.playerOrder?.length !== 19) {
      throw new Error("Championship data is incomplete");
    }
    return data;
  }

  async function loadChampionshipReveal() {
    const root = document.getElementById("championship-reveal-root");
    if (!root) return;

    if (statsData) {
      if (!root.querySelector(".championshipReveal")) {
        isUnlocked() ? renderCompleted(root) : renderIntro(root);
      }
      return;
    }

    root.innerHTML = `<section class="card championshipReveal championshipReveal--loading" role="status"><span class="championshipRevealSpinner" aria-hidden="true"></span>Preparing the final standings…</section>`;
    try {
      loadPromise ||= fetchStats();
      statsData = await loadPromise;
      isUnlocked() ? renderCompleted(root) : renderIntro(root);
    } catch (error) {
      console.error("Championship reveal failed to load", error);
      loadPromise = null;
      root.innerHTML = `<section class="card championshipReveal championshipReveal--error" role="alert">
        <h1>The championship reveal is unavailable</h1>
        <p>We could not load the final 2026 standings. Please try again.</p>
        <button class="championshipRevealButton championshipRevealButton--primary" id="championship-reveal-retry" type="button">Try again</button>
      </section>`;
      root.querySelector("#championship-reveal-retry")?.addEventListener("click", loadChampionshipReveal);
    }
  }

  window.isChampionshipRevealUnlocked = isUnlocked;
  window.loadChampionshipReveal = loadChampionshipReveal;
})();
