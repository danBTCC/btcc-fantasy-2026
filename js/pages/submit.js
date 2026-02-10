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
    Next event: <strong>Loading…</strong><br>
    Status: <strong>—</strong><br>
    Lockout: <strong>—</strong>
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