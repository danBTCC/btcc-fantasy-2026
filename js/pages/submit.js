// js/pages/submit.js
// Exposes: window.loadSubmit()

(function () {
  function render(el, html) {
    el.innerHTML = html;
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
      const snap = await window.btccDb.collection("players").doc(uid).get();

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
      const last = d.lastSubmission && String(d.lastSubmission).trim() ? d.lastSubmission : "—";
      const active = d.active === false ? "No" : "Yes";

      box.innerHTML = `
        <div><strong>${name}</strong></div>
        <div class="tiny muted" style="margin-top:6px;">
          Active: ${active}<br>
          Budget: £${budget.toFixed(2)}<br>
          Penalties: ${penalties}<br>
          Last submission: ${last}
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

      elName.textContent = `Event ${chosen.eventNo ?? "—"} — ${chosen.venue} (${rounds} • ${dateRange})`;
      elStatus.textContent = open ? "OPEN" : "LOCKED";
      elLockout.textContent = fmtDateTime(lockout);
    } catch (err) {
      console.error("❌ loadNextEventSummary failed:", err);
      elName.textContent = "Failed to load";
      elStatus.textContent = "—";
      elLockout.textContent = "—";
    }
  }

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

// run once immediately + then every 30s
updateCountdown();
clearInterval(root.__lockoutTimer);
root.__lockoutTimer = setInterval(updateCountdown, 30000);

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
  <h2 style="margin:0 0 6px 0;">Team Submission</h2>
<div class="tiny muted">
  Next event: <strong id="submit-next-event">Loading…</strong><br>
  Status: <strong id="submit-submission-status">—</strong><br>
  Lockout: <strong id="submit-lockout">—</strong>
  Time left: <strong id="submit-time-left">—</strong>
</div>

  <div class="note" style="margin-top:10px;">
    Team picker comes next (Phase G). This will allow 3–6 drivers within your £10.00 budget.
  </div>
</div>

      <button id="submit-logout" class="tile" style="margin-top:12px;">Logout</button>
      `
    );

    root.querySelector("#submit-logout")?.addEventListener("click", handleLogout);
    loadPlayerProfile(root, user.uid);
    loadNextEventSummary(root);
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