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

          <button type="submit" class="tile" style="margin-top:6px;">Login</button>
          <div id="submit-msg" class="tiny" style="color:#facc15;"></div>
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