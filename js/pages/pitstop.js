// js/pages/pitstop.js
// Pit Stop Pot page (read-only for players, admin-editable later)
// Exposes: window.loadPitStop()

(function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderFallback(root) {
    root.innerHTML = `
      <div class="card">
        <h1 style="margin-bottom:8px;">Pit Stop Pot</h1>
        <p class="muted" style="margin:0;">Standalone side game tracker. This does not affect Fantasy League scoring, budgets, or standings.</p>
      </div>

      <div class="card" style="margin-top:10px;">
        <h2 style="margin-top:0;">Current Summary</h2>
        <div class="tiny muted" style="line-height:1.7;">
          Current pot: <strong style="color:var(--text);">£0.00</strong><br>
          Last winner: <strong style="color:var(--text);">—</strong><br>
          Next draw: <strong style="color:var(--text);">—</strong><br>
          Current Rollover Amount: <strong style="color:var(--text);">£0.00</strong>
        </div>
      </div>

      <div class="card" style="margin-top:10px;">
        <h2 style="margin-top:0;">Special Rollover Races</h2>
        <div class="tiny muted" style="line-height:1.7;">
          Race 10 – Jackpot<br>
          Race 20 – Jackpot<br>
          Race 30 – Jackpot
        </div>
      </div>

      <div class="card" style="margin-top:10px;">
        <h2 style="margin-top:0;">Event Breakdown</h2>
        <div class="note" style="overflow-x:auto; margin-top:10px;">
          <table class="table" style="width:100%; min-width:860px; border-collapse:collapse; font-size:14px;">
            <thead>
              <tr>
                <th style="text-align:left; padding:6px;">Event</th>
                <th style="text-align:left; padding:6px;">3 Selected Players</th>
                <th style="text-align:left; padding:6px;">Payouts</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding:6px;">No event breakdown data yet.</td>
                <td style="padding:6px;">—</td>
                <td style="padding:6px;">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" style="margin-top:10px;">
        <h2 style="margin-top:0;">Special Rollover Head-to-Head</h2>
        <div class="note" style="overflow-x:auto; margin-top:10px;">
          <table class="table" style="width:100%; min-width:760px; border-collapse:collapse; font-size:14px;">
            <thead>
              <tr>
                <th style="text-align:left; padding:6px;">Race</th>
                <th style="text-align:left; padding:6px;">Head-to-Head</th>
                <th style="text-align:left; padding:6px;">Winner</th>
                <th style="text-align:right; padding:6px;">Payout</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding:6px;">No head-to-head data yet.</td>
                <td style="padding:6px;">—</td>
                <td style="padding:6px;">—</td>
                <td style="padding:6px; text-align:right;">£0.00</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" style="margin-top:10px;">
        <h2 style="margin-top:0;">Payment Tracker</h2>
        <div class="note" style="overflow-x:auto; margin-top:10px;">
          <table class="table" style="width:100%; min-width:760px; border-collapse:collapse; font-size:14px;">
            <thead>
              <tr>
                <th style="text-align:left; padding:6px;">Player</th>
                <th style="text-align:center; padding:6px;">R1</th>
                <th style="text-align:center; padding:6px;">R2</th>
                <th style="text-align:center; padding:6px;">R3</th>
                <th style="text-align:center; padding:6px;">R4</th>
                <th style="text-align:center; padding:6px;">R5</th>
                <th style="text-align:center; padding:6px;">R6</th>
                <th style="text-align:right; padding:6px;">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding:6px;">No payment data yet.</td>
                <td colspan="7" style="padding:6px;"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function buildSummaryHtml(data) {
    const currentPot = Number(data.currentPot || 0).toFixed(2);
    const jackpot = Number(data.jackpot || 0).toFixed(2);
    const lastWinner = escapeHtml(data.lastWinner || "—");
    const nextDraw = escapeHtml(data.nextDraw || "—");

    return `
      <div class="card">
        <h1 style="margin-bottom:8px;">Pit Stop Pot</h1>
        <p class="muted" style="margin:0;">Standalone side game tracker. This does not affect Fantasy League scoring, budgets, or standings.</p>
      </div>

      <div class="card" style="margin-top:10px;">
        <h2 style="margin-top:0;">Current Summary</h2>
        <div class="tiny muted" style="line-height:1.7;">
          Current pot: <strong style="color:var(--text);">£${currentPot}</strong><br>
          Last winner: <strong style="color:var(--text);">${lastWinner}</strong><br>
          Next draw: <strong style="color:var(--text);">${nextDraw}</strong><br>
          Current Rollover Amount: <strong style="color:var(--text);">£${jackpot}</strong>
        </div>
      </div>

      <div class="card" style="margin-top:10px;">
        <h2 style="margin-top:0;">Special Rollover Races</h2>
        <div class="tiny muted" style="line-height:1.7;">
          Race 10 – Jackpot<br>
          Race 20 – Jackpot<br>
          Race 30 – Jackpot
        </div>
      </div>
    `;
  }

  function buildEventBreakdownHtml(events) {
    const rows = Array.isArray(events) ? events : [];

    const body = rows.length
      ? rows.map((event) => {
          const eventLabel = escapeHtml(event.eventLabel || event.event || "Event");
          const selectedPlayers = Array.isArray(event.selectedPlayers) ? event.selectedPlayers : [];
          const payouts = Array.isArray(event.payouts) ? event.payouts : [];

          const selectedText = selectedPlayers.length
            ? selectedPlayers.map((name) => escapeHtml(name)).join(", ")
            : "—";

          const payoutText = payouts.length
            ? payouts
                .map((item) => {
                  const name = escapeHtml(item.name || "Player");
                  const amount = Number(item.amount || 0).toFixed(2);
                  return `${name} (£${amount})`;
                })
                .join(", ")
            : "—";

          return `
            <tr>
              <td style="padding:6px; white-space:nowrap;">${eventLabel}</td>
              <td style="padding:6px;">${selectedText}</td>
              <td style="padding:6px;">${payoutText}</td>
            </tr>
          `;
        }).join("")
      : `
          <tr>
            <td style="padding:6px;">No event breakdown data yet.</td>
            <td style="padding:6px;">—</td>
            <td style="padding:6px;">—</td>
          </tr>
        `;

    return `
      <div class="card" style="margin-top:10px;">
        <h2 style="margin-top:0;">Event Breakdown</h2>
        <div class="note" style="overflow-x:auto; margin-top:10px;">
          <table class="table" style="width:100%; min-width:860px; border-collapse:collapse; font-size:14px;">
            <thead>
              <tr>
                <th style="text-align:left; padding:6px;">Event</th>
                <th style="text-align:left; padding:6px;">3 Selected Players</th>
                <th style="text-align:left; padding:6px;">Payouts</th>
              </tr>
            </thead>
            <tbody>
              ${body}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function buildHeadToHeadHtml(headToHead) {
    const rows = Array.isArray(headToHead) ? headToHead : [];

    const body = rows.length
      ? rows.map((item) => {
          const race = escapeHtml(item.race || item.eventLabel || "Race");
          const matchup = escapeHtml(item.matchup || "—");
          const winner = escapeHtml(item.winner || "—");
          const payout = Number(item.payout || 0).toFixed(2);

          return `
            <tr>
              <td style="padding:6px; white-space:nowrap;">${race}</td>
              <td style="padding:6px;">${matchup}</td>
              <td style="padding:6px;">${winner}</td>
              <td style="padding:6px; text-align:right; white-space:nowrap;">£${payout}</td>
            </tr>
          `;
        }).join("")
      : `
          <tr>
            <td style="padding:6px;">No head-to-head data yet.</td>
            <td style="padding:6px;">—</td>
            <td style="padding:6px;">—</td>
            <td style="padding:6px; text-align:right;">£0.00</td>
          </tr>
        `;

    return `
      <div class="card" style="margin-top:10px;">
        <h2 style="margin-top:0;">Special Rollover Head-to-Head</h2>
        <div class="note" style="overflow-x:auto; margin-top:10px;">
          <table class="table" style="width:100%; min-width:760px; border-collapse:collapse; font-size:14px;">
            <thead>
              <tr>
                <th style="text-align:left; padding:6px;">Race</th>
                <th style="text-align:left; padding:6px;">Head-to-Head</th>
                <th style="text-align:left; padding:6px;">Winner</th>
                <th style="text-align:right; padding:6px;">Payout</th>
              </tr>
            </thead>
            <tbody>
              ${body}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function buildPaymentTableHtml(players) {
    const raceHeaders = Array.from({ length: 10 }, (_, i) => `R${i + 1}`);

    const rows = Array.isArray(players) ? players : [];

    const body = rows.length
      ? rows.map((player) => {
          const name = escapeHtml(player.name || "Player");
          const payments = player.payments || {};
          const paidCount = raceHeaders.reduce((sum, race) => sum + (payments[race] ? 1 : 0), 0);
          const total = (paidCount * 4).toFixed(2);

          const cells = raceHeaders.map((race) => {
            const paid = !!payments[race];
            return `<td style="padding:6px; text-align:center;">${paid ? "✔" : "—"}</td>`;
          }).join("");

          return `
            <tr>
              <td style="padding:6px; white-space:nowrap;">${name}</td>
              ${cells}
              <td style="padding:6px; text-align:right; white-space:nowrap;">£${total}</td>
            </tr>
          `;
        }).join("")
      : `
          <tr>
            <td style="padding:6px;">No payment data yet.</td>
            <td colspan="11" style="padding:6px;"></td>
          </tr>
        `;

    return `
      <div class="card" style="margin-top:10px;">
        <h2 style="margin-top:0;">Payment Tracker</h2>
        <div class="note" style="overflow-x:auto; margin-top:10px;">
          <table class="table" style="width:100%; min-width:1060px; border-collapse:collapse; font-size:14px;">
            <thead>
              <tr>
                <th style="text-align:left; padding:6px;">Player</th>
                ${raceHeaders.map((race) => `<th style="text-align:center; padding:6px;">${race}</th>`).join("")}
                <th style="text-align:right; padding:6px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${body}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  async function loadPitStop() {
    const root = document.getElementById("pitstop-root");
    if (!root) return;

    renderFallback(root);

    if (!window.btccDb) return;

    try {
      const snap = await window.btccDb.collection("pitstop").doc("tracker").get();
      if (!snap.exists) return;

      const data = snap.data() || {};
      const summaryHtml = buildSummaryHtml(data);
      const eventBreakdownHtml = buildEventBreakdownHtml(data.events || []);
      const headToHeadHtml = buildHeadToHeadHtml(data.headToHead || []);
      const tableHtml = buildPaymentTableHtml(data.players || []);

      root.innerHTML = `${summaryHtml}${eventBreakdownHtml}${headToHeadHtml}${tableHtml}`;
    } catch (err) {
      console.error("❌ loadPitStop failed:", err);
      root.innerHTML = `
        <div class="card">
          <h1 style="margin-bottom:8px;">Pit Stop Pot</h1>
          <p class="muted" style="margin:0;">Failed to load Pit Stop Pot data.</p>
        </div>
      `;
    }
  }

  window.loadPitStop = loadPitStop;
})();