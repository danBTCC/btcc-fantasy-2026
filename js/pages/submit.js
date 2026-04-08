// js/pages/submit.js
// Exposes: window.loadSubmit()

(function () {
  const PPV_2026 = 930;
  function render(el, html) {
    el.innerHTML = html;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function roundMoney2(v) {
    return Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
  }

  async function handleLogin(e, root) {
    e.preventDefault();

    const email = root.querySelector("#submit-email")?.value?.trim();
    const pass = root.querySelector("#submit-pass")?.value;

    const msg = root.querySelector("#submit-msg");
    if (msg) msg.textContent = "";

    try {
      await firebase.auth().signInWithEmailAndPassword(email, pass);
    } catch (err) {
      console.error("❌ Player login failed:", err);
      if (msg) msg.textContent = err?.message || "Login failed";
    }
  }

  async function handleCreateAccount(e, root) {
    e.preventDefault();

    const email = root.querySelector("#submit-email")?.value?.trim();
    const pass = root.querySelector("#submit-pass")?.value;

    const msg = root.querySelector("#submit-msg");
    if (msg) msg.textContent = "";

    try {
      await firebase.auth().createUserWithEmailAndPassword(email, pass);
      if (msg) msg.textContent = "Account created. You are now signed in.";
    } catch (err) {
      console.error("❌ Create account failed:", err);
      if (msg) msg.textContent = err?.message || "Create account failed";
    }
  }

  async function handleForgotPassword(root) {
    const email = root.querySelector("#submit-email")?.value?.trim();

    const msg = root.querySelector("#submit-msg");
    if (msg) msg.textContent = "";

    if (!email) {
      if (msg) msg.textContent = "Enter your email first, then tap Forgot password.";
      return;
    }

    try {
      await firebase.auth().sendPasswordResetEmail(email);
      if (msg) msg.textContent = "Password reset email sent (check inbox/spam).";
    } catch (err) {
      console.error("❌ Password reset failed:", err);
      if (msg) msg.textContent = err?.message || "Password reset failed";
    }
  }

  async function handleLogout() {
    try {
      await firebase.auth().signOut();
    } catch (err) {
      console.error("❌ Logout failed:", err);
    }
  }

  async function loadPlayerProfile(root, uid) {
    const box = root.querySelector("#player-profile");
    if (!box) return;

    // Ensure Firestore is ready (window.btccDb is created in app boot)
    if (!window.btccDb) {
      box.textContent = "Waiting for database…";
      setTimeout(() => loadPlayerProfile(root, uid), 300);
      return;
    }

    box.textContent = "Loading profile…";

    try {
      const [snap, standingsSnap] = await Promise.all([
        window.btccDb.collection("players").doc(uid).get(),
        window.btccDb.collection("standings_players").doc("season_2026").collection("players").doc(uid).get(),
      ]);

      if (!snap.exists) {
        box.innerHTML = `
          <strong>No profile found.</strong><br>
          <span class="tiny muted">Ask admin to create players/${uid}.</span>
        `;
        return;
      }

      const d = snap.data() || {};
      const name = d.displayName ?? "Unnamed";
      const budget = typeof d.budget === "number" ? d.budget : 0;
      const penalties = typeof d.penalties === "number" ? d.penalties : 0;
      const budgetBoost = typeof d.budgetBoost === "number" ? d.budgetBoost : 0;
      const deductibles = typeof d.deductibles === "number" ? d.deductibles : 0;
      const availableBudget = typeof d.effectiveBudget === "number"
        ? d.effectiveBudget
        : (budget + budgetBoost - deductibles);
      const standingsData = standingsSnap.exists ? (standingsSnap.data() || {}) : {};
      const pointsTotal = typeof standingsData.pointsTotal === "number"
        ? standingsData.pointsTotal
        : (typeof standingsData.points === "number" ? standingsData.points : null);
      const driversSelected = typeof d.driversSelected === "number" ? d.driversSelected : null;
      let last = "—";
      if (d.lastSubmission && typeof d.lastSubmission.toDate === "function") {
        last = d.lastSubmission.toDate().toLocaleString("en-GB");
      } else if (d.lastSubmission && String(d.lastSubmission).trim()) {
        last = String(d.lastSubmission);
      }
      const active = d.active === false ? "No" : "Yes";

      box.innerHTML = `
        <div><strong>${name}</strong></div>
        <div class="tiny muted" style="margin-top:6px; line-height:1.55;">
          Active: ${active}<br>
          Last submission: ${last}<br>
          <br>
          Budget: £${budget.toFixed(2)}<br>
          Budget Boost: ${budgetBoost >= 0 ? "+" : ""}£${Math.abs(budgetBoost).toFixed(2)}<br>
          Deductibles: -£${Math.abs(deductibles).toFixed(2)}<br>
          Available Budget: £${availableBudget.toFixed(2)}<br>
          <br>
          Penalties: ${penalties}
          ${pointsTotal !== null ? `<br>Championship Points: ${pointsTotal}` : ""}
          ${driversSelected !== null ? `<br>Drivers Selected: ${driversSelected}` : ""}
        </div>
      `;
    } catch (err) {
      console.error("❌ loadPlayerProfile failed:", err);
      box.innerHTML = `
        <strong>Failed to load profile.</strong><br>
        <span class="tiny muted">${err?.message || err}</span>
      `;
    }
  }

  async function loadNextEventSummary(root) {
    const elName = root.querySelector("#submit-next-event");
    const elStatus = root.querySelector("#submit-submission-status");
    const elLockout = root.querySelector("#submit-lockout");
    const elLeft = root.querySelector("#submit-time-left");

    if (!elName || !elStatus || !elLockout || !elLeft) return;

    if (!window.btccDb) {
      elName.textContent = "Waiting for database…";
      setTimeout(() => loadNextEventSummary(root), 300);
      return;
    }

    const fmtDate = (v) => {
      if (v && typeof v.toDate === "function") return v.toDate();
      if (typeof v === "string" && v.length >= 10) {
        const d = new Date(v);
        if (!isNaN(d)) return d;
      }
      return null;
    };

    const fmtDateRange = (from, to) => {
      const f = from ? from.toLocaleDateString("en-GB") : "—";
      const t = to ? to.toLocaleDateString("en-GB") : "—";
      return f !== "—" && t !== "—" ? `${f}–${t}` : f !== "—" ? f : "—";
    };

    const fmtDateTime = (d) =>
      d
        ? d.toLocaleString("en-GB", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—";

    try {
      const snap = await window.btccDb.collection("events").orderBy("eventNo").get();

      if (snap.empty) {
        elName.textContent = "No events";
        elStatus.textContent = "—";
        elLockout.textContent = "—";
        return;
      }

      const now = new Date();

      const events = snap.docs.map((doc) => {
        const d = doc.data() || {};
        const from = fmtDate(d.dateFrom);
        const to = fmtDate(d.dateTo);
        return {
          id: doc.id,
          eventNo: d.eventNo ?? null,
          venue: d.venue ?? d.name ?? "Unnamed",
          roundFrom: d.roundFrom ?? null,
          roundTo: d.roundTo ?? null,
          from,
          to,
        };
      });

      const startOfDay = (d) => {
        const x = new Date(d);
        x.setHours(0, 0, 0, 0);
        return x;
      };

      const endOfDay = (d) => {
        const x = new Date(d);
        x.setHours(23, 59, 59, 999);
        return x;
      };

      const isInRange = (e) => e.from && e.to && now >= startOfDay(e.from) && now <= endOfDay(e.to);

      const future = events
        .filter((e) => e.from && startOfDay(e.from) >= startOfDay(now))
        .sort((a, b) => a.from - b.from);

      const chosen = events.find(isInRange) || future[0] || events[events.length - 1];

      const rounds = chosen.roundFrom && chosen.roundTo ? `R${chosen.roundFrom}–${chosen.roundTo}` : "";
      const dateRange = fmtDateRange(chosen.from, chosen.to);

      let lockout = chosen.from ? new Date(chosen.from) : null;
      if (lockout) lockout.setHours(15, 0, 0, 0);

      const open = lockout ? now < lockout : false;

      // Store current event context for submission flow (Phase G6)
      root.__eventContext = {
        eventId: chosen.id,
        eventNo: chosen.eventNo ?? null,
        venue: chosen.venue ?? null,
        lockout: lockout ? lockout.getTime() : null,
        open,
      };

      elName.textContent = `Event ${chosen.eventNo ?? "—"} — ${chosen.venue} (${rounds} • ${dateRange})`;
      elStatus.textContent = open ? "OPEN" : "LOCKED";
      elLockout.textContent = fmtDateTime(lockout);
      // ---- Countdown timer ----
function updateCountdown() {
  if (!lockout) {
    elLeft.textContent = "—";
    return;
  }

  const now2 = new Date();
  const ms = lockout - now2;

  if (ms <= 0) {
    elLeft.textContent = "Closed";
    elStatus.textContent = "LOCKED";
    return;
  }

  const totalMins = Math.floor(ms / 60000);
  const days = Math.floor(totalMins / (60 * 24));
  const hrs = Math.floor((totalMins - days * 60 * 24) / 60);
  const mins = totalMins % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  parts.push(`${hrs}h`);
  parts.push(`${mins}m`);

  elLeft.textContent = parts.join(" ");
}

// run immediately + every 30s
updateCountdown();
clearInterval(root.__lockoutTimer);
root.__lockoutTimer = setInterval(updateCountdown, 30000);
    } catch (err) {
      console.error("❌ loadNextEventSummary failed:", err);
      elName.textContent = "Failed to load";
      elStatus.textContent = "—";
      elLockout.textContent = "—";
    }
  }

  function renderLoggedOut(root) {
    render(
      root,
      `
      <h1>Submit</h1>
      <p class="muted">Login required.</p>

      <form id="submit-login-form" class="note" style="margin-top:12px;">
        <div style="display:flex; flex-direction:column; gap:10px;">
          <label class="tiny muted">Email</label>
          <input id="submit-email" type="email" autocomplete="email" required
                 style="padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);" />

          <label class="tiny muted">Password</label>
          <input id="submit-pass" type="password" autocomplete="current-password" required
                 style="padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);" />

          <div style="display:flex; flex-direction:column; gap:10px; margin-top:6px;">
  <button type="submit" class="tile">Login</button>

  <button type="button" id="submit-create" class="tile"
          style="background: linear-gradient(135deg, rgba(11, 61, 145, .18), rgba(255, 255, 255, .03));">
    Create account
  </button>

  <button type="button" id="submit-forgot" class="tile"
          style="background: rgba(255,255,255,.03);">
    Forgot password
  </button>

  <div id="submit-msg" class="tiny" style="color:#facc15;"></div>
</div>
        </div>
      </form>

      <p class="tiny muted" style="margin-top:10px;">
        After login, you’ll see your profile summary here (next step).
      </p>
      `
    );

    root.querySelector("#submit-login-form")?.addEventListener("submit", (e) =>
      handleLogin(e, root)
    );
    root.querySelector("#submit-create")?.addEventListener("click", (e) =>
      handleCreateAccount(e, root)
    );

    root.querySelector("#submit-forgot")?.addEventListener("click", () =>
      handleForgotPassword(root)
    );
  }

  function renderLoggedIn(root, user) {
    const email = user.email || "(no email)";

    render(
      root,
      `
      <h1>Submit</h1>
      <p class="muted">Signed in as <strong>${email}</strong></p>

    <div class="note" style="margin-top:12px;" id="player-profile">
  Loading profile…
</div>

<div class="card" style="margin-top:12px;">
  <h2 style="margin:0 0 6px 0;">Driver Submission</h2>
  <div class="tiny muted" style="margin-bottom:8px;">
    Need help? <a href="#" id="submit-help-link" style="color:#60a5fa; text-decoration:underline;">Click here to see How to Play →</a>
  </div>
  <div id="sld-section" class="note" style="margin-top:10px;">
    <div style="font-weight:700; margin-bottom:6px;">SLD — Season Long Driver</div>
    <div class="tiny muted" style="margin-bottom:8px;">
      Optional. Choose one driver to lock in for the full season.<br>
      Your SLD costs <strong>+10%</strong>, counts as one of your drivers, counts towards your tier balance, and ignores repetition rules.
    </div>

    <select id="sld-select" style="width:100%; padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);">
      <option value="">No SLD selected</option>
    </select>

    <div id="sld-selected-msg" class="tiny" style="margin-top:6px;"></div>
  </div>
<div class="tiny muted">
  Next event: <strong id="submit-next-event">Loading…</strong><br>
  Status: <strong id="submit-submission-status">—</strong><br>
  Lockout: <strong id="submit-lockout">—</strong><br>
  Time left: <strong id="submit-time-left">—</strong>
</div>

<div id="star-driver-panel" class="note" style="margin-top:10px;">
  <div style="font-weight:700; margin-bottom:6px;">Star Drivers</div>
  <div id="star-driver-summary" class="tiny muted">Loading star drivers…</div>
</div>

<div class="note" style="margin-top:10px;" id="team-summary">
  Selected: <strong id="team-count">0</strong> •
  Spend: <strong id="team-spend">£0.00</strong> •
  Remaining: <strong id="team-remaining">£0.00</strong> •
  Team EP: <strong id="team-ep">0</strong>
  <div id="team-tier-summary" class="tiny muted" style="margin-top:6px;"></div>
</div>
<div class="note" style="margin-top:10px;" id="selected-team-panel">
  <div style="font-weight:700; margin-bottom:6px; font-size:16px;">Your current team</div>
  <div id="selected-team-list" class="tiny muted">No drivers selected yet.</div>
</div>

<div id="team-validation" class="note warnNote" style="margin-top:10px;" hidden>
  Validation message
</div>

<button id="team-save" class="tile" style="margin-top:10px;" disabled>
  Save changes
</button>

<div id="driver-picker" class="list" style="margin-top:10px;">
  Loading drivers…
</div>

      <button id="submit-logout" class="tile" style="margin-top:12px;">Logout</button>
      `
    );

    root.querySelector("#submit-logout")?.addEventListener("click", handleLogout);
    root.querySelector("#submit-help-link")?.addEventListener("click", (e) => {
      e.preventDefault();
      const newsTab = document.querySelector('[data-route="news"]');
      newsTab?.click();
    });
    loadPlayerProfile(root, user.uid);
    loadNextEventSummary(root);

    // Load picker using budget from player profile doc (read-only)
    window.btccDb.collection("players").doc(user.uid).get().then(s => {
      const data = s.exists ? (s.data() || {}) : {};
      const baseBudget = typeof data.budget === "number" ? data.budget : 0;
      const budgetBoost = typeof data.budgetBoost === "number" ? data.budgetBoost : 0;
      const deductibles = typeof data.deductibles === "number" ? data.deductibles : 0;
      const availableBudget = typeof data.effectiveBudget === "number"
        ? data.effectiveBudget
        : (baseBudget + budgetBoost - deductibles);
      const name = data.displayName || (user.email || "Player");
      loadDriverPicker(root, availableBudget, user.uid, name);
    });
  }

  async function loadDriverPicker(root, playerBudget, uid, displayName) {
    const box = root.querySelector("#driver-picker");
    if (!box) return;

    const waitForEventContext = async () => {
      for (let i = 0; i < 30; i++) {
        const ctx = root.__eventContext || {};
        if (ctx.eventId) return ctx;
        await new Promise((r) => setTimeout(r, 100));
      }
      return root.__eventContext || {};
    };

    const initialCtx = await waitForEventContext();
    if (!initialCtx.eventId) {
      box.innerHTML = `<div class="note warnNote">Waiting for event…</div>`;
      return;
    }

    if (!window.btccDb) {
      box.textContent = "Waiting for database…";
      setTimeout(() => loadDriverPicker(root, playerBudget, uid, displayName), 300);
      return;
    }

    box.textContent = "Loading drivers…";

    const validationEl = root.querySelector("#team-validation");
    const saveBtn = root.querySelector("#team-save");
    const tierSummaryEl = root.querySelector("#team-tier-summary");
    const selectedTeamListEl = root.querySelector("#selected-team-list");
    let hasInteracted = false;
    let hasTriedSave = false;

    const getEventContext = () => root.__eventContext || {};

    const isLockedNow = () => {
      const ctx = getEventContext();
      if (ctx.open === false) return true;
      if (ctx.lockout && typeof ctx.lockout === "number") {
        return Date.now() >= ctx.lockout;
      }
      return false;
    };

    const isTierEvent = () => Number(getEventContext().eventNo || 0) >= 2;

    const fmtMoney = (n) => `£${(Number(n) || 0).toFixed(2)}`;

    const normaliseDriverIds = (data) => {
      if (!data || typeof data !== "object") return [];
      const candidates = [
        data.driverIds,
        data.teamIds,
        data.team,
        data.drivers,
        data.selectedDrivers,
        data.picks,
        data.selection,
      ];
      const arr = candidates.find((x) => Array.isArray(x)) || [];
      return Array.from(
        new Set(
          arr
            .map((item) => {
              if (!item) return null;
              if (typeof item === "string") return item;
              if (typeof item === "object") return item.driverId || item.id || item.ref || null;
              return null;
            })
            .filter(Boolean)
        )
      );
    };

    function showLockedMessage() {
      if (!validationEl) return;
      validationEl.hidden = false;
      validationEl.innerHTML = `<strong>Locked:</strong><br><span class="tiny muted">Submissions are closed for this event.</span>`;
      if (saveBtn) {
        saveBtn.textContent = "Locked";
        saveBtn.disabled = true;
      }
    }


    if (saveBtn) {
      saveBtn.textContent = isLockedNow() ? "Locked" : "Save changes";
      if (isLockedNow()) saveBtn.disabled = true;
    }

    try {
      const ctx = getEventContext();
      const currentEventNo = Number(ctx.eventNo || 0);

            const [driversSnap, eventsSnap, playerSnap, currentEventSnap] = await Promise.all([
        window.btccDb.collection("drivers").orderBy("name").get(),
        window.btccDb.collection("events").orderBy("eventNo").get(),
        window.btccDb.collection("players").doc(uid).get(),
        window.btccDb.collection("events").doc(ctx.eventId).get(),
      ]);

      if (driversSnap.empty) {
        box.textContent = "No drivers yet";
        return;
      }

      const playerData = playerSnap.exists ? (playerSnap.data() || {}) : {};
            const currentEventData = currentEventSnap.exists ? (currentEventSnap.data() || {}) : {};
      const starDriverAId = currentEventNo >= 2
        ? (currentEventData.starDriverAId || currentEventData.starDriverA || null)
        : null;
      const starDriverBId = currentEventNo >= 2
        ? (currentEventData.starDriverBId || currentEventData.starDriverB || null)
        : null;
      let currentSldDriverId = playerData.sldDriverId || playerData.sld || null;

      const previousEvents = eventsSnap.docs
        .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
        .filter((event) => Number(event.eventNo || 0) < currentEventNo)
        .sort((a, b) => Number(a.eventNo || 0) - Number(b.eventNo || 0))
        .slice(-2);

      const previousSelections = [];
      for (const event of previousEvents) {
        let subSnap = null;
        try {
          subSnap = await window.btccDb
            .collection("submissions")
            .doc(event.id)
            .collection("entries")
            .doc(uid)
            .get();
        } catch (err) {
          console.warn(`⚠️ Could not read submissions/${event.id}/entries/${uid}:`, err);
        }

        if (!subSnap || !subSnap.exists) {
          try {
            subSnap = await window.btccDb
              .collection("entries")
              .doc(event.id)
              .collection("entries")
              .doc(uid)
              .get();
          } catch (err) {
            console.warn(`⚠️ Could not read entries/${event.id}/entries/${uid}:`, err);
          }
        }

        previousSelections.push({
          eventId: event.id,
          eventNo: Number(event.eventNo || 0),
          driverIds: subSnap && subSnap.exists ? normaliseDriverIds(subSnap.data()) : [],
        });
      }

      const consecutiveCounts = new Map();
      previousSelections.forEach((entry) => {
        entry.driverIds.forEach((driverId) => {
          consecutiveCounts.set(driverId, (consecutiveCounts.get(driverId) || 0) + 1);
        });
      });

      const drivers = driversSnap.docs.map((doc) => {
        const d = doc.data() || {};
        const selectionsInLastTwo = Number(consecutiveCounts.get(doc.id) || 0);
        const isSLD = !!currentSldDriverId && currentSldDriverId === doc.id;
        const blocked = selectionsInLastTwo >= 2 && !isSLD;
        return {
          id: doc.id,
          name: d.name ?? "Unnamed",
          price: Number(d.price ?? d.cost ?? d.value ?? 0),
          tier: d.tier ?? null,
          selectionsInLastTwo,
          blocked,
          isSLD,
        };
      });

      const driversById = new Map(drivers.map((driver) => [driver.id, driver]));

            const starSummaryEl = root.querySelector("#star-driver-summary");
      const starDriverA = starDriverAId ? driversById.get(starDriverAId) : null;
      const starDriverB = starDriverBId ? driversById.get(starDriverBId) : null;

      if (starSummaryEl) {
        if (currentEventNo < 2) {
          starSummaryEl.innerHTML = `Event 1: no Star Drivers apply.`;
        } else {
          const underdogText = starDriverA
            ? `${escapeHtml(starDriverA.name)} (Underdog Driver • -20%)`
            : `Not set yet`;
          const formText = starDriverB
            ? `${escapeHtml(starDriverB.name)} (Form Driver • +5%)`
            : `Not set yet`;

          starSummaryEl.innerHTML = `
            Underdog Driver: <strong style="color:var(--text);">${underdogText}</strong><br>
            Form Driver: <strong style="color:var(--text);">${formText}</strong><br>
            <span class="tiny muted">SLD always overrides Star Driver pricing.</span>
          `;
        }
      }

      const tdv = drivers.reduce((sum, driver) => sum + Number(driver.price || 0), 0);
      const calculateExpectedPoints = (value) => {
        const safeValue = Number(value || 0);
        const safeTdv = Number(tdv || 0);
        if (safeValue <= 0 || safeTdv <= 0) return 0;
        return Math.round((PPV_2026 / safeTdv) * safeValue);
      };
      const getDriverExpectedPoints = (driver) => calculateExpectedPoints(driver?.price || 0);
            const getEffectiveDriverPrice = (driver) => {
        const base = Number(driver?.price || 0);
        if (base <= 0) return 0;

        const isSld = !!currentSldDriverId && currentSldDriverId === driver?.id;
        if (isSld) return roundMoney2(base * 1.10);

        if (starDriverAId && driver?.id === starDriverAId) {
          return roundMoney2(base * 0.80);
        }

        if (starDriverBId && driver?.id === starDriverBId) {
          return roundMoney2(base * 1.05);
        }

        return base;
      };

      // ---- SLD setup (Event 1 only) ----
      const sldSection = root.querySelector("#sld-section");
      const sldSelect = root.querySelector("#sld-select");
      const sldMsg = root.querySelector("#sld-selected-msg");

      if (sldSection) {
        const currentEventNo = Number(getEventContext().eventNo || 0);

        if (currentEventNo !== 1) {
          sldSection.style.display = "none";
        } else {
          sldSection.style.display = "block";

          if (sldSelect) {
            sldSelect.innerHTML = `<option value="">No SLD selected</option>` +
              drivers.map((d) => `<option value="${d.id}" data-price="${d.price}">${escapeHtml(d.name)}</option>`).join("");

            sldSelect.onchange = async () => {
              const selectedId = sldSelect.value;

              if (!selectedId) {
                currentSldDriverId = null;
                drivers.forEach((d) => {
                  d.isSLD = false;
                });
                if (sldMsg) sldMsg.textContent = "";
                await window.btccDb.collection("players").doc(uid).set({
                  sldDriverId: null,
                  sldLocked: false,
                }, { merge: true });
                box.querySelectorAll("[data-driver-id]").forEach((row) => updateRowState(row));
                updateSummary();
                return;
              }

              const driver = driversById.get(selectedId);
              if (!driver) return;

              const base = Number(driver.price || 0);
              const sldPrice = Math.round(base * 1.10 * 100) / 100;

              const confirmText = `You are selecting ${driver.name} as your Season Long Driver.\n\nExample Base value: £2.50\nSLD price 10% premium : £2.75\n\nSLD is excluded from Star Driver adjustments.\n\nThis choice is locked for the season. Continue?`;

              if (!window.confirm(confirmText)) {
                sldSelect.value = currentSldDriverId || "";
                return;
              }

              currentSldDriverId = selectedId;
              drivers.forEach((d) => {
                d.isSLD = d.id === selectedId;
               });
               selected.add(selectedId);

              if (sldMsg) {
                sldMsg.innerHTML = `<strong>SLD selected:</strong> ${escapeHtml(driver.name)} (Current SLD price this event: ${fmtMoney(sldPrice)})`;
              }

              await window.btccDb.collection("players").doc(uid).set({
                sldDriverId: selectedId,
                sldLocked: true,
                sldSelectedAtEventNo: 1,
              }, { merge: true });

              box.querySelectorAll("[data-driver-id]").forEach((row) => updateRowState(row));
              updateSummary();
            };
          }
        }
      }

      // preload SLD if set
      if (currentSldDriverId && root.querySelector("#sld-select")) {
        const sel = root.querySelector("#sld-select");
        sel.value = currentSldDriverId;

        const driver = driversById.get(currentSldDriverId);
        if (driver && root.querySelector("#sld-selected-msg")) {
          const sldPrice = Math.round(Number(driver.price || 0) * 1.10 * 100) / 100;
          root.querySelector("#sld-selected-msg").innerHTML = `<strong>SLD selected:</strong> ${escapeHtml(driver.name)} (Current SLD price this event: ${fmtMoney(sldPrice)})`;
        }
      }
      const selected = new Set();

      const updateRowState = (row) => {
        if (!row) return;
        const id = row.getAttribute("data-driver-id");
        const driver = driversById.get(id);
        const btn = row.querySelector("[data-action='toggle']");
        if (!driver || !btn) return;

        const isSelected = selected.has(id);
        if (isSelected) {
          btn.textContent = driver.isSLD ? "SLD" : "Selected";
          row.style.opacity = "1";
          row.style.borderColor = "#facc15";
          row.style.boxShadow = "0 0 0 1px rgba(250, 204, 21, .25)";
        } else if (driver.blocked) {
          btn.textContent = "Blocked";
          row.style.opacity = "0.72";
          row.style.borderColor = "rgba(250, 204, 21, .25)";
          row.style.boxShadow = "none";
        } else {
          btn.textContent = "Select";
          row.style.opacity = "0.9";
          row.style.borderColor = "var(--border)";
          row.style.boxShadow = "none";
        }

        btn.disabled = isLockedNow();
      };

      const updateSummary = () => {
        const countEl = root.querySelector("#team-count");
        const spendEl = root.querySelector("#team-spend");
        const remEl = root.querySelector("#team-remaining");
        const epEl = root.querySelector("#team-ep");

        const selectedDrivers = Array.from(selected)
          .map((id) => driversById.get(id))
          .filter(Boolean);

        // --- New: update selected team panel ---
        if (selectedTeamListEl) {
          if (selectedDrivers.length === 0) {
            selectedTeamListEl.textContent = "No drivers selected yet.";
          } else {
            selectedTeamListEl.innerHTML = selectedDrivers
                .map((driver) => {
                const effectivePrice = getEffectiveDriverPrice(driver);
                const expectedPoints = getDriverExpectedPoints(driver);
                const sldBadge = driver.id === currentSldDriverId ? ` <span class="muted">(SLD +10%)</span>` : "";
                const underdogBadge = !sldBadge && starDriverAId && driver.id === starDriverAId ? ` <span class="muted">(Underdog -20%)</span>` : "";
                const formBadge = !sldBadge && starDriverBId && driver.id === starDriverBId ? ` <span class="muted">(Form +5%)</span>` : "";
                return `<div style="margin-bottom:4px;"><strong>${escapeHtml(driver.name)}</strong> <span class="muted">(${fmtMoney(effectivePrice)} • EP: ${expectedPoints})</span>${sldBadge}${underdogBadge}${formBadge}</div>`;
              })
              .join("");
          }
        }

        const total = selectedDrivers.reduce((sum, driver) => sum + Number(getEffectiveDriverPrice(driver) || 0), 0);
        const teamEp = selectedDrivers.reduce((sum, driver) => sum + Number(getDriverExpectedPoints(driver) || 0), 0);
        const budgetNum = Number(playerBudget) || 0;
        const remaining = budgetNum - total;

        const tierCounts = { high: 0, middle: 0, lower: 0 };
        selectedDrivers.forEach((driver) => {
          const tierKey = String(driver.tier || "").toLowerCase();
          if (tierCounts[tierKey] !== undefined) tierCounts[tierKey] += 1;
        });

        if (countEl) countEl.textContent = String(selected.size);
        if (spendEl) spendEl.textContent = fmtMoney(total);
        if (remEl) remEl.textContent = fmtMoney(remaining);
        if (epEl) epEl.textContent = String(teamEp);

        if (tierSummaryEl) {
          if (isTierEvent()) {
            tierSummaryEl.innerHTML = `High: <strong>${tierCounts.high}</strong>/1 min • max 2 &nbsp;|&nbsp; Middle: <strong>${tierCounts.middle}</strong>/1 min • max 2 &nbsp;|&nbsp; Lower: <strong>${tierCounts.lower}</strong>/1 min • max 2`;
          } else {
            tierSummaryEl.textContent = "Event 1: free choice. No tier rules yet.";
          }
        }

        const issues = [];

        if (budgetNum <= 0) {
          issues.push("Budget not set yet.");
        }

        if (selected.size < 3) {
          issues.push("Select at least 3 drivers.");
        }

        if (selected.size > 6) {
          issues.push("Maximum 6 drivers allowed.");
        }

        if (remaining < 0) {
          issues.push(`Over budget by ${fmtMoney(Math.abs(remaining))}.`);
        }

        const blockedSelected = selectedDrivers.filter((driver) => driver.blocked && !driver.isSLD);
        if (blockedSelected.length > 0) {
          issues.push(`Cannot select drivers already used in the previous 2 events: ${blockedSelected.map((driver) => escapeHtml(driver.name)).join(", ")}.`);
        }

        if (isTierEvent()) {
          const missingTierData = selectedDrivers.some((driver) => !driver.tier);
          if (missingTierData) {
            issues.push("Tier data is not ready yet for all selected drivers.");
          }
          if (tierCounts.high < 1) issues.push("Select at least 1 High tier driver.");
          if (tierCounts.middle < 1) issues.push("Select at least 1 Middle tier driver.");
          if (tierCounts.lower < 1) issues.push("Select at least 1 Lower tier driver.");
          if (tierCounts.high > 2) issues.push("Maximum 2 High tier drivers allowed.");
          if (tierCounts.middle > 2) issues.push("Maximum 2 Middle tier drivers allowed.");
          if (tierCounts.lower > 2) issues.push("Maximum 2 Lower tier drivers allowed.");
        }

        const valid = issues.length === 0;

        if (validationEl) {
          if (valid) {
            validationEl.hidden = true;
          } else if (hasInteracted || hasTriedSave) {
            validationEl.hidden = false;
            validationEl.innerHTML = `<strong>Fix this:</strong><br><span class="tiny muted">${issues.join("<br>")}</span>`;
          } else {
            validationEl.hidden = true;
          }
        }

        if (saveBtn) {
          if (isLockedNow()) {
            saveBtn.disabled = true;
            saveBtn.textContent = "Locked";
          } else {
            saveBtn.disabled = !valid;
            saveBtn.textContent = "Save changes";
          }
        }
      };

      async function loadExistingSubmission() {
        const eventId = getEventContext().eventId;
        if (!eventId || !uid) return;

        try {
          const subSnap = await window.btccDb
            .collection("submissions")
            .doc(eventId)
            .collection("entries")
            .doc(uid)
            .get();

          if (!subSnap.exists) return;

          const ids = normaliseDriverIds(subSnap.data());
          ids.forEach((id) => {
            if (!driversById.has(id)) return;
            selected.add(id);
            const row = box.querySelector(`[data-driver-id="${id}"]`);
            updateRowState(row);
          });

          updateSummary();


          if (saveBtn && !isLockedNow()) {
            saveBtn.textContent = "Save changes";
            saveBtn.disabled = false;
          }

          console.log("✅ Loaded existing submission:", eventId, uid);
        } catch (e) {
          console.warn("⚠️ Could not load existing submission:", e);
        }
      }

      async function saveSubmission() {
        hasTriedSave = true;
        updateSummary();
        const eventId = getEventContext().eventId;

        if (!eventId) {
          if (validationEl) {
            validationEl.hidden = false;
            validationEl.innerHTML = `<strong>Fix this:</strong><br><span class="tiny muted">Event not ready yet. Try again in a moment.</span>`;
          }
          return;
        }

        if (isLockedNow()) {
          if (validationEl) {
            validationEl.hidden = false;
            validationEl.innerHTML = `<strong>Locked:</strong><br><span class="tiny muted">Submissions are closed for this event.</span>`;
          }
          return;
        }

        const driverIds = Array.from(selected);
        const totalCost = driverIds.reduce((sum, id) => sum + Number(getEffectiveDriverPrice(driversById.get(id)) || 0), 0);

        const payload = {
          uid,
          displayName: displayName || "Player",
          driverIds,
          teamIds: driverIds,
          sldDriverId: currentSldDriverId || null,
          totalCost: Number(totalCost) || 0,
          eventId,
          eventNo: getEventContext().eventNo ?? null,
          venue: getEventContext().venue ?? null,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };

        const ref = window.btccDb.collection("submissions").doc(eventId).collection("entries").doc(uid);

        try {
          await ref.set({ ...payload, createdAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });

          await window.btccDb.collection("players").doc(uid).set(
            {
              lastSubmission: firebase.firestore.FieldValue.serverTimestamp(),
              lastSubmissionEventId: eventId,
              driversSelected: selected.size,
            },
            { merge: true }
          );

          if (validationEl) validationEl.hidden = true;
          if (saveBtn && !isLockedNow()) {
            saveBtn.textContent = "Save changes";
            saveBtn.disabled = false;
          }
          loadPlayerProfile(root, uid);
          // Show temporary saved state message
          if (validationEl) {
            validationEl.hidden = false;
            validationEl.innerHTML = `<strong>Saved:</strong><br><span class="tiny muted">Team saved successfully.</span>`;
            setTimeout(() => {
              if (validationEl) validationEl.hidden = true;
            }, 1600);
          }

          console.log("✅ Submission saved:", eventId, uid, payload);
        } catch (err) {
          console.error("❌ Submission save failed:", err);
          if (validationEl) {
            validationEl.hidden = false;
            validationEl.innerHTML = `<strong>Save failed.</strong><br><span class="tiny muted">${escapeHtml(err?.message || err)}</span>`;
          }
        }
      }

      if (saveBtn) {
        saveBtn.onclick = saveSubmission;
      }

      box.innerHTML = `
        <ul class="list">
          ${drivers
            .map((driver) => {
              const tierLabel = isTierEvent() ? (driver.tier ? `${String(driver.tier).charAt(0).toUpperCase()}${String(driver.tier).slice(1)}` : "Tier TBD") : "Free choice";
              const streakLabel = `Usage: ${driver.selectionsInLastTwo}/2`;
              const sldLabel = driver.isSLD ? " • SLD" : "";
              const blockedLabel = driver.blocked ? " • Blocked next event" : "";
              return `
                <li
                  class="driverPickRow"
                  data-driver-id="${driver.id}"
                  data-price="${driver.price}"
                  data-tier="${escapeHtml(driver.tier || "")}"
                  data-blocked="${driver.blocked ? "1" : "0"}"
                  style="padding:12px; border:1px solid var(--border); border-radius:14px; background:rgba(255,255,255,.02); margin-bottom:10px;"
                >
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                    <div style="flex:1; min-width:0;">
                      <div style="font-weight:700; line-height:1.2;">${escapeHtml(driver.name)}</div>
                      <div class="tiny muted" style="margin-top:8px; display:flex; flex-wrap:wrap; gap:6px 8px;">
                                                <span style="padding:4px 8px; border-radius:999px; border:1px solid var(--border); background:rgba(255,255,255,.03);">Base ${fmtMoney(driver.price)}</span>
                        <span style="padding:4px 8px; border-radius:999px; border:1px solid var(--border); background:rgba(255,255,255,.03);">Event ${fmtMoney(getEffectiveDriverPrice(driver))}</span>
                        <span style="padding:4px 8px; border-radius:999px; border:1px solid var(--border); background:rgba(255,255,255,.03);">EP: ${getDriverExpectedPoints(driver)}</span>
                        <span style="padding:4px 8px; border-radius:999px; border:1px solid var(--border); background:rgba(255,255,255,.03);">${escapeHtml(tierLabel)}</span>
                        <span style="padding:4px 8px; border-radius:999px; border:1px solid var(--border); background:rgba(255,255,255,.03);">${escapeHtml(streakLabel)}</span>
                        ${driver.isSLD ? `<span style="padding:4px 8px; border-radius:999px; border:1px solid rgba(34,197,94,.35); background:rgba(34,197,94,.10);">SLD +10%</span>` : ""}
                        ${!driver.isSLD && starDriverAId && driver.id === starDriverAId ? `<span style="padding:4px 8px; border-radius:999px; border:1px solid rgba(96,165,250,.35); background:rgba(96,165,250,.10);">Underdog -20%</span>` : ""}
                        ${!driver.isSLD && starDriverBId && driver.id === starDriverBId ? `<span style="padding:4px 8px; border-radius:999px; border:1px solid rgba(251,191,36,.35); background:rgba(251,191,36,.10);">Form +5%</span>` : ""}
                        ${driver.blocked ? `<span style="padding:4px 8px; border-radius:999px; border:1px solid rgba(250,204,21,.35); background:rgba(250,204,21,.10);">Blocked next event</span>` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      class="tile tinyBtn"
                      data-action="toggle"
                      style="width:auto; min-width:96px; padding:10px 14px; flex:0 0 auto; white-space:nowrap;"
                    >${driver.blocked ? "Blocked" : "Select"}</button>
                  </div>
                </li>
              `;
            })
            .join("")}
        </ul>
      `;

      box.querySelectorAll("[data-action='toggle']").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (isLockedNow()) {
            showLockedMessage();
            return;
          }

          const row = btn.closest("[data-driver-id]");
          const id = row?.getAttribute("data-driver-id");
          const driver = id ? driversById.get(id) : null;
          if (!id || !driver) return;

          if (selected.has(id)) {
           if (driver.isSLD) {
             if (validationEl) {
               validationEl.hidden = false;
               validationEl.innerHTML = `<strong>Fix this:</strong><br><span class="tiny muted">Your SLD counts as one of your drivers. Remove or change the SLD selection above if you do not want this driver locked into the team.</span>`;
             }
             return;
          }

          hasInteracted = true;
          selected.delete(id);
          updateRowState(row);
          updateSummary();
          return;
        }

          if (driver.blocked && !driver.isSLD) {
            if (validationEl) {
              validationEl.hidden = false;
              validationEl.innerHTML = `<strong>Fix this:</strong><br><span class="tiny muted">${escapeHtml(driver.name)} has already been selected in the previous 2 events.</span>`;
            }
            return;
          }

          if (selected.size >= 6) {
            if (validationEl) {
              validationEl.hidden = false;
              validationEl.innerHTML = `<strong>Fix this:</strong><br><span class="tiny muted">Maximum 6 drivers allowed.</span>`;
            }
            return;
          }

          hasInteracted = true;
          selected.add(id);
          updateRowState(row);
          updateSummary();
        });
      });

      box.querySelectorAll("[data-driver-id]").forEach((row) => updateRowState(row));

      await loadExistingSubmission();

      if (isLockedNow()) {
        showLockedMessage();
      }

      updateSummary();
      console.log("✅ Driver picker loaded:", drivers.length);
    } catch (err) {
      console.error("❌ loadDriverPicker failed:", err);
      box.innerHTML = `
        <div class="note warnNote">
          Failed to load drivers.<br>
          <span class="tiny muted">${escapeHtml(err?.message || err)}</span>
        </div>
      `;
    }
  }

  async function loadSubmit() {
    const view = document.getElementById("view-submit");
    if (!view) return;

    const card = view.querySelector(".card");
    if (!card) return;

    if (typeof firebase === "undefined" || !firebase.auth) {
      card.innerHTML = `
        <h1>Submit</h1>
        <div class="note warnNote">Firebase Auth not available.</div>
      `;
      return;
    }

    // Render immediately, then react to auth state.
    renderLoggedOut(card);

    firebase.auth().onAuthStateChanged((user) => {
      if (!user) renderLoggedOut(card);
      else renderLoggedIn(card, user);
    });
  }

  window.loadSubmit = loadSubmit;
})();