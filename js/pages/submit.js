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

      <div class="note" style="margin-top:12px;">
        Profile summary wiring comes next.
      </div>

      <button id="submit-logout" class="tile" style="margin-top:12px;">Logout</button>
      `
    );

    root.querySelector("#submit-logout")?.addEventListener("click", handleLogout);
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