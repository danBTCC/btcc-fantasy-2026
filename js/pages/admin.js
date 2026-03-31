// js/pages/admin.js
// Exposes: window.loadAdmin()

// ============================================================
// ADMIN.JS STRUCTURE INDEX (Phase H / I)
// ============================================================
// 1. Auth + Access Control
//    - isAdminEmail
//    - handleLogin / handleLogout
//    - renderLoggedOut / renderNoAccess
//
// 2. Admin Bootstrap
//    - loadAdmin
//    - renderAdminUnlocked
//
// 3. Event + Driver Loading
//    - loadAdminEventPicker
//    - loadAdminDrivers
//
// 4. Results Entry UI
//    - renderQualifyingForm
//    - renderRaceForms
//
// 5. Results Preview + Locking (H7)
//    - loadSelectedEventMetaAndResults
//    - renderResultsPreview
//    - Lock / Unlock handlers
//
// 6. Engine (Phase I)
//    - I1 Dry Run + Write
//    - I2 Scoring Rules
//    - loadEventScoresPreview
// ============================================================

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

  // ============================================================
  // SECTION 2: ADMIN BOOTSTRAP (Unlocked View)
  // ============================================================
  function renderAdminUnlocked(root, email) {
    render(
      root,
      `
      <h1>Admin</h1>
      <p class="muted">Admin unlocked for <strong>${email}</strong></p>
      
            <div class="card" style="margin-top:12px;">
        <h2 style="margin:0 0 6px 0;">Home Page News</h2>
        <p class="tiny muted" style="margin:0;">Editable home page snippets (not pulled from the News tab). Saved to <span class="tiny">meta/homeNews</span>.</p>

        <div style="display:flex; flex-direction:column; gap:10px; margin-top:10px;">
          <label class="tiny muted">Pit lane gossip</label>
          <textarea id="admin-home-news-pit" rows="3" placeholder="A few lines…"
            style="width:100%; padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);"></textarea>

          <label class="tiny muted">Latest event news</label>
          <textarea id="admin-home-news-latest" rows="3" placeholder="A few lines…"
            style="width:100%; padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);"></textarea>

          <label class="tiny muted">Previous event news</label>
          <textarea id="admin-home-news-prev" rows="3" placeholder="A few lines…"
            style="width:100%; padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);"></textarea>

          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:4px;">
            <button id="admin-home-news-save" class="tile">Save Home news</button>
            <button id="admin-home-news-reload" class="tile tinyBtn" type="button">Reload</button>
            <div id="admin-home-news-msg" class="tiny muted"></div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:12px;">
        <h2 style="margin:0 0 6px 0;">Submission Tracker</h2>
        <p class="tiny muted">Quick visual check of which players have submitted for Events 1–10.</p>
        <div id="admin-submission-tracker-msg" class="tiny muted" style="margin-top:8px;">Loading…</div>
        <div id="admin-submission-tracker" style="margin-top:10px;"></div>
      </div>

      <div class="card" style="margin-top:12px;">
        <h2 style="margin:0 0 6px 0;">Player Manager</h2>
        <p class="tiny muted">Create or update a player using their Firebase UID.</p>

        <div style="display:flex; flex-direction:column; gap:8px; margin-top:10px;">
          <label class="tiny muted">Player UID</label>
          <input id="admin-player-uid" type="text" placeholder="Firebase UID"
            style="padding:8px; border-radius:8px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);" />

          <label class="tiny muted">Display Name</label>
          <input id="admin-player-name" type="text" placeholder="Player name"
            style="padding:8px; border-radius:8px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);" />

          <label class="tiny muted">Team ID</label>
          <input id="admin-player-team" type="text" placeholder="team_1, team_2, etc"
            style="padding:8px; border-radius:8px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);" />

          <label class="tiny muted">Budget</label>
          <input id="admin-player-budget" type="number" value="10"
            style="padding:8px; border-radius:8px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);" />

          <button id="admin-player-save" class="tile">Save player</button>
          <div id="admin-player-msg" class="tiny muted"></div>
        </div>
      </div>

      <div class="card" style="margin-top:12px;">
        <h2 style="margin:0 0 6px 0;">Driver Manager</h2>
        <p class="tiny muted">Create or update drivers and set their starting value/category/active status.</p>

        <div style="display:flex; flex-direction:column; gap:8px; margin-top:10px;">
          <label class="tiny muted">Driver Doc ID (optional)</label>
          <input id="admin-driver-id" type="text" placeholder="ash-sutton"
            style="padding:8px; border-radius:8px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);" />

          <label class="tiny muted">Driver Name</label>
          <input id="admin-driver-name" type="text" placeholder="Ash Sutton"
            style="padding:8px; border-radius:8px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);" />

          <label class="tiny muted">Driver Value</label>
          <input id="admin-driver-value" type="number" step="0.01" value="0.00"
            style="padding:8px; border-radius:8px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);" />

          <label class="tiny muted">Driver Category</label>
          <input id="admin-driver-category" type="text" placeholder="M or I, JS"
            style="padding:8px; border-radius:8px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);" />

          <label class="tiny muted" style="display:flex; align-items:center; gap:8px;">
            <input id="admin-driver-active" type="checkbox" checked />
            Driver Active
          </label>

          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:4px;">
            <button id="admin-driver-save" class="tile">Save driver</button>
            <button id="admin-driver-reload" class="tile tinyBtn" type="button">Reload driver list</button>
            <div id="admin-driver-msg" class="tiny muted"></div>
          </div>
        </div>

        <div id="admin-driver-list" style="margin-top:12px;"></div>
      </div>

      <div class="card" style="margin-top:12px;">
        <h2 style="margin:0 0 6px 0;">Results Entry</h2>
        <p class="tiny muted" style="margin:0;">
          Enter qualifying and race results for events. Results will be locked once confirmed.
        </p>

        <div class="note" style="margin-top:10px;">
          Event selection comes next.
        </div>

        <div id="admin-lock-banner" class="note warnNote" hidden style="margin-top:10px;"></div>
<div id="admin-results-entry" class="tiny muted" style="margin-top:8px;"></div>
<div id="admin-results-form" style="margin-top:10px;"></div>
<div id="admin-races-form" style="margin-top:10px;"></div>
<div id="admin-results-preview" style="margin-top:10px;"></div>
<div id="admin-drivers-status" class="tiny muted" style="margin-top:10px;">Drivers: Loading…</div>

      <button id="admin-logout" class="tile" style="margin-top:12px;">Logout</button>
      `
    );

    root.querySelector("#admin-logout")?.addEventListener("click", handleLogout);
    loadAdminEventPicker(root);
    loadAdminDrivers(root);
    setupAdminHomeNews(root);
    loadAdminSubmissionTracker(root);
    setupAdminPlayerManager(root);
    setupAdminDriverManager(root);
    renderQualifyingForm(root);
    renderRaceForms(root);
    renderResultsPreview(root);
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
    window.loadSelectedEventMetaAndResults = loadSelectedEventMetaAndResults;
    window.renderResultsPreview = renderResultsPreview;
    window.renderRaceForms = renderRaceForms;
    window.loadAdminSubmissionTracker = loadAdminSubmissionTracker;
    window.runDriverValueEngineJ1 = runDriverValueEngineJ1;
    window.runPlayerBudgetEngineJ2 = runPlayerBudgetEngineJ2;
    window.runDriverTierEngineJ3 = runDriverTierEngineJ3;
    window.runBudgetBoostEngineJ4 = runBudgetBoostEngineJ4;

  async function loadAdminSubmissionTracker(root) {
    const mount = root.querySelector("#admin-submission-tracker");
    const msg = root.querySelector("#admin-submission-tracker-msg");
    if (!mount) return;

    if (!window.btccDb) {
      if (msg) msg.textContent = "Database not ready.";
      mount.innerHTML = "";
      return;
    }

    try {
      if (msg) msg.textContent = "Loading…";
      mount.innerHTML = "";

      const [playersSnap, eventsSnap] = await Promise.all([
        window.btccDb.collection("players").get(),
        window.btccDb.collection("events").orderBy("eventNo").get(),
      ]);

      const players = playersSnap.docs
        .map((doc) => {
          const d = doc.data() || {};
          return {
            uid: doc.id,
            displayName: (d.displayName || d.name || doc.id).toString(),
            active: d.active !== false,
          };
        })
        .filter((p) => p.active)
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

      const events = eventsSnap.docs
        .map((doc) => ({
          id: doc.id,
          eventNo: Number(doc.data()?.eventNo || 0),
        }))
        .filter((e) => e.eventNo >= 1 && e.eventNo <= 10)
        .sort((a, b) => a.eventNo - b.eventNo);

      const submissionMap = new Map();

      await Promise.all(
        events.map(async (ev) => {
          let entriesSnap = await window.btccDb
            .collection("submissions")
            .doc(ev.id)
            .collection("entries")
            .get();

          if (entriesSnap.empty) {
            entriesSnap = await window.btccDb
              .collection("entries")
              .doc(ev.id)
              .collection("entries")
              .get();
          }

          const submitted = new Set();
          entriesSnap.forEach((doc) => {
            submitted.add(doc.id);
          });

          submissionMap.set(ev.id, submitted);
        })
      );

      const header = `
        <thead>
          <tr>
            <th style="position:sticky; left:0; background:rgba(14,17,22,.98); text-align:left; padding:8px; border-bottom:1px solid var(--border); min-width:160px; z-index:1;">Player</th>
            ${events.map((ev) => `<th style="text-align:center; padding:8px; border-bottom:1px solid var(--border); min-width:72px;">E${ev.eventNo}</th>`).join("")}
          </tr>
        </thead>
      `;

      const body = `
        <tbody>
          ${players.map((player) => `
            <tr>
              <td style="position:sticky; left:0; background:rgba(14,17,22,.98); padding:8px; border-bottom:1px solid var(--border); font-weight:600; z-index:1;">${player.displayName}</td>
              ${events.map((ev) => {
                const submitted = submissionMap.get(ev.id)?.has(player.uid) === true;
                return `<td style="text-align:center; padding:8px; border-bottom:1px solid var(--border);">${submitted ? "✅" : "—"}</td>`;
              }).join("")}
            </tr>
          `).join("")}
        </tbody>
      `;

      mount.innerHTML = `
        <div style="overflow:auto; border:1px solid var(--border); border-radius:12px; background:rgba(255,255,255,.02);">
          <table style="width:100%; border-collapse:collapse;">
            ${header}
            ${body}
          </table>
        </div>
      `;

      if (msg) {
        msg.textContent = `Showing ${players.length} active player(s) across ${events.length} event(s).`;
      }
    } catch (err) {
      console.error("❌ loadAdminSubmissionTracker failed:", err);
      if (msg) msg.textContent = err?.message || "Failed to load submission tracker.";
      mount.innerHTML = `<div class="note warnNote">Failed to load submission tracker.</div>`;
    }
  }

})();