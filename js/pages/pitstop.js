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

  function render(root, data) {
    const currentPot = Number(data.currentPot || 0).toFixed(2);
    const rollover = Number(data.jackpot || 0).toFixed(2);
    const lastWinner = escapeHtml(data.lastWinner || "—");
    const nextDraw = escapeHtml(data.nextDraw || "—");

    const payments = escapeHtml(data.paymentsTable || "");
    const events = escapeHtml(data.eventsTable || "");
    const h2h = escapeHtml(data.headToHeadTable || "");

    root.innerHTML = `
      <div class="card">
        <h1>Pit Stop Pot</h1>
        <p class="muted">Simple tracker (separate from Fantasy League scoring)</p>
      </div>

      <div class="card" style="margin-top:10px;">
        <h2>Summary</h2>
        <div class="tiny muted" style="line-height:1.7;">
          Current pot: <strong>£${currentPot}</strong><br>
          Last winner: <strong>${lastWinner}</strong><br>
          Next draw: <strong>${nextDraw}</strong><br>
          Current Rollover Amount: <strong>£${rollover}</strong>
        </div>
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
      if (!snap.exists) {
        render(root, {});
        return;
      }

      render(root, snap.data() || {});
    } catch (err) {
      console.error(err);
      root.innerHTML = "<div class='card'>Failed to load Pit Stop Pot</div>";
    }
  }

  window.loadPitStop = loadPitStop;
})();