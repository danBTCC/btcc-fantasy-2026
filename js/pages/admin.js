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
        <button type="button" class="admin-collapse-toggle" data-target="admin-home-news-body" aria-expanded="false" style="width:100%; display:flex; justify-content:space-between; align-items:center; background:transparent; border:0; color:var(--text); padding:0; cursor:pointer;">
          <h2 style="margin:0;">Home Page News</h2>
          <span class="tiny muted" data-chevron>▸</span>
        </button>
        <div id="admin-home-news-body" hidden style="margin-top:10px;">
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
        </div>

            <div class="card" style="margin-top:12px;">
        <button type="button" class="admin-collapse-toggle" data-target="admin-news-manager-body" aria-expanded="false" style="width:100%; display:flex; justify-content:space-between; align-items:center; background:transparent; border:0; color:var(--text); padding:0; cursor:pointer;">
          <h2 style="margin:0;">News Manager</h2>
          <span class="tiny muted" data-chevron>▸</span>
        </button>
        <div id="admin-news-manager-body" hidden style="margin-top:10px;">
          <p class="tiny muted" style="margin:0;">Post updates to the News page. Newest posts appear first.</p>

          <div style="display:flex; flex-direction:column; gap:10px; margin-top:10px;">
            <label class="tiny muted">News title</label>
            <input id="admin-news-title" type="text" placeholder="Event 1 – Donington Summary"
              style="padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);" />

            <label class="tiny muted">News content</label>
            <textarea id="admin-news-content" rows="5" placeholder="Write your update here..."
              style="width:100%; padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);"></textarea>

            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:4px;">
              <button id="admin-news-save" class="tile">Post news</button>
              <button id="admin-news-reload" class="tile tinyBtn" type="button">Reload</button>
              <div id="admin-news-msg" class="tiny muted"></div>
            </div>
          </div>

          <div id="admin-news-list" style="margin-top:12px;"></div>
        </div>
      </div>  

            <div class="card" style="margin-top:12px;">
        <button type="button" class="admin-collapse-toggle" data-target="admin-maths-body" aria-expanded="false" style="width:100%; display:flex; justify-content:space-between; align-items:center; background:transparent; border:0; color:var(--text); padding:0; cursor:pointer;">
          <h2 style="margin:0;">Maths / Formula</h2>
          <span class="tiny muted" data-chevron>▸</span>
        </button>
        <div id="admin-maths-body" hidden style="margin-top:10px;">
          <p class="tiny muted" style="margin:0;">Read-only planning values for the next event. This does not alter locked historic results, values, points, budgets, or EP.</p>

          <div id="admin-maths-summary" class="note" style="margin-top:10px;">
            Loading maths summary…
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:12px;">
        <button type="button" class="admin-collapse-toggle" data-target="admin-star-drivers-body" aria-expanded="false" style="width:100%; display:flex; justify-content:space-between; align-items:center; background:transparent; border:0; color:var(--text); padding:0; cursor:pointer;">
          <h2 style="margin:0;">Star Drivers</h2>
          <span class="tiny muted" data-chevron>▸</span>
        </button>
        <div id="admin-star-drivers-body" hidden style="margin-top:10px;">
          <p class="tiny muted" style="margin:0;">Set the Underdog Driver (-20%) and Form Driver (+5%) for the currently selected event. Event 1 does not use Star Drivers.</p>

          <div style="display:flex; flex-direction:column; gap:10px; margin-top:10px;">
            <label class="tiny muted">Event</label>
            <select id="admin-star-drivers-event"
              style="padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);">
              <option value="">Loading events…</option>
            </select>
            <label class="tiny muted">Underdog Driver (Star Driver A)</label>
            <select id="admin-star-driver-a"
              style="padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);">
              <option value="">Loading drivers…</option>
            </select>

            <label class="tiny muted">Form Driver (Star Driver B)</label>
            <select id="admin-star-driver-b"
              style="padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);">
              <option value="">Loading drivers…</option>
            </select>

            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:4px;">
              <button id="admin-star-drivers-save" class="tile">Save Star Drivers</button>
              <button id="admin-star-drivers-reload" class="tile tinyBtn" type="button">Reload</button>
              <div id="admin-star-drivers-msg" class="tiny muted"></div>
            </div>
          </div>

          <div id="admin-star-drivers-current" class="note" style="margin-top:12px;">Loading current Star Drivers…</div>
        </div>
      </div>

      <div class="card" style="margin-top:12px;">
        <button type="button" class="admin-collapse-toggle" data-target="admin-submission-tracker-body" aria-expanded="false" style="width:100%; display:flex; justify-content:space-between; align-items:center; background:transparent; border:0; color:var(--text); padding:0; cursor:pointer;">
          <h2 style="margin:0;">Submission Tracker</h2>
          <span class="tiny muted" data-chevron>▸</span>
        </button>
        <div id="admin-submission-tracker-body" hidden style="margin-top:10px;">
        <p class="tiny muted">Quick visual check of which players have submitted for Events 1–10.</p>
        <div id="admin-submission-tracker-msg" class="tiny muted" style="margin-top:8px;">Loading…</div>
        <div id="admin-submission-tracker" style="margin-top:10px;"></div>
        </div>
      </div>

      <div class="card" style="margin-top:12px;">
        <button type="button" class="admin-collapse-toggle" data-target="admin-player-manager-body" aria-expanded="false" style="width:100%; display:flex; justify-content:space-between; align-items:center; background:transparent; border:0; color:var(--text); padding:0; cursor:pointer;">
          <h2 style="margin:0;">Player Manager</h2>
          <span class="tiny muted" data-chevron>▸</span>
        </button>
        <div id="admin-player-manager-body" hidden style="margin-top:10px;">
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
        </div>

      <div class="card" style="margin-top:12px;">
        <button type="button" class="admin-collapse-toggle" data-target="admin-driver-manager-body" aria-expanded="false" style="width:100%; display:flex; justify-content:space-between; align-items:center; background:transparent; border:0; color:var(--text); padding:0; cursor:pointer;">
          <h2 style="margin:0;">Driver Manager</h2>
          <span class="tiny muted" data-chevron>▸</span>
        </button>
        <div id="admin-driver-manager-body" hidden style="margin-top:10px;">
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
        </div>

      <div class="card" style="margin-top:12px;">
        <button type="button" class="admin-collapse-toggle" data-target="admin-results-entry-body" aria-expanded="true" style="width:100%; display:flex; justify-content:space-between; align-items:center; background:transparent; border:0; color:var(--text); padding:0; cursor:pointer;">
          <h2 style="margin:0;">Results Entry</h2>
          <span class="tiny muted" data-chevron>▾</span>
        </button>
        <div id="admin-results-entry-body" style="margin-top:10px;">
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
        </div>

      <button id="admin-logout" class="tile" style="margin-top:12px;">Logout</button>
      `
    );

    root.querySelector("#admin-logout")?.addEventListener("click", handleLogout);
    setupAdminCollapseToggles(root);
    loadAdminEventPicker(root);
    loadAdminDrivers(root);
    setupAdminHomeNews(root);
    setupAdminNewsManager(root);
    loadAdminMathsSummary(root);
    setupAdminStarDrivers(root);
    loadAdminSubmissionTracker(root);
    setupAdminPlayerManager(root);
    setupAdminDriverManager(root);
    renderQualifyingForm(root);
    renderRaceForms(root);
    renderResultsPreview(root);
  }



  function setupAdminCollapseToggles(root) {
    const toggles = root.querySelectorAll(".admin-collapse-toggle");
    toggles.forEach((btn) => {
      const targetId = btn.getAttribute("data-target");
      if (!targetId) return;
      const body = root.querySelector(`#${targetId}`);
      const chevron = btn.querySelector("[data-chevron]");
      if (!body) return;

      const sync = () => {
        const expanded = !body.hidden;
        btn.setAttribute("aria-expanded", expanded ? "true" : "false");
        if (chevron) chevron.textContent = expanded ? "▾" : "▸";
      };

      btn.onclick = () => {
        body.hidden = !body.hidden;
        sync();
      };

      sync();
    });
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
    window.loadAdminNewsManager = loadAdminNewsManager;
    window.setupAdminNewsManager = setupAdminNewsManager;
    window.loadAdminMathsSummary = loadAdminMathsSummary;
    window.loadAdminStarDrivers = loadAdminStarDrivers;
    window.setupAdminStarDrivers = setupAdminStarDrivers;
    window.loadAdminSubmissionTracker = loadAdminSubmissionTracker;

    async function loadAdminStarDrivers(root) {
    const selectA = root.querySelector("#admin-star-driver-a");
    const selectB = root.querySelector("#admin-star-driver-b");
    const currentBox = root.querySelector("#admin-star-drivers-current");
    const msg = root.querySelector("#admin-star-drivers-msg");
    const eventSelect = root.querySelector("#admin-star-drivers-event");

    if (!selectA || !selectB || !currentBox || !eventSelect) return;

    if (!window.btccDb) {
      if (msg) msg.textContent = "Database not ready.";
      return;
    }

    try {
      if (msg) msg.textContent = "Loading…";

      const [driversSnap, eventsSnap] = await Promise.all([
        window.btccDb.collection("drivers").orderBy("name").get(),
        window.btccDb.collection("events").orderBy("eventNo").get(),
      ]);

      const eventRows = eventsSnap.docs
        .map((doc) => {
          const d = doc.data() || {};
          const eventNo = Number(d.eventNo || 0);
          const venue = (d.venue || d.name || doc.id).toString();
          return {
            id: doc.id,
            data: d,
            eventNo,
            label: eventNo ? `Event ${eventNo} — ${venue}` : venue,
          };
        })
        .sort((a, b) => a.eventNo - b.eventNo);

      if (!eventRows.length) {
        eventSelect.innerHTML = `<option value="">No events found</option>`;
        selectA.innerHTML = `<option value="">No drivers available</option>`;
        selectB.innerHTML = `<option value="">No drivers available</option>`;
        currentBox.innerHTML = `No events available.`;
        if (msg) msg.textContent = "No events found.";
        return;
      }

      let selectedEventId = eventSelect.value;
      if (!selectedEventId) {
        const firstStarEvent = eventRows.find((row) => row.eventNo >= 2) || eventRows[0];
        selectedEventId = firstStarEvent?.id || "";
      }

      eventSelect.innerHTML = eventRows.map((ev) => {
        const selected = ev.id === selectedEventId ? " selected" : "";
        return `<option value="${ev.id}"${selected}>${ev.label}</option>`;
      }).join("");

      const selectedEvent = eventRows.find((ev) => ev.id === selectedEventId);
      if (!selectedEvent) {
        selectA.innerHTML = `<option value="">Select an event first</option>`;
        selectB.innerHTML = `<option value="">Select an event first</option>`;
        currentBox.innerHTML = `Select an event to manage Star Drivers.`;
        if (msg) msg.textContent = "Select an event.";
        return;
      }

      const eventData = selectedEvent.data || {};
      const eventNo = Number(eventData.eventNo || 0);
      const currentA = (eventData.starDriverAId || eventData.starDriverA || "").toString();
      const currentB = (eventData.starDriverBId || eventData.starDriverB || "").toString();

      const activeDrivers = driversSnap.docs
        .map((doc) => {
          const d = doc.data() || {};
          return {
            id: doc.id,
            name: (d.name || doc.id).toString(),
            active: d.active !== false,
          };
        })
        .filter((driver) => driver.active)
        .sort((a, b) => a.name.localeCompare(b.name));

      const buildOptions = (selectedId) => {
        return [
          `<option value="">Not set</option>`,
          ...activeDrivers.map((driver) => {
            const selected = driver.id === selectedId ? " selected" : "";
            return `<option value="${driver.id}"${selected}>${driver.name}</option>`;
          }),
        ].join("");
      };

      selectA.innerHTML = buildOptions(currentA);
      selectB.innerHTML = buildOptions(currentB);

      if (eventNo < 2) {
        selectA.disabled = true;
        selectB.disabled = true;
        currentBox.innerHTML = `Event 1 does not use Star Drivers.`;
      } else {
        selectA.disabled = false;
        selectB.disabled = false;

        const nameA = activeDrivers.find((driver) => driver.id === currentA)?.name || "Not set";
        const nameB = activeDrivers.find((driver) => driver.id === currentB)?.name || "Not set";

        currentBox.innerHTML = `
          <div class="tiny muted" style="line-height:1.6;">
            Current event: <strong style="color:var(--text);">Event ${eventNo}</strong><br>
            Underdog Driver: <strong style="color:var(--text);">${nameA}</strong><br>
            Form Driver: <strong style="color:var(--text);">${nameB}</strong>
          </div>
        `;
      }

      if (msg) msg.textContent = "Loaded.";
    } catch (err) {
      console.error("❌ loadAdminStarDrivers failed:", err);
      if (msg) msg.textContent = err?.message || "Failed to load Star Drivers.";
      currentBox.innerHTML = `<div class="tiny muted">Failed to load Star Drivers.</div>`;
    }
  }

  function setupAdminStarDrivers(root) {
    const saveBtn = root.querySelector("#admin-star-drivers-save");
    const reloadBtn = root.querySelector("#admin-star-drivers-reload");
    const selectA = root.querySelector("#admin-star-driver-a");
    const selectB = root.querySelector("#admin-star-driver-b");
    const msg = root.querySelector("#admin-star-drivers-msg");
    const eventSelect = root.querySelector("#admin-star-drivers-event");

    if (!saveBtn || !selectA || !selectB) return;

    const setMsg = (text) => {
      if (msg) msg.textContent = text;
    };

    const reload = async () => {
      await loadAdminStarDrivers(root);
    };

    eventSelect?.addEventListener("change", reload);

    reloadBtn?.addEventListener("click", async () => {
      reloadBtn.disabled = true;
      try {
        await reload();
      } finally {
        reloadBtn.disabled = false;
      }
    });

    saveBtn.addEventListener("click", async () => {
      if (!window.btccDb) {
        setMsg("Database not ready.");
        return;
      }

      const eventId = eventSelect?.value;
      if (!eventId) {
        setMsg("Select an event first.");
        return;
      }

      const aId = (selectA.value || "").trim();
      const bId = (selectB.value || "").trim();

      if (aId && bId && aId === bId) {
        setMsg("Underdog Driver and Form Driver must be different.");
        return;
      }

      try {
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving…";
        setMsg("");

        const eventRef = window.btccDb.collection("events").doc(eventId);
        const eventSnap = await eventRef.get();
        const eventData = eventSnap.exists ? (eventSnap.data() || {}) : {};
        const eventNo = Number(eventData.eventNo || 0);

        if (eventNo < 2) {
          setMsg("Event 1 does not use Star Drivers.");
          return;
        }

        await eventRef.set(
          {
            starDriverAId: aId || null,
            starDriverBId: bId || null,
          },
          { merge: true }
        );

        setMsg("Star Drivers saved.");
        await reload();
      } catch (err) {
        console.error("❌ saveAdminStarDrivers failed:", err);
        setMsg(err?.message || "Failed to save Star Drivers.");
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Star Drivers";
      }
    });

    if (eventSelect && !eventSelect.value) {
      window.btccDb.collection("events").orderBy("eventNo").get().then((snap) => {
        const rows = snap.docs
          .map((doc) => ({ id: doc.id, eventNo: Number(doc.data()?.eventNo || 0) }))
          .sort((a, b) => a.eventNo - b.eventNo);
        const firstStarEvent = rows.find((row) => row.eventNo >= 2) || rows[0];
        if (firstStarEvent) {
          eventSelect.value = firstStarEvent.id;
        }
        reload();
      }).catch(() => reload());
    } else {
      reload();
    }
  }
    window.runDriverValueEngineJ1 = runDriverValueEngineJ1;
    window.runPlayerBudgetEngineJ2 = runPlayerBudgetEngineJ2;
    window.runDriverTierEngineJ3 = runDriverTierEngineJ3;
    window.runBudgetBoostEngineJ4 = runBudgetBoostEngineJ4;

    async function loadAdminNewsManager(root) {
    const mount = root.querySelector("#admin-news-list");
    const msg = root.querySelector("#admin-news-msg");
    if (!mount) return;

    if (!window.btccDb) {
      if (msg) msg.textContent = "Database not ready.";
      mount.innerHTML = "";
      return;
    }

    try {
      if (msg) msg.textContent = "Loading…";

      const snap = await window.btccDb
        .collection("news")
        .orderBy("createdAt", "desc")
        .get();

      if (snap.empty) {
        mount.innerHTML = `<div class="note">No news posts yet.</div>`;
        if (msg) msg.textContent = "No saved news posts yet.";
        return;
      }

      mount.innerHTML = snap.docs.map((doc) => {
        const d = doc.data() || {};
        const rawCreatedBy = (d.createdBy || "admin").toString();
        const createdBy = rawCreatedBy.includes("@")
          ? "Dan"
          : rawCreatedBy.replace(/^"+|"+$/g, "").trim() || "Dan";
        const title = (d.title || "Untitled").toString().replace(/^"+|"+$/g, "").trim();
        const content = (d.content || "").toString().replace(/^"+|"+$/g, "").trim();
        const createdAt = d.createdAt && typeof d.createdAt.toDate === "function"
          ? d.createdAt.toDate().toLocaleString("en-GB")
          : "—";

        return `
          <div class="note" style="margin-top:10px;">
            <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
              <div style="min-width:0; flex:1;">
                <div style="font-weight:700; color:var(--text);">${title}</div>
                <div class="tiny muted" style="margin-top:4px;">${createdAt} • ${createdBy}</div>
                <div class="tiny muted" style="margin-top:8px; white-space:pre-line;">${content}</div>
              </div>
              <button type="button" class="tile tinyBtn admin-news-delete" data-news-id="${doc.id}" style="width:auto; min-width:88px; padding:8px 10px; flex:0 0 auto;">Delete</button>
            </div>
          </div>
        `;
      }).join("");

      if (msg) msg.textContent = `Loaded ${snap.size} news post(s).`;

      mount.querySelectorAll(".admin-news-delete").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const newsId = btn.getAttribute("data-news-id");
          if (!newsId || !window.btccDb) return;

          const confirmed = window.confirm("Delete this news post?");
          if (!confirmed) return;

          const previousText = btn.textContent;
          try {
            btn.disabled = true;
            btn.textContent = "Deleting…";
            if (msg) msg.textContent = "Deleting…";
            await window.btccDb.collection("news").doc(newsId).delete();
            if (msg) msg.textContent = "News post deleted.";
            await loadAdminNewsManager(root);
          } catch (err) {
            console.error("❌ delete news failed:", err);
            if (msg) msg.textContent = err?.message || "Failed to delete news post.";
            btn.disabled = false;
            btn.textContent = previousText;
          }
        });
      });
    } catch (err) {
      console.error("❌ loadAdminNewsManager failed:", err);
      if (msg) msg.textContent = err?.message || "Failed to load news posts.";
      mount.innerHTML = `<div class="note warnNote">Failed to load news posts.</div>`;
    }
  }

  function setupAdminNewsManager(root) {
    const saveBtn = root.querySelector("#admin-news-save");
    const reloadBtn = root.querySelector("#admin-news-reload");
    const titleEl = root.querySelector("#admin-news-title");
    const contentEl = root.querySelector("#admin-news-content");
    const msg = root.querySelector("#admin-news-msg");

    if (!saveBtn || !titleEl || !contentEl) return;

    const setMsg = (text) => {
      if (msg) msg.textContent = text;
    };

    saveBtn.addEventListener("click", async () => {
      if (!window.btccDb) {
        setMsg("Database not ready.");
        return;
      }

      const title = (titleEl.value || "").trim();
      const content = (contentEl.value || "").trim();

      if (!title || !content) {
        setMsg("Title and content are required.");
        return;
      }

      try {
        saveBtn.disabled = true;
        saveBtn.textContent = "Posting…";
        setMsg("");

        const user = firebase.auth().currentUser;
        const who = user?.displayName || "Dan";

        await window.btccDb.collection("news").add({
          title,
          content,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdBy: who,
        });

        titleEl.value = "";
        contentEl.value = "";
        setMsg("News posted.");
        await loadAdminNewsManager(root);
      } catch (err) {
        console.error("❌ admin news save failed:", err);
        setMsg(err?.message || "Failed to post news.");
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Post news";
      }
    });

    reloadBtn?.addEventListener("click", async () => {
      reloadBtn.disabled = true;
      try {
        await loadAdminNewsManager(root);
      } finally {
        reloadBtn.disabled = false;
      }
    });

    loadAdminNewsManager(root);
  }

    async function loadAdminMathsSummary(root) {
    const mount = root.querySelector("#admin-maths-summary");
    if (!mount) return;

    if (!window.btccDb) {
      mount.innerHTML = `<div class="tiny muted">Database not ready.</div>`;
      return;
    }

    if (typeof window.getPpvForActiveDriverCount !== "function") {
      mount.innerHTML = `<div class="tiny muted">PPV lookup is not available.</div>`;
      return;
    }

    if (typeof window.getTierSplitForActiveDriverCount !== "function") {
      mount.innerHTML = `<div class="tiny muted">Tier split lookup is not available.</div>`;
      return;
    }

    try {
      const driversSnap = await window.btccDb.collection("drivers").get();

      const activeDrivers = driversSnap.docs
        .map((doc) => {
          const d = doc.data() || {};
          return {
            id: doc.id,
            name: (d.name || doc.id).toString(),
            active: d.active !== false,
            value: Number(d.value || d.cost || d.price || 0),
          };
        })
        .filter((d) => d.active);

      const activeDriverCount = activeDrivers.length;
      if (!activeDriverCount) {
        mount.innerHTML = `<div class="tiny muted">No active drivers found.</div>`;
        return;
      }

      const tdv = activeDrivers.reduce((sum, d) => sum + Number(d.value || 0), 0);
      const ppv = window.getPpvForActiveDriverCount(activeDriverCount);
      const vv = tdv > 0 ? (ppv / tdv) : 0;
      const split = window.getTierSplitForActiveDriverCount(activeDriverCount);

      mount.innerHTML = `
        <div class="tiny muted" style="line-height:1.6;">
          Active drivers: <strong style="color:var(--text);">${activeDriverCount}</strong><br>
          PPV: <strong style="color:var(--text);">${ppv}</strong><br>
          Tier split: <strong style="color:var(--text);">${split.high} / ${split.middle} / ${split.low}</strong><br>
          TDV: <strong style="color:var(--text);">£${Number(window.roundMoney2 ? window.roundMoney2(tdv) : tdv).toFixed(2)}</strong><br>
          VV: <strong style="color:var(--text);">${Number(window.roundMoney2 ? window.roundMoney2(vv) : vv).toFixed(2)}</strong>
        </div>
      `;
    } catch (err) {
      console.error("❌ loadAdminMathsSummary failed:", err);
      mount.innerHTML = `<div class="tiny muted">${err?.message || "Failed to load maths summary."}</div>`;
    }
  }

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