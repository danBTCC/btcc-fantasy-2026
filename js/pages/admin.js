// js/pages/admin.js
// Exposes: window.loadAdmin()

(function () {
const ADMIN_EMAILS = [
  "dmillward85@icloud.com"
];

  function isAdminEmail(email) {
    if (!email) return false;
    return ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase());
  }

  function render(el, html) {
    el.innerHTML = html;
  }

  async function handleLogin(e, root) {
    e.preventDefault();

    const email = root.querySelector("#admin-email")?.value?.trim();
    const pass = root.querySelector("#admin-pass")?.value;

    const msg = root.querySelector("#admin-msg");
    if (msg) msg.textContent = "";

    try {
      await firebase.auth().signInWithEmailAndPassword(email, pass);
    } catch (err) {
      console.error("❌ Admin login failed:", err);
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
      <h1>Admin</h1>
      <p class="muted">Login required.</p>

      <form id="admin-login-form" class="note" style="margin-top:12px;">
        <div style="display:flex; flex-direction:column; gap:10px;">
          <label class="tiny muted">Email</label>
          <input id="admin-email" type="email" autocomplete="email" required
                 style="padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);" />

          <label class="tiny muted">Password</label>
          <input id="admin-pass" type="password" autocomplete="current-password" required
                 style="padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);" />

          <button type="submit" class="tile" style="margin-top:6px;">Login</button>
          <div id="admin-msg" class="tiny" style="color:#facc15;"></div>
        </div>
      </form>

      <p class="tiny muted" style="margin-top:10px;">
        Admin tools will appear here once authenticated.
      </p>
      `
    );

    const form = root.querySelector("#admin-login-form");
    form?.addEventListener("submit", (e) => handleLogin(e, root));
  }

  function renderNoAccess(root, email) {
    render(
      root,
      `
      <h1>Admin</h1>
      <p class="muted">Signed in as <strong>${email}</strong></p>

      <div class="note warnNote" style="margin-top:12px;">
        No access. This account is not on the admin allowlist.
      </div>

      <button id="admin-logout" class="tile" style="margin-top:12px;">Logout</button>
      `
    );

    root.querySelector("#admin-logout")?.addEventListener("click", handleLogout);
  }

  function renderAdminUnlocked(root, email) {
    render(
      root,
      `
      <h1>Admin</h1>
      <p class="muted">Admin unlocked for <strong>${email}</strong></p>

      <div class="note" style="margin-top:12px;">
        Next: admin forms for results input + engine run (protected).
      </div>

      <button id="admin-logout" class="tile" style="margin-top:12px;">Logout</button>
      `
    );

    root.querySelector("#admin-logout")?.addEventListener("click", handleLogout);
  }

  async function loadAdmin() {
    const view = document.getElementById("view-admin");
    if (!view) return;

    const card = view.querySelector(".card");
    if (!card) return;

    // Firebase auth must be available
    if (typeof firebase === "undefined" || !firebase.auth) {
      card.innerHTML = `
        <h1>Admin</h1>
        <div class="note warnNote">Firebase Auth not available.</div>
      `;
      return;
    }

    // Render immediately (logged out state) then update on auth state.
    renderLoggedOut(card);

    firebase.auth().onAuthStateChanged((user) => {
      if (!user) {
        renderLoggedOut(card);
        return;
      }

      const email = user.email || "(no email)";
      if (!isAdminEmail(email)) {
        renderNoAccess(card, email);
        return;
      }

      renderAdminUnlocked(card, email);
    });
  }

  window.loadAdmin = loadAdmin;
})();