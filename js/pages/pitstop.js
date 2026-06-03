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

  function buildRoundCalculations(data, rounds) {
    const totalPlayers = Number(data.totalPlayers || 19);
    const entryPot = totalPlayers * 0.5;
    const sortedRounds = rounds
      .slice()
      .sort((a, b) => Number(a.roundNo || 0) - Number(b.roundNo || 0));

    let rolloverBefore = 0;

    return sortedRounds.map((round) => {
      const normal = isNormalRound(round.roundNo);
      const startingPot = normal ? entryPot + rolloverBefore : Number(round.potValue || 0);
      const paidOut = getRoundPaidOut(round);
      let rolloverAfter = rolloverBefore;

      if (normal) {
        if (round.drawnPlayerWon === true) {
          rolloverAfter = 0;
        } else {
          rolloverAfter = rolloverBefore + Number(round.rolloverAdded ?? 4.5);
        }
      }

      const calculated = {
        ...round,
        normal,
        entryPot,
        rolloverBefore,
        startingPot,
        paidOut,
        rolloverAfter,
      };

      if (normal) {
        rolloverBefore = rolloverAfter;
      }

      return calculated;
    });
  }

  function getRoundDocId(roundNo) {
    const n = Number(roundNo || 0);
    return `round_${String(n).padStart(2, "0")}`;
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

  function splitPayoutNames(playerText) {
    return String(playerText || "")
      .split("/")
      .map((name) => name.trim())
      .filter(Boolean);
  }

  function getRoundPayoutEntries(round) {
    const entries = [];

    const addSplitPrize = (label, playerText, amount) => {
      const names = splitPayoutNames(playerText);
      const totalAmount = Number(amount || 0);
      if (!names.length || totalAmount <= 0) return;
      const eachAmount = totalAmount / names.length;
      names.forEach((name) => {
        entries.push({
          roundNo: Number(round.roundNo || 0),
          label,
          player: name,
          amount: eachAmount,
        });
      });
    };

    if (round.drawnPlayerWon === true) {
      addSplitPrize("Full Pot", round.drawnPlayer, round.fullPotPrize || round.potValue);
      return entries;
    }

    addSplitPrize("Selected", round.drawnPlayer, round.selectedPlayerPrize);
    addSplitPrize("1st", round.firstPlaceText, round.firstPrize);
    addSplitPrize("2nd", round.secondPlaceText, round.secondPrize);
    addSplitPrize("3rd", round.thirdPlaceText, round.thirdPrize);

    return entries;
  }

  function buildRollingPrizeLedger(rounds) {
    const runningTotals = new Map();
    const sortedRounds = rounds
      .slice()
      .sort((a, b) => Number(a.roundNo || 0) - Number(b.roundNo || 0));

    const ledger = [];

    sortedRounds.forEach((round) => {
      getRoundPayoutEntries(round).forEach((entry) => {
        const previousTotal = Number(runningTotals.get(entry.player) || 0);
        const newTotal = previousTotal + Number(entry.amount || 0);
        runningTotals.set(entry.player, newTotal);
        ledger.push({
          ...entry,
          runningTotal: newTotal,
        });
      });
    });

    return ledger;
  }

  function buildPlayerWinnings(rounds) {
    const totals = new Map();

    rounds.forEach((round) => {
      getRoundPayoutEntries(round).forEach((entry) => {
        totals.set(entry.player, Number(totals.get(entry.player) || 0) + Number(entry.amount || 0));
      });
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
    const calculatedRounds = buildRoundCalculations(data, rounds);

    const roundRows = calculatedRounds.length
      ? calculatedRounds
          .map((r) => {
            return `
              <tr>
                <td>${r.roundNo || "-"}${r.normal ? "" : " *"}</td>
                <td>${escapeHtml(r.drawnPlayer || "-")}</td>
                <td>${fmtMoney(r.startingPot)}</td>
                <td>${renderPayoutBreakdown(r)}</td>
                <td>${fmtMoney(r.paidOut)}</td>
                <td>${fmtMoney(r.rolloverAfter)}</td>
              </tr>
            `;
          })
          .join("")
      : `
          <tr>
            <td colspan="6" class="muted">No rounds entered yet</td>
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

    const rollingPrizeLedger = buildRollingPrizeLedger(rounds);

    const rollingPrizeRows = rollingPrizeLedger.length
      ? rollingPrizeLedger
          .map((row) => {
            return `
              <tr>
                <td>${row.roundNo || "-"}</td>
                <td>${escapeHtml(row.player)}</td>
                <td>${escapeHtml(row.label)}</td>
                <td style="text-align:right;">${fmtMoney(row.amount)}</td>
                <td style="text-align:right; font-weight:800;">${fmtMoney(row.runningTotal)}</td>
              </tr>
            `;
          })
          .join("")
      : `
          <tr>
            <td colspan="5" class="muted">No prize ledger yet</td>
          </tr>
        `;

    const currentUser = firebase.auth().currentUser;
    const isPitStopAdmin = currentUser?.email === "dmillward85@icloud.com";

    const adminFormHtml = isPitStopAdmin
      ? `
      <div class="card" style="margin-top:10px;">
        <h2>Pit Stop Admin</h2>
        <p class="tiny muted">Unlock this only when adding or correcting a Pit Stop Pot round.</p>

        <div id="pitstop-admin-unlock" style="display:grid; gap:8px;">
          <label class="tiny muted">Admin PIN</label>
          <input id="pitstop-admin-pin" type="password" inputmode="numeric" placeholder="Enter PIN" />
          <button id="pitstop-unlock-admin" class="tile" type="button">Unlock Round Entry</button>
          <div id="pitstop-unlock-msg" class="tiny muted">Locked.</div>
        </div>

        <div id="pitstop-admin-form" style="display:none; gap:8px; margin-top:10px;">
          <h2>Add / Update Normal Round</h2>
          <p class="tiny muted">Rounds 10, 20 and 30 are special draws and are blocked here for now.</p>

          <label class="tiny muted">Round Number</label>
          <input id="pitstop-round-no" type="number" min="1" max="30" placeholder="1" />

          <label class="tiny muted">Drawn Player</label>
          <input id="pitstop-drawn-player" type="text" placeholder="Jake" />

          <label class="tiny muted">Drawn player won full pot?</label>
          <select id="pitstop-full-pot-won">
            <option value="false">No — normal payout and rollover</option>
            <option value="true">Yes — drawn player wins full pot</option>
          </select>

          <label class="tiny muted">Full Pot Prize (only if full pot won)</label>
          <input id="pitstop-full-pot-prize" type="number" step="0.01" placeholder="0.00" />

          <label class="tiny muted">1st Place Player</label>
          <input id="pitstop-first-player" type="text" placeholder="Maddie" />

          <label class="tiny muted">1st Prize</label>
          <input id="pitstop-first-prize" type="number" step="0.01" value="1.70" />

          <label class="tiny muted">2nd Place Player</label>
          <input id="pitstop-second-player" type="text" placeholder="Ellie C" />

          <label class="tiny muted">2nd Prize</label>
          <input id="pitstop-second-prize" type="number" step="0.01" value="1.30" />

          <label class="tiny muted">3rd Place Player</label>
          <input id="pitstop-third-player" type="text" placeholder="Fliss" />

          <label class="tiny muted">3rd Prize</label>
          <input id="pitstop-third-prize" type="number" step="0.01" value="1.00" />

          <label class="tiny muted">Selected Player Prize</label>
          <input id="pitstop-selected-prize" type="number" step="0.01" value="1.00" />

          <label class="tiny muted">Rollover Added</label>
          <input id="pitstop-rollover-added" type="number" step="0.01" value="4.50" />

          <label class="tiny muted">Notes</label>
          <textarea id="pitstop-notes" rows="2" placeholder="Optional tie/payment note"></textarea>

          <button id="pitstop-save-round" class="tile" type="button">Save Pit Stop Round</button>
          <button id="pitstop-lock-admin" class="tile" type="button" style="background:rgba(255,255,255,.06);">Lock Round Entry</button>
          <div id="pitstop-admin-msg" class="tiny muted">Ready.</div>
        </div>
      </div>
      `
      : "";

    root.innerHTML = `
      <div class="card">
        <h1>Pit Stop Pot</h1>
        <p class="muted"> All draws are screen recorded and shared in the WhatsApp group </p>
      </div>
      ${adminFormHtml}

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
              <th>Pot</th>
              <th>Payouts</th>
              <th>Paid</th>
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
        <h2>Rolling Prize Ledger</h2>
        <table class="table tiny" style="width:100%;">
          <thead>
            <tr>
              <th>Round</th>
              <th>Player</th>
              <th>Prize</th>
              <th style="text-align:right;">Won</th>
              <th style="text-align:right;">Running Total</th>
            </tr>
          </thead>
          <tbody>
            ${rollingPrizeRows}
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

    const unlockBtn = root.querySelector("#pitstop-unlock-admin");
    const lockBtn = root.querySelector("#pitstop-lock-admin");
    const unlockPanel = root.querySelector("#pitstop-admin-unlock");
    const adminForm = root.querySelector("#pitstop-admin-form");
    const unlockMsg = root.querySelector("#pitstop-unlock-msg");

    unlockBtn?.addEventListener("click", () => {
      const pin = String(root.querySelector("#pitstop-admin-pin")?.value || "").trim();
      if (pin !== "2026") {
        if (unlockMsg) unlockMsg.textContent = "Incorrect PIN.";
        return;
      }

      if (unlockPanel) unlockPanel.style.display = "none";
      if (adminForm) adminForm.style.display = "grid";
    });

    lockBtn?.addEventListener("click", () => {
      if (adminForm) adminForm.style.display = "none";
      if (unlockPanel) unlockPanel.style.display = "grid";
      const pinInput = root.querySelector("#pitstop-admin-pin");
      if (pinInput) pinInput.value = "";
      if (unlockMsg) unlockMsg.textContent = "Locked.";
    });

    const saveRoundBtn = root.querySelector("#pitstop-save-round");
    saveRoundBtn?.addEventListener("click", async () => {
      const msg = root.querySelector("#pitstop-admin-msg");
      const setMsg = (text) => {
        if (msg) msg.textContent = text;
      };

      const roundNo = Number(root.querySelector("#pitstop-round-no")?.value || 0);
      if (!roundNo) {
        setMsg("Enter a round number.");
        return;
      }

      if (!isNormalRound(roundNo)) {
        setMsg("Rounds 10, 20 and 30 are special draws and are blocked here for now.");
        return;
      }

      const drawnPlayer = String(root.querySelector("#pitstop-drawn-player")?.value || "").trim();
      if (!drawnPlayer) {
        setMsg("Enter the drawn player.");
        return;
      }

      const drawnPlayerWon = root.querySelector("#pitstop-full-pot-won")?.value === "true";
      const docId = getRoundDocId(roundNo);

      const payload = {
        roundNo,
        drawnPlayer,
        drawnPlayerWon,
        fullPotPrize: Number(root.querySelector("#pitstop-full-pot-prize")?.value || 0),
        firstPlaceText: String(root.querySelector("#pitstop-first-player")?.value || "").trim(),
        firstPrize: Number(root.querySelector("#pitstop-first-prize")?.value || 0),
        secondPlaceText: String(root.querySelector("#pitstop-second-player")?.value || "").trim(),
        secondPrize: Number(root.querySelector("#pitstop-second-prize")?.value || 0),
        thirdPlaceText: String(root.querySelector("#pitstop-third-player")?.value || "").trim(),
        thirdPrize: Number(root.querySelector("#pitstop-third-prize")?.value || 0),
        selectedPlayerPrize: drawnPlayerWon ? 0 : Number(root.querySelector("#pitstop-selected-prize")?.value || 0),
        rolloverAdded: drawnPlayerWon ? 0 : Number(root.querySelector("#pitstop-rollover-added")?.value || 0),
        notes: String(root.querySelector("#pitstop-notes")?.value || "").trim(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      if (!drawnPlayerWon) {
        payload.fullPotPrize = 0;
      }

      const confirmed = window.confirm(`Save Pit Stop Pot round ${roundNo}?\n\nThis will write to pitstop_rounds/${docId}.`);
      if (!confirmed) return;

      try {
        saveRoundBtn.disabled = true;
        saveRoundBtn.textContent = "Saving…";
        setMsg("Saving round…");

        await window.btccDb.collection("pitstop_rounds").doc(docId).set(payload, { merge: true });

        setMsg("Round saved. Refreshing…");
        await loadPitStop();
      } catch (err) {
        console.error("❌ Failed to save Pit Stop round:", err);
        setMsg(err?.message || "Failed to save round.");
        saveRoundBtn.disabled = false;
        saveRoundBtn.textContent = "Save Pit Stop Round";
      }
    });
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