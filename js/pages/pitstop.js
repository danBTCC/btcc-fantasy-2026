// js/pages/pitstop.js
// Simple Pit Stop Pot display (matches admin inputs exactly)

(function () {
  function waitForPitStopAuthReady() {
    if (typeof firebase === "undefined" || typeof firebase.auth !== "function") {
      return Promise.resolve();
    }

    const auth = firebase.auth();
    if (auth.currentUser) return Promise.resolve();

    return new Promise((resolve) => {
      let unsubscribe = null;
      const finish = () => {
        if (typeof unsubscribe === "function") unsubscribe();
        resolve();
      };

      unsubscribe = auth.onAuthStateChanged(finish, finish);
    });
  }

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

  function isRound10Special(roundNo) {
    return Number(roundNo || 0) === 10;
  }

  function getRound10PrizeTable() {
    return [
      10.00,
      5.00,
      4.00,
      3.50,
      3.00,
      2.80,
      2.60,
      2.40,
      2.20,
      2.00,
      1.80,
      1.70,
      1.60,
      1.50,
      1.40,
      1.30,
      1.20,
      1.10,
      0.90,
    ];
  }

  function getRoundPaidOut(round) {
    if (round.type === "special_round_10") {
      return (round.specialPayouts || []).reduce((sum, payout) => {
        return sum + Number(payout.amount || 0);
      }, 0);
    }

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
    const sortedRounds = rounds
      .slice()
      .sort((a, b) => Number(a.roundNo || 0) - Number(b.roundNo || 0));

    let rollover = 0;
    let lastCompletedRound = null;

    sortedRounds.forEach((round) => {
      const roundNo = Number(round.roundNo || 0);
      if (!isNormalRound(roundNo) && !isRound10Special(roundNo)) return;

      lastCompletedRound = round;

      if (isRound10Special(roundNo)) {
        rollover = 0;
        return;
      }

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
      const specialRound10 = isRound10Special(round.roundNo);
      const startingPot = normal || specialRound10 ? entryPot + rolloverBefore : Number(round.potValue || 0);
      const paidOut = getRoundPaidOut(round);
      let rolloverAfter = rolloverBefore;

      if (specialRound10) {
        rolloverAfter = 0;
      } else if (normal) {
        if (round.drawnPlayerWon === true) {
          rolloverAfter = 0;
        } else {
          rolloverAfter = rolloverBefore + Number(round.rolloverAdded ?? 4.5);
        }
      }

      const calculated = {
        ...round,
        normal,
        specialRound10,
        entryPot,
        rolloverBefore,
        startingPot,
        paidOut,
        rolloverAfter,
      };

      if (normal || specialRound10) {
        rolloverBefore = rolloverAfter;
      }

      return calculated;
    });
  }

  function getRoundDocId(roundNo) {
    const n = Number(roundNo || 0);
    return `round_${String(n).padStart(2, "0")}`;
  }

  function getPitStopRoundContext(roundNo) {
    const n = Number(roundNo || 0);
    return {
      roundNo: n,
      eventNo: Math.ceil(n / 3),
      raceNo: ((n - 1) % 3) + 1,
      raceField: `race${((n - 1) % 3) + 1}`,
      checkpoint: [10, 20, 30].includes(n),
    };
  }

  function getRolloverBeforeRound(rounds, targetRoundNo) {
    const previousRounds = rounds
      .filter((round) => Number(round.roundNo || 0) < Number(targetRoundNo || 0))
      .slice()
      .sort((a, b) => Number(a.roundNo || 0) - Number(b.roundNo || 0));

    let rollover = 0;

    previousRounds.forEach((round) => {
      const isSharedPayout =
        round.type === "special_round_10" ||
        round.type === "special_shared_payout";

      if (isSharedPayout || round.drawnPlayerWon === true) {
        rollover = 0;
        return;
      }

      rollover += Number(round.rolloverAdded ?? 4.5);
    });

    return rollover;
  }

  function rankPitStopPlayers(rows) {
    const sorted = rows
      .slice()
      .sort((a, b) => {
        const pointsDiff = Number(b.points || 0) - Number(a.points || 0);
        if (pointsDiff !== 0) return pointsDiff;
        return String(a.displayName || "").localeCompare(String(b.displayName || ""));
      });

    let previousPoints = null;
    let previousPosition = 0;

    return sorted.map((row, index) => {
      const points = Number(row.points || 0);
      const position = previousPoints !== null && points === previousPoints
        ? previousPosition
        : index + 1;

      previousPoints = points;
      previousPosition = position;

      return { ...row, points, position };
    });
  }

  function ordinal(position) {
    const n = Number(position || 0);
    if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
    if (n % 10 === 1) return `${n}st`;
    if (n % 10 === 2) return `${n}nd`;
    if (n % 10 === 3) return `${n}rd`;
    return `${n}th`;
  }

  function renderPayoutBreakdown(round) {
    if (round.type === "special_round_10") {
      const payouts = (round.specialPayouts || [])
        .slice()
        .sort((a, b) => Number(a.position || 0) - Number(b.position || 0));

      if (!payouts.length) return "-";

      return payouts
        .map((payout) => {
          return `<div><strong>${Number(payout.position || 0)}:</strong> ${escapeHtml(payout.player || "-")} — ${fmtMoney(payout.amount)}</div>`;
        })
        .join("");
    }

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

    if (round.type === "special_round_10") {
      (round.specialPayouts || []).forEach((payout) => {
        addSplitPrize(`${Number(payout.position || 0)}${Number(payout.position || 0) === 1 ? "st" : Number(payout.position || 0) === 2 ? "nd" : Number(payout.position || 0) === 3 ? "rd" : "th"}`, payout.player, payout.amount);
      });
      return entries;
    }

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

  function buildEventRolloverSummary(calculatedRounds) {
    const events = new Map();

    calculatedRounds.forEach((round) => {
      const roundNo = Number(round.roundNo || 0);
      if (!roundNo) return;

      const eventNo = Math.ceil(roundNo / 3);
      const existing = events.get(eventNo) || {
        eventNo,
        rounds: [],
        rolloverAdded: 0,
        rolloverAfterEvent: 0,
        hasSpecialReset: false,
      };

      existing.rounds.push(roundNo);

      if (round.specialRound10) {
        existing.hasSpecialReset = true;
      } else if (round.normal && round.drawnPlayerWon !== true) {
        existing.rolloverAdded += Number(round.rolloverAdded ?? 4.5);
      }

      existing.rolloverAfterEvent = Number(round.rolloverAfter || 0);
      events.set(eventNo, existing);
    });

    return Array.from(events.values()).sort((a, b) => a.eventNo - b.eventNo);
  }

  function render(root, data, rounds = []) {
    const pitstopInputStyle = "width:100%; box-sizing:border-box; padding:10px 12px; border-radius:10px; border:1px solid rgba(255,255,255,.16); background:rgba(15,23,42,.88); color:#f8fafc; outline:none;";


    const pitstopTotals = calculatePitStopTotals(data, rounds);
    const calculatedRounds = buildRoundCalculations(data, rounds);
    const eventRolloverSummary = buildEventRolloverSummary(calculatedRounds);

    const roundRows = calculatedRounds.length
      ? calculatedRounds
          .map((r) => {
            const roundNo = Number(r.roundNo || 0);
            const eventDivider = roundNo > 0 && roundNo % 3 === 0
              ? `
                <tr>
                  <td colspan="6" class="tiny muted" style="padding:8px 6px; text-align:center; border-top:1px solid rgba(255,255,255,.12); border-bottom:1px solid rgba(255,255,255,.08);">
                    End of Event ${Math.ceil(roundNo / 3)}
                  </td>
                </tr>
              `
              : "";

            return `
              <tr>
                <td>${r.roundNo || "-"}${r.normal ? "" : " *"}</td>
                <td>${r.specialRound10 ? "Round 10 Shared" : escapeHtml(r.drawnPlayer || "-")}</td>
                <td>${fmtMoney(r.startingPot)}</td>
                <td style="font-weight:900; color:#dbeafe;">${fmtMoney(r.rolloverAfter)}</td>
                <td>${fmtMoney(r.paidOut)}</td>
                <td>${renderPayoutBreakdown(r)}</td>
              </tr>
              ${eventDivider}
            `;
          })
          .join("")
      : `
          <tr>
            <td colspan="6" class="muted">No rounds entered yet</td>
          </tr>
        `;

    const eventRolloverRows = eventRolloverSummary.length
      ? eventRolloverSummary
          .map((event) => {
            const roundLabel = event.rounds.length
              ? `Rounds ${Math.min(...event.rounds)}–${Math.max(...event.rounds)}`
              : "—";

            return `
              <tr>
                <td>${event.eventNo}</td>
                <td>${roundLabel}</td>
                <td style="text-align:right;">${fmtMoney(event.rolloverAdded)}</td>
                <td style="text-align:right; font-weight:800;">${fmtMoney(event.rolloverAfterEvent)}</td>
                <td>${event.hasSpecialReset ? "Round 10 reset" : "—"}</td>
              </tr>
            `;
          })
          .join("")
      : `
          <tr>
            <td colspan="5" class="muted">No event rollover data yet</td>
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


    const currentUser = firebase.auth().currentUser;
    const round10PrizeTable = getRound10PrizeTable();
    const round10PrizeTotal = round10PrizeTable.reduce((sum, value) => sum + value, 0);
    const round10FieldsHtml = round10PrizeTable
      .map((amount, index) => {
        const position = index + 1;
        return `
          <label class="tiny muted">${position}${position === 1 ? "st" : position === 2 ? "nd" : position === 3 ? "rd" : "th"} Place — ${fmtMoney(amount)}</label>
          <input class="pitstop-round10-player" data-position="${position}" data-amount="${amount}" type="text" placeholder="Player name" style="${pitstopInputStyle}" />
        `;
      })
      .join("");
    const isPitStopAdmin = currentUser?.email === "dmillward85@icloud.com";

    const adminFormHtml = isPitStopAdmin
      ? `
      <div class="card" style="margin-top:10px;">
        <h2>Pit Stop Admin</h2>
        <p class="tiny muted">Unlock this only when adding or correcting a Pit Stop Pot round.</p>

        <div id="pitstop-admin-unlock" style="display:grid; gap:8px;">
          <label class="tiny muted">Admin PIN</label>
          <input id="pitstop-admin-pin" type="password" inputmode="numeric" placeholder="Enter PIN" style="${pitstopInputStyle}" />
          <button id="pitstop-unlock-admin" class="tile" type="button">Unlock Round Entry</button>
          <div id="pitstop-unlock-msg" class="tiny muted">Locked.</div>
        </div>

        <div id="pitstop-admin-form" style="display:none; gap:8px; margin-top:10px;">
          <h2>Guided Round Preview</h2>
          <p class="tiny muted">Read-only test mode. This loads the stored fantasy result for one round and calculates the Pit Stop outcome without writing anything to Firebase.</p>

          <label class="tiny muted">Round Number</label>
          <input id="pitstop-wizard-round-no" type="number" min="1" max="30" placeholder="1" style="${pitstopInputStyle}" />
          <button id="pitstop-wizard-load" class="tile" type="button">Load Round Results</button>
          <div id="pitstop-wizard-msg" class="tiny muted">Choose a round to begin.</div>
          <div id="pitstop-wizard-preview" class="note" hidden></div>

          <hr style="border:0; border-top:1px solid rgba(255,255,255,.12); width:100%; margin:14px 0;" />
          <h2>Legacy Manual Round Entry</h2>
          <p class="tiny muted">Rounds 10, 20 and 30 are special draws and are blocked here for now.</p>

          <label class="tiny muted">Round Number</label>
          <input id="pitstop-round-no" type="number" min="1" max="30" placeholder="1" style="${pitstopInputStyle}" />

          <label class="tiny muted">Drawn Player</label>
          <input id="pitstop-drawn-player" type="text" placeholder="Jake" style="${pitstopInputStyle}" />

          <label class="tiny muted">Drawn player won full pot?</label>
          <select id="pitstop-full-pot-won" style="${pitstopInputStyle}">
            <option value="false">No — normal payout and rollover</option>
            <option value="true">Yes — drawn player wins full pot</option>
          </select>

          <label class="tiny muted">Full Pot Prize (only if full pot won)</label>
          <input id="pitstop-full-pot-prize" type="number" step="0.01" placeholder="0.00" style="${pitstopInputStyle}" />

          <label class="tiny muted">1st Place Player</label>
          <input id="pitstop-first-player" type="text" placeholder="Maddie" style="${pitstopInputStyle}" />

          <label class="tiny muted">1st Prize</label>
          <input id="pitstop-first-prize" type="number" step="0.01" value="1.70" style="${pitstopInputStyle}" />

          <label class="tiny muted">2nd Place Player</label>
          <input id="pitstop-second-player" type="text" placeholder="Ellie C" style="${pitstopInputStyle}" />

          <label class="tiny muted">2nd Prize</label>
          <input id="pitstop-second-prize" type="number" step="0.01" value="1.30" style="${pitstopInputStyle}" />

          <label class="tiny muted">3rd Place Player</label>
          <input id="pitstop-third-player" type="text" placeholder="Fliss" style="${pitstopInputStyle}" />

          <label class="tiny muted">3rd Prize</label>
          <input id="pitstop-third-prize" type="number" step="0.01" value="1.00" style="${pitstopInputStyle}" />

          <label class="tiny muted">Selected Player Prize</label>
          <input id="pitstop-selected-prize" type="number" step="0.01" value="1.00" style="${pitstopInputStyle}" />

          <label class="tiny muted">Rollover Added</label>
          <input id="pitstop-rollover-added" type="number" step="0.01" value="4.50" style="${pitstopInputStyle}" />

          <label class="tiny muted">Notes</label>
          <textarea id="pitstop-notes" rows="2" placeholder="Optional tie/payment note" style="${pitstopInputStyle}; min-height:70px;"></textarea>

          <button id="pitstop-save-round" class="tile" type="button">Save Pit Stop Round</button>
          <hr style="border:0; border-top:1px solid rgba(255,255,255,.12); width:100%; margin:14px 0;" />
          <h2>Round 10 Special Shared Draw</h2>
          <p class="tiny muted">Round 10 pays all 19 players from the accumulated rollover plus the Round 10 entry pot. Prize table total: ${fmtMoney(round10PrizeTotal)}.</p>
          <div id="pitstop-round10-fields" style="display:grid; gap:8px;">
            ${round10FieldsHtml}
          </div>
          <button id="pitstop-save-round10" class="tile" type="button">Save Round 10 Special Draw</button>
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
      <div class="card" style="margin-top:10px; background:linear-gradient(135deg, rgba(11,61,145,.95), rgba(37,99,235,.85)); border:1px solid rgba(147,197,253,.35); box-shadow:0 12px 30px rgba(0,0,0,.28);">
        <div class="tiny" style="text-transform:uppercase; letter-spacing:.08em; color:rgba(255,255,255,.75); font-weight:800;">Current Rollover</div>
        <div style="font-size:34px; line-height:1.05; font-weight:950; color:#fff; margin-top:4px;">${fmtMoney(pitstopTotals.calculatedRollover)}</div>
        <div class="tiny" style="color:rgba(255,255,255,.8); margin-top:6px; line-height:1.5;">
          Next normal-round pot: <strong style="color:#fff;">${fmtMoney(pitstopTotals.calculatedNextPot)}</strong><br>
          Entry pot: ${fmtMoney(pitstopTotals.entryPot)} • Round 10 shared payout included when entered • Rounds 20 and 30 held separately
        </div>
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
        <h2>Round History</h2>
        <table class="table tiny" style="width:100%;">
          <thead>
            <tr>
              <th>Round</th>
              <th>Drawn</th>
              <th>Pot</th>
              <th>Rollover</th>
              <th>Paid</th>
              <th>Payouts</th>
            </tr>
          </thead>
          <tbody>
            ${roundRows}
          </tbody>
        </table>
      </div>

      <div class="card" style="margin-top:10px;">
        <h2>Event Rollover Summary</h2>
        <table class="table tiny" style="width:100%;">
          <thead>
            <tr>
              <th>Event</th>
              <th>Rounds</th>
              <th style="text-align:right;">Added</th>
              <th style="text-align:right;">Rollover</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            ${eventRolloverRows}
          </tbody>
        </table>
      </div>

    ${adminFormHtml}

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

    const wizardLoadBtn = root.querySelector("#pitstop-wizard-load");
    wizardLoadBtn?.addEventListener("click", async () => {
      const msg = root.querySelector("#pitstop-wizard-msg");
      const preview = root.querySelector("#pitstop-wizard-preview");
      const setMsg = (text) => {
        if (msg) msg.textContent = text;
      };

      const roundNo = Number(root.querySelector("#pitstop-wizard-round-no")?.value || 0);
      if (!Number.isInteger(roundNo) || roundNo < 1 || roundNo > 30) {
        setMsg("Enter a complete round number from 1 to 30.");
        if (preview) preview.hidden = true;
        return;
      }

      const context = getPitStopRoundContext(roundNo);
      const recordedRoundNos = new Set(
        rounds.map((round) => Number(round.roundNo || 0)).filter(Boolean)
      );
      const missingPreviousRounds = [];

      for (let n = 1; n < roundNo; n += 1) {
        if (!recordedRoundNos.has(n)) missingPreviousRounds.push(n);
      }

      if (missingPreviousRounds.length) {
        setMsg(`Cannot calculate safely. Missing earlier round${missingPreviousRounds.length === 1 ? "" : "s"}: ${missingPreviousRounds.join(", ")}.`);
        if (preview) preview.hidden = true;
        return;
      }

      try {
        wizardLoadBtn.disabled = true;
        wizardLoadBtn.textContent = "Loading…";
        setMsg(`Loading Event ${context.eventNo}, Race ${context.raceNo}…`);
        if (preview) preview.hidden = true;

        const eventsSnap = await window.btccDb.collection("events").get();
        const eventDoc = eventsSnap.docs.find((doc) => {
          const event = doc.data() || {};
          return Number(event.eventNo || 0) === context.eventNo;
        });

        if (!eventDoc) {
          throw new Error(`Event ${context.eventNo} was not found.`);
        }

        const scoresSnap = await window.btccDb
          .collection("event_scores")
          .doc(eventDoc.id)
          .collection("players")
          .get();

        if (scoresSnap.empty) {
          throw new Error(`No player event scores exist for ${eventDoc.id}. The event engine must run before the Pit Stop result can be calculated.`);
        }

        const ranking = rankPitStopPlayers(
          scoresSnap.docs.map((doc) => {
            const score = doc.data() || {};
            return {
              uid: doc.id,
              displayName: score.displayName || doc.id,
              points: Number(score.breakdown?.[context.raceField] || 0),
            };
          })
        );

        if (ranking.length !== pitstopTotals.totalPlayers) {
          throw new Error(`Expected ${pitstopTotals.totalPlayers} player scores but found ${ranking.length}. Preview blocked so an incomplete result cannot be used.`);
        }

        const rolloverBefore = getRolloverBeforeRound(rounds, roundNo);
        const startingPot = pitstopTotals.entryPot + rolloverBefore;
        const sharedCheckpoint = context.checkpoint && rolloverBefore > 0;
        const existingRound = rounds.find((round) => Number(round.roundNo || 0) === roundNo);

        const rankingRows = ranking
          .map((row) => {
            return `
              <tr>
                <td>${ordinal(row.position)}</td>
                <td>${escapeHtml(row.displayName)}</td>
                <td style="text-align:right;">${Number(row.points || 0)}</td>
              </tr>
            `;
          })
          .join("");

        const existingNote = existingRound
          ? `<div class="tiny" style="color:#facc15; margin-top:8px;">Round ${roundNo} already has a saved Pit Stop record. This preview will not alter it.</div>`
          : "";

        const summaryHtml = `
          <div style="display:grid; gap:4px;">
            <div><strong>Round:</strong> ${roundNo}</div>
            <div><strong>Fantasy result:</strong> Event ${context.eventNo}, Race ${context.raceNo}</div>
            <div><strong>Player scores:</strong> ${ranking.length}</div>
            <div><strong>Entry pot:</strong> ${fmtMoney(pitstopTotals.entryPot)}</div>
            <div><strong>Rollover before round:</strong> ${fmtMoney(rolloverBefore)}</div>
            <div><strong>Available pot:</strong> ${fmtMoney(startingPot)}</div>
          </div>
          ${existingNote}
        `;

        if (sharedCheckpoint) {
          preview.innerHTML = `
            ${summaryHtml}
            <div style="margin-top:12px; padding:10px; border-radius:10px; background:rgba(37,99,235,.16);">
              <strong>Shared checkpoint payout required</strong><br>
              <span class="tiny">All 19 players must receive a prize totalling exactly ${fmtMoney(startingPot)}. The rollover resets to £0 after this payout.</span>
            </div>
            <details style="margin-top:10px;">
              <summary style="cursor:pointer; font-weight:800;">View Round ${roundNo} finishing order</summary>
              <table class="table tiny" style="width:100%; margin-top:8px;">
                <thead>
                  <tr><th>Pos</th><th>Player</th><th style="text-align:right;">Points</th></tr>
                </thead>
                <tbody>${rankingRows}</tbody>
              </table>
            </details>
          `;
          preview.hidden = false;
          setMsg(`Round ${roundNo} is a shared payout round. Read-only preview complete.`);
          return;
        }

        const playerOptions = ranking
          .slice()
          .sort((a, b) => String(a.displayName || "").localeCompare(String(b.displayName || "")))
          .map((row) => {
            const selected = existingRound?.drawnPlayer === row.displayName ? " selected" : "";
            return `<option value="${escapeHtml(row.uid)}"${selected}>${escapeHtml(row.displayName)}</option>`;
          })
          .join("");

        preview.innerHTML = `
          ${summaryHtml}
          <div style="display:grid; gap:8px; margin-top:12px;">
            <label class="tiny muted">Who was the selected player?</label>
            <select id="pitstop-wizard-selected-player" style="${pitstopInputStyle}">
              <option value="">Select player…</option>
              ${playerOptions}
            </select>
            <button id="pitstop-wizard-calculate" class="tile" type="button">Calculate Pit Stop Outcome</button>
            <div id="pitstop-wizard-outcome" class="tiny muted">Select the externally drawn player.</div>
          </div>
          <details style="margin-top:10px;">
            <summary style="cursor:pointer; font-weight:800;">View Round ${roundNo} finishing order</summary>
            <table class="table tiny" style="width:100%; margin-top:8px;">
              <thead>
                <tr><th>Pos</th><th>Player</th><th style="text-align:right;">Points</th></tr>
              </thead>
              <tbody>${rankingRows}</tbody>
            </table>
          </details>
        `;
        preview.hidden = false;

        const calculateBtn = preview.querySelector("#pitstop-wizard-calculate");
        calculateBtn?.addEventListener("click", () => {
          const selectedUid = preview.querySelector("#pitstop-wizard-selected-player")?.value || "";
          const outcome = preview.querySelector("#pitstop-wizard-outcome");
          const selectedPlayer = ranking.find((row) => row.uid === selectedUid);

          if (!selectedPlayer) {
            if (outcome) outcome.textContent = "Select the externally drawn player first.";
            return;
          }

          const highestPoints = Number(ranking[0]?.points || 0);
          const jackpotWon = Number(selectedPlayer.points || 0) === highestPoints;

          if (jackpotWon) {
            outcome.innerHTML = `
              <div style="padding:10px; border-radius:10px; background:rgba(34,197,94,.14); color:#dcfce7;">
                <strong>Jackpot won by ${escapeHtml(selectedPlayer.displayName)}</strong><br>
                Finishing position: ${ordinal(selectedPlayer.position)}${selectedPlayer.position === 1 && ranking.filter((row) => row.position === 1).length > 1 ? " (tied)" : ""}<br>
                Jackpot payout: ${fmtMoney(startingPot)}<br>
                All other payouts: ${fmtMoney(0)}<br>
                Rollover after round: ${fmtMoney(0)}
              </div>
            `;
            return;
          }

          const prizeRows = ranking.filter((row) => row.position <= 3);
          const prizePositionCounts = new Map();
          prizeRows.forEach((row) => {
            prizePositionCounts.set(row.position, Number(prizePositionCounts.get(row.position) || 0) + 1);
          });
          const splitRequired = Array.from(prizePositionCounts.values()).some((count) => count > 1);
          const rolloverAfter = rolloverBefore + 4.5;
          const nextRoundPot = pitstopTotals.entryPot + rolloverAfter;

          const prizeSummary = splitRequired
            ? `
                <div style="color:#fde68a;">
                  <strong>Manual split required:</strong> tied positions affect the £4.00 finishing-prize pool.
                  The wizard has detected the tie and will require your allocation in the saving phase.
                </div>
              `
            : `
                <div>1st: ${escapeHtml(ranking.find((row) => row.position === 1)?.displayName || "—")} — ${fmtMoney(1.7)}</div>
                <div>2nd: ${escapeHtml(ranking.find((row) => row.position === 2)?.displayName || "—")} — ${fmtMoney(1.3)}</div>
                <div>3rd: ${escapeHtml(ranking.find((row) => row.position === 3)?.displayName || "—")} — ${fmtMoney(1)}</div>
              `;

          outcome.innerHTML = `
            <div style="padding:10px; border-radius:10px; background:rgba(37,99,235,.14); color:#dbeafe;">
              <strong>Normal payout — jackpot not won</strong><br>
              ${escapeHtml(selectedPlayer.displayName)} finished ${ordinal(selectedPlayer.position)} and receives the ${fmtMoney(1)} selected-player prize.
              <div style="margin-top:8px;">${prizeSummary}</div>
              <div style="margin-top:8px;">
                Position-prize pool: ${fmtMoney(4)}<br>
                Rollover added: ${fmtMoney(4.5)}<br>
                Rollover after round: ${fmtMoney(rolloverAfter)}<br>
                Next normal-round pot: ${fmtMoney(nextRoundPot)}
              </div>
            </div>
          `;
        });

        setMsg(`Round ${roundNo} results loaded. Choose the selected player to complete the preview.`);
      } catch (err) {
        console.error("❌ Pit Stop guided preview failed:", err);
        setMsg(err?.message || "Failed to load the guided preview.");
        if (preview) preview.hidden = true;
      } finally {
        wizardLoadBtn.disabled = false;
        wizardLoadBtn.textContent = "Load Round Results";
      }
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

    const saveRound10Btn = root.querySelector("#pitstop-save-round10");
    saveRound10Btn?.addEventListener("click", async () => {
      const msg = root.querySelector("#pitstop-admin-msg");
      const setMsg = (text) => {
        if (msg) msg.textContent = text;
      };

      const payoutInputs = Array.from(root.querySelectorAll(".pitstop-round10-player"));
      const specialPayouts = payoutInputs.map((input) => ({
        position: Number(input.getAttribute("data-position") || 0),
        player: String(input.value || "").trim(),
        amount: Number(input.getAttribute("data-amount") || 0),
      }));

      const missing = specialPayouts.filter((payout) => !payout.player);
      if (missing.length) {
        setMsg(`Enter all 19 Round 10 players before saving. Missing: ${missing.map((p) => p.position).join(", ")}`);
        return;
      }

      const total = specialPayouts.reduce((sum, payout) => sum + Number(payout.amount || 0), 0);
      if (Math.round(total * 100) !== 5000) {
        setMsg(`Round 10 prize total must be £50.00. Current total: ${fmtMoney(total)}.`);
        return;
      }

      const confirmed = window.confirm(`Save Round 10 special shared draw?\n\nThis will write to pitstop_rounds/round_10 and reset the calculated rollover after Round 10.`);
      if (!confirmed) return;

      try {
        saveRound10Btn.disabled = true;
        saveRound10Btn.textContent = "Saving…";
        setMsg("Saving Round 10 special draw…");

        await window.btccDb.collection("pitstop_rounds").doc("round_10").set({
          roundNo: 10,
          type: "special_round_10",
          drawnPlayer: "Round 10 Shared Draw",
          drawnPlayerWon: false,
          potValue: 50,
          specialPayouts,
          rolloverAdded: 0,
          notes: "Round 10 shared payout: 9 rollover rounds plus Round 10 entry pot.",
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        setMsg("Round 10 saved. Refreshing…");
        await loadPitStop();
      } catch (err) {
        console.error("❌ Failed to save Round 10 special draw:", err);
        setMsg(err?.message || "Failed to save Round 10 special draw.");
        saveRound10Btn.disabled = false;
        saveRound10Btn.textContent = "Save Round 10 Special Draw";
      }
    });
  }

  async function loadPitStop() {
    const root = document.getElementById("pitstop-root");
    if (!root) return;

    root.innerHTML = "<div class='card'>Loading…</div>";

    await waitForPitStopAuthReady();

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
