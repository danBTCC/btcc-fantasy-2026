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

  function parseTableText(raw) {
    const text = String(raw || "").trim();
    if (!text) return [];

    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split("\t").map((cell) => cell.trim()));
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

  function buildEventBreakdownHtml(rawTable) {
    const rows = parseTableText(rawTable);

    const body = rows.length
      ? rows.map((cols) => {
          const eventLabel = escapeHtml(cols[0] || "Event");
          const selectedPlayers = escapeHtml(cols[1] || "—");
          const payouts = escapeHtml(cols[2] || "—");

          return `
            <tr>
              <td style="padding:6px; white-space:nowrap;">${eventLabel}</td>
              <td style="padding:6px;">${selectedPlayers}</td>
              <td style="padding:6px;">${payouts}</td>
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

  function buildHeadToHeadHtml(rawTable) {
    const rows = parseTableText(rawTable);

    const body = rows.length
      ? rows.map((cols) => {
          const race = escapeHtml(cols[0] || "Race");
          const matchup = escapeHtml(cols[1] || "—");
          const winner = escapeHtml(cols[2] || "—");
          const payout = escapeHtml(cols[3] || "£0.00");

          return `
            <tr>
              <td style="padding:6px; white-space:nowrap;">${race}</td>
              <td style="padding:6px;">${matchup}</td>
              <td style="padding:6px;">${winner}</td>
              <td style="padding:6px; text-align:right; white-space:nowrap;">${payout}</td>
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

  function buildPaymentTableHtml(rawTable) {
    const rows = parseTableText(rawTable);

    const headerCols = rows[0] || [];
    const bodyRows = rows.length > 1 ? rows.slice(1) : [];

    const defaultHeaders = ["Player", "R1", "R2", "R3", "R4", "R5", "R6", "Total"];
    const headers = headerCols.length ? headerCols : defaultHeaders;

    const body = bodyRows.length
      ? bodyRows.map((cols) => {
          const rendered = headers.map((_, idx) => {
            const value = escapeHtml(cols[idx] || "");
            const isFirst = idx === 0;
            const isLast = idx === headers.length - 1;
            const align = isFirst ? "left" : isLast ? "right" : "center";
            const nowrap = isFirst || isLast ? " white-space:nowrap;" : "";
            return `<td style="padding:6px; text-align:${align};${nowrap}">${value || "—"}</td>`;
          }).join("");

          return `<tr>${rendered}</tr>`;
        }).join("")
      : `
          <tr>
            <td style="padding:6px;">No payment data yet.</td>
            <td colspan="${Math.max(headers.length - 1, 1)}" style="padding:6px;"></td>
          </tr>
        `;

    return `
      <div class="card" style="margin-top:10px;">
        <h2 style="margin-top:0;">Payment Tracker</h2>
        <div class="note" style="overflow-x:auto; margin-top:10px;">
          <table class="table" style="width:100%; min-width:1060px; border-collapse:collapse; font-size:14px;">
            <thead>
              <tr>
                ${headers.map((header, idx) => {
                  const align = idx === 0 ? "left" : idx === headers.length - 1 ? "right" : "center";
                  return `<th style="text-align:${align}; padding:6px;">${escapeHtml(header)}</th>`;
                }).join("")}
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
      const eventBreakdownHtml = buildEventBreakdownHtml(data.eventsTable || "");
      const headToHeadHtml = buildHeadToHeadHtml(data.headToHeadTable || "");
      const tableHtml = buildPaymentTableHtml(data.paymentsTable || "");

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