// js/pages/pitstop.js
// Simple Pit Stop Pot display (matches admin inputs exactly)

(function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtMoney(value) {
    return `£${Number(value || 0).toFixed(2)}`;
  }

  function isNormalRound(roundNo) {
    const n = Number(roundNo || 0);
    return n > 0 && ![10, 20, 30].includes(n);
  }

  function getRoundPaidOut(round) {
    if (round.drawnPlayerWon === true) {
      return Number(round.fullPotPrize || round.potValue || 0);
    }

    return (
      Number(round.selectedPlayerPrize || 0) +
      Number(round.firstPrize || 0) +
      Number(round.secondPrize || 0) +
      Number(round.thirdPrize || 0)
    );
  }

  function calculatePitStopTotals(data, rounds) {
    const totalPlayers = Number(data.totalPlayers || 19);
    const entryPot = totalPlayers * 0.5;
    const normalRounds = rounds
      .filter((round) => isNormalRound(round.roundNo))
      .sort((a, b) => Number(a.roundNo || 0) - Number(b.roundNo || 0));

    let rollover = 0;
    let lastCompletedRound = null;

    normalRounds.forEach((round) => {
      lastCompletedRound = round;

      if (round.drawnPlayerWon === true) {
        rollover = 0;
        return;
      }

      rollover += Number(round.rolloverAdded ?? 4.5);
    });

    return {
      totalPlayers,
      entryPot,
      calculatedRollover: rollover,
      calculatedNextPot: entryPot + rollover,
      lastCompletedRound,
    };
  }

  function renderPayoutBreakdown(round) {
    if (round.drawnPlayerWon === true) {
      return `<div><strong>Full Pot:</strong> ${escapeHtml(round.drawnPlayer || "Winner")} — ${fmtMoney(round.fullPotPrize || round.potValue || 0)}</div>`;
    }

    const payouts = [
      { label: "Selected", player: round.drawnPlayer, amount: round.selectedPlayerPrize },
      { label: "1st", player: round.firstPlaceText, amount: round.firstPrize },
      { label: "2nd", player: round.secondPlaceText, amount: round.secondPrize },
      { label: "3rd", player: round.thirdPlaceText, amount: round.thirdPrize },
    ].filter((payout) => payout.player && Number(payout.amount || 0) > 0);

    if (!payouts.length) return "-";

    return payouts
      .map((payout) => {
        return `<div><strong>${escapeHtml(payout.label)}:</strong> ${escapeHtml(payout.player)} — ${fmtMoney(payout.amount)}</div>`;
      })
      .join("");
  }

  function buildPlayerWinnings(rounds) {
    const totals = new Map();

    const addPrize = (player, amount) => {
      const name = String(player || "").trim();
      const value = Number(amount || 0);
      if (!name || value <= 0) return;
      totals.set(name, Number(totals.get(name) || 0) + value);
    };

    rounds.forEach((round) => {
      addPrize(round.drawnPlayer, round.selectedPlayerPrize);
      addPrize(round.firstPlaceText, round.firstPrize);
      addPrize(round.secondPlaceText, round.secondPrize);
      addPrize(round.thirdPlaceText, round.thirdPrize);
    });

    return Array.from(totals.entries())
      .map(([player, total]) => ({ player, total }))
      .sort((a, b) => b.total - a.total || a.player.localeCompare(b.player));
  }

  function render(root, data, rounds = []) {
    const currentPot = Number(data.currentPot || 0).toFixed(2);
    const rollover = Number(data.jackpot || 0).toFixed(2);
    const lastWinner = escapeHtml(data.lastWinner || "—");
    const nextDraw = escapeHtml(data.nextDraw || "—");

    const payments = escapeHtml(data.paymentsTable || "");
    const events = escapeHtml(data.eventsTable || "");
    const h2h = escapeHtml(data.headToHeadTable || "");

    const pitstopTotals = calculatePitStopTotals(data, rounds);

    const roundRows = rounds.length
      ? rounds
          .sort((a, b) => Number(a.roundNo || 0) - Number(b.roundNo || 0))
          .map((r) => {
            return `
              <tr>
                <td>${r.roundNo || "-"}${isNormalRound(r.roundNo) ? "" : " *"}</td>
                <td>${escapeHtml(r.drawnPlayer || "-")}</td>
                <td>${renderPayoutBreakdown(r)}</td>
                <td>${r.drawnPlayerWon === true ? fmtMoney(0) : fmtMoney(r.rolloverAdded ?? 4.5)}</td>
              </tr>
            `;
          })
          .join("")
      : `
          <tr>
            <td colspan="5" class="muted">No rounds entered yet</td>
          </tr>
        `;

    const playerWinnings = buildPlayerWinnings(rounds);

    const playerWinningsRows = playerWinnings.length
      ? playerWinnings
          .map((row) => {
            return `
              <tr>
                <td>${escapeHtml(row.player)}</td>
                <td style="text-align:right; font-weight:800;">${fmtMoney(row.total)}</td>
              </tr>
            `;
          })
          .join("")
      : `
          <tr>
            <td colspan="2" class="muted">No winnings recorded yet</td>
          </tr>
        `;

    root.innerHTML = `
      <div class="card">
        <h1>Pit Stop Pot</h1>
        <p class="muted"> All draws are screen recorded and shared in the WhatsApp group </p>
      </div>

      <div class="card" style="margin-top:10px;">
        <h2>Summary</h2>
        <div class="tiny muted" style="line-height:1.7;">
          Manual current pot: <strong>£${currentPot}</strong><br>
          Calculated next normal-round pot: <strong>${fmtMoney(pitstopTotals.calculatedNextPot)}</strong><br>
          Calculated rollover: <strong>${fmtMoney(pitstopTotals.calculatedRollover)}</strong><br>
          Entry pot per normal round: <strong>${fmtMoney(pitstopTotals.entryPot)}</strong><br>
          Last winner: <strong>${lastWinner}</strong><br>
          Next draw: <strong>${nextDraw}</strong><br>
          Manual rollover amount: <strong>£${rollover}</strong><br>
          <span class="muted">* Rounds 10, 20 and 30 are special draws and are not included in this normal-round calculation yet.</span>
        </div>
      </div>

      <div class="card" style="margin-top:10px;">
        <h2>Round History</h2>
        <table class="table tiny" style="width:100%;">
          <thead>
            <tr>
              <th>Round</th>
              <th>Drawn</th>
              <th>Payouts</th>
              <th>Rollover</th>
            </tr>
          </thead>
          <tbody>
            ${roundRows}
          </tbody>
        </table>
      </div>

      <div class="card" style="margin-top:10px;">
        <h2>Player Winnings</h2>
        <table class="table tiny" style="width:100%;">
          <thead>
            <tr>
              <th>Player</th>
              <th style="text-align:right;">Total Won</th>
            </tr>
          </thead>
          <tbody>
            ${playerWinningsRows}
          </tbody>
        </table>
      </div>

      <div class="card" style="margin-top:10px;">
        <h2>Event Breakdown</h2>
        <pre style="white-space:pre-wrap; font-size:13px;">${events || "No data yet"}</pre>
      </div>

      <div class="card" style="margin-top:10px;">
        <h2>Head-to-Head</h2>
        <pre style="white-space:pre-wrap; font-size:13px;">${h2h || "No data yet"}</pre>
      </div>

      <div class="card" style="margin-top:10px;">
        <h2>Payment Tracker</h2>
        <pre style="white-space:pre-wrap; font-size:13px;">${payments || "No data yet"}</pre>
      </div>
    `;
  }

  async function loadPitStop() {
    const root = document.getElementById("pitstop-root");
    if (!root) return;

    root.innerHTML = "<div class='card'>Loading…</div>";

    if (!window.btccDb) {
      render(root, {});
      return;
    }

    try {
      const snap = await window.btccDb.collection("pitstop").doc("tracker").get();
      const roundsSnap = await window.btccDb.collection("pitstop_rounds").get();

      if (!snap.exists) {
        render(root, {});
        return;
      }

      const rounds = roundsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() || {}),
      }));

      render(root, snap.data() || {}, rounds);
    } catch (err) {
      console.error(err);
      root.innerHTML = "<div class='card'>Failed to load Pit Stop Pot</div>";
    }
  }

  window.loadPitStop = loadPitStop;
})();