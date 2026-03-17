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

  // ============================================================
  // SECTION 4B: RACE ENTRY UI (Race 1–3)
  // ============================================================
  function renderRaceForms(root) {
  const mount = root.querySelector("#admin-races-form");
  if (!mount) return;

  const eventId = root.__selectedEventId;
  const drivers = Array.isArray(root.__drivers) ? root.__drivers : [];

  if (!eventId) {
    mount.innerHTML = "";
    return;
  }

  if (drivers.length === 0) {
    mount.innerHTML = `
      <div class="note warnNote" style="margin-top:10px;">
        Drivers not loaded yet.
      </div>
    `;
    return;
  }

  const N = drivers.length;
  const options = drivers.map(d => `<option value="${d.id}">${d.name}</option>`).join("");

  const raceCard = (raceKey, title) => `
    <div class="card" style="margin-top:10px;">
      <h2 style="margin:0 0 6px 0;">${title} (UI only)</h2>
      <div class="tiny muted" style="margin-bottom:10px;">
        Event ID: <span class="tiny">${eventId}</span><br>
        Enter finishing order. Saving comes next.
      </div>

      <div id="admin-${raceKey}-validation" class="note warnNote" hidden></div>

      <div class="tiny muted" style="margin:10px 0 6px 0;">Classified finishers only. Leave remaining positions blank if there were DNFs / DNS / DSQs.</div>
      <div id="admin-${raceKey}-grid" style="display:flex; flex-direction:column; gap:10px;">
        ${Array.from({ length: N }).map((_, i) => {
          const pos = i + 1;
          return `
            <div style="display:flex; gap:10px; align-items:center;">
              <div style="min-width:64px;"><strong>P${pos}</strong></div>
              <select data-${raceKey}-pos="${pos}" style="flex:1; padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);">
                <option value="">—</option>
                ${options}
              </select>
            </div>
          `;
        }).join("")}
      </div>

      <div class="note" style="margin-top:10px;">
        <strong>Non-classified / special statuses</strong>
        <div class="tiny muted" style="margin-top:6px;">Use Ctrl/Cmd-click to select multiple drivers where needed.</div>

        <label class="tiny muted" style="display:block; margin-top:10px;">DNF</label>
        <select data-${raceKey}-dnf multiple size="6" style="width:100%; padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);">
          ${options}
        </select>

        <label class="tiny muted" style="display:block; margin-top:10px;">DNS</label>
        <select data-${raceKey}-dns multiple size="4" style="width:100%; padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);">
          ${options}
        </select>

        <label class="tiny muted" style="display:block; margin-top:10px;">DSQ</label>
        <select data-${raceKey}-dsq multiple size="4" style="width:100%; padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);">
          ${options}
        </select>
        <label class="tiny muted" style="display:block; margin-top:10px;">Fastest Lap awards (up to 3)</label>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <select data-${raceKey}-fl1 style="width:100%; padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);">
            <option value="">—</option>
            ${options}
          </select>
          <select data-${raceKey}-fl2 style="width:100%; padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);">
            <option value="">—</option>
            ${options}
          </select>
          <select data-${raceKey}-fl3 style="width:100%; padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);">
            <option value="">—</option>
            ${options}
          </select>
        </div>
        <div class="tiny muted" style="margin-top:6px;">Use up to 3 fastest-lap awards. The same driver may be selected more than once if they qualify in multiple categories. Fastest Lap may be awarded to a classified finisher or a DNF, but not DNS / DSQ.</div>
      </div>

      <button type="button" id="admin-${raceKey}-save" class="tile" style="margin-top:12px;" disabled>
        ${(raceKey === "race1" || raceKey === "race2" || raceKey === "race3") ? `Save ${title}` : `Save ${title} (next step)`}
      </button>
    </div>
  `;

  mount.innerHTML = `
    ${raceCard("race1", "Race 1")}
    ${raceCard("race2", "Race 2")}
    ${raceCard("race3", "Race 3")}
  `;

  const wireValidation = (raceKey) => {
    const validationEl = mount.querySelector(`#admin-${raceKey}-validation`);
    const saveBtn = mount.querySelector(`#admin-${raceKey}-save`);

    const validate = () => {
      const finishSelects = Array.from(mount.querySelectorAll(`select[data-${raceKey}-pos]`));
      const dnfSel = mount.querySelector(`select[data-${raceKey}-dnf]`);
      const dnsSel = mount.querySelector(`select[data-${raceKey}-dns]`);
      const dsqSel = mount.querySelector(`select[data-${raceKey}-dsq]`);
      const fl1Sel = mount.querySelector(`select[data-${raceKey}-fl1]`);
      const fl2Sel = mount.querySelector(`select[data-${raceKey}-fl2]`);
      const fl3Sel = mount.querySelector(`select[data-${raceKey}-fl3]`);

      const finishers = finishSelects.map(s => s.value || null);
      const classified = finishers.filter(Boolean);
      const dnfIds = dnfSel ? Array.from(dnfSel.selectedOptions).map(o => o.value).filter(Boolean) : [];
      const dnsIds = dnsSel ? Array.from(dnsSel.selectedOptions).map(o => o.value).filter(Boolean) : [];
      const dsqIds = dsqSel ? Array.from(dsqSel.selectedOptions).map(o => o.value).filter(Boolean) : [];
      const fastestLapDriverIds = [
        fl1Sel?.value || "",
        fl2Sel?.value || "",
        fl3Sel?.value || "",
      ].filter(Boolean);

      const issues = [];

      // Classified order must be contiguous from the top with no gaps.
      let seenBlank = false;
      finishers.forEach((v, idx) => {
        if (!v) seenBlank = true;
        if (v && seenBlank) issues.push(`Classified finishers must be entered in order with no gaps before P${idx + 1}.`);
      });

      const allAssigned = [...classified, ...dnfIds, ...dnsIds, ...dsqIds];
      const dupes = allAssigned.filter((v, idx) => allAssigned.indexOf(v) !== idx);
      if (dupes.length > 0) issues.push("A driver can only appear once across classified / DNF / DNS / DSQ.");

      if (classified.length === 0) issues.push("Enter at least one classified finisher.");

      if (fastestLapDriverIds.length > 3) issues.push("Fastest Lap can have a maximum of 3 awards.");
      fastestLapDriverIds.forEach((driverId) => {
        const flAllowed = classified.includes(driverId) || dnfIds.includes(driverId);
        if (!flAllowed) issues.push("Fastest Lap must belong to a classified finisher or a DNF (not DNS / DSQ).");
      });

      const valid = issues.length === 0;

      if (validationEl) {
        if (valid) validationEl.hidden = true;
        else {
          validationEl.hidden = false;
          validationEl.innerHTML = `<strong>Fix this:</strong><br><span class="tiny muted">${issues.join("<br>")}</span>`;
        }
      }

      if (saveBtn) saveBtn.disabled = !valid;

      const draft = {
        positions: finishers,
        classified,
        status: {
          FIN: classified,
          DNF: dnfIds,
          DNS: dnsIds,
          DSQ: dsqIds,
        },
        fastestLapDriverIds,
      };

      if (raceKey === "race1") root.__draftRace1 = draft;
      if (raceKey === "race2") root.__draftRace2 = draft;
      if (raceKey === "race3") root.__draftRace3 = draft;
      renderResultsPreview(root);
    };

    mount.querySelectorAll(`select[data-${raceKey}-pos], select[data-${raceKey}-dnf], select[data-${raceKey}-dns], select[data-${raceKey}-dsq], select[data-${raceKey}-fl1], select[data-${raceKey}-fl2], select[data-${raceKey}-fl3]`).forEach(sel => {
      sel.addEventListener("change", validate);
    });

    validate();

    // H6.2: Save Race 1 only (Race 2/3 remain UI-only)
    if (raceKey === "race1" && saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const validationEl2 = mount.querySelector(`#admin-${raceKey}-validation`);

        // Guards
        if (!window.btccDb) {
          if (validationEl2) {
            validationEl2.hidden = false;
            validationEl2.innerHTML = `<strong>Save failed.</strong><br><span class="tiny muted">Database not ready.</span>`;
          }
          return;
        }

        const eid = root.__selectedEventId;
        if (!eid) return;

        // Enforce lock
        if (root.__eventMeta?.resultsLocked === true) {
          if (validationEl2) {
            validationEl2.hidden = false;
            validationEl2.innerHTML = `<strong>Locked:</strong><br><span class="tiny muted">Results are locked for this event.</span>`;
          }
          return;
        }

        // Read draft
        const draft = root.__draftRace1 && typeof root.__draftRace1 === "object"
          ? root.__draftRace1
          : { positions: [], classified: [], status: { FIN: [], DNF: [], DNS: [], DSQ: [] }, fastestLapDriverIds: [] };

        const classified = Array.isArray(draft.classified) ? draft.classified : [];
        const status = draft.status || { FIN: [], DNF: [], DNS: [], DSQ: [] };
        const fastestLapDriverIds = Array.isArray(draft.fastestLapDriverIds) ? draft.fastestLapDriverIds : [];

        if (!classified.length) {
          if (validationEl2) {
            validationEl2.hidden = false;
            validationEl2.innerHTML = `<strong>Fix this:</strong><br><span class="tiny muted">Please enter at least one classified finisher and resolve any validation issues.</span>`;
          }
          return;
        }

        try {
          saveBtn.disabled = true;
          saveBtn.textContent = "Saving…";

          const resultsRef = window.btccDb.collection("results").doc(eid);
          await resultsRef.set(
            {
              race1: classified,
              race1Positions: Array.isArray(draft.positions) ? draft.positions : [],
              race1Status: status,
              race1FastestLapDriverIds: fastestLapDriverIds,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          const user = firebase.auth().currentUser;
          const who = user?.email || "admin";

          await window.btccDb.collection("events").doc(eid).set(
            {
              resultsUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              resultsUpdatedBy: who,
            },
            { merge: true }
          );

          // Refresh saved results for preview panel
          await loadSelectedEventMetaAndResults(root);

          saveBtn.textContent = `Saved ${new Date().toLocaleString("en-GB")}`;
          console.log("✅ Race 1 saved:", eid, classified, status, fastestLapDriverIds);
        } catch (err) {
          console.error("❌ Save Race 1 failed:", err);
          if (validationEl2) {
            validationEl2.hidden = false;
            validationEl2.innerHTML = `<strong>Save failed.</strong><br><span class="tiny muted">${err?.message || err}</span>`;
          }
          saveBtn.textContent = "Save Race 1";
        } finally {
          saveBtn.disabled = false;
        }
      });
    }

    // H6.3: Save Race 2 (Race 3 remains UI-only)
    if (raceKey === "race2" && saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const validationEl2 = mount.querySelector(`#admin-${raceKey}-validation`);

        // Guards
        if (!window.btccDb) {
          if (validationEl2) {
            validationEl2.hidden = false;
            validationEl2.innerHTML = `<strong>Save failed.</strong><br><span class="tiny muted">Database not ready.</span>`;
          }
          return;
        }

        const eid = root.__selectedEventId;
        if (!eid) return;

        // Enforce lock
        if (root.__eventMeta?.resultsLocked === true) {
          if (validationEl2) {
            validationEl2.hidden = false;
            validationEl2.innerHTML = `<strong>Locked:</strong><br><span class="tiny muted">Results are locked for this event.</span>`;
          }
          return;
        }

        // Read draft
        const draft = root.__draftRace2 && typeof root.__draftRace2 === "object"
          ? root.__draftRace2
          : { positions: [], classified: [], status: { FIN: [], DNF: [], DNS: [], DSQ: [] }, fastestLapDriverIds: [] };

        const classified = Array.isArray(draft.classified) ? draft.classified : [];
        const status = draft.status || { FIN: [], DNF: [], DNS: [], DSQ: [] };
        const fastestLapDriverIds = Array.isArray(draft.fastestLapDriverIds) ? draft.fastestLapDriverIds : [];

        if (!classified.length) {
          if (validationEl2) {
            validationEl2.hidden = false;
            validationEl2.innerHTML = `<strong>Fix this:</strong><br><span class="tiny muted">Please enter at least one classified finisher and resolve any validation issues.</span>`;
          }
          return;
        }

        try {
          saveBtn.disabled = true;
          saveBtn.textContent = "Saving…";

          const resultsRef = window.btccDb.collection("results").doc(eid);
          await resultsRef.set(
            {
              race2: classified,
              race2Positions: Array.isArray(draft.positions) ? draft.positions : [],
              race2Status: status,
              race2FastestLapDriverIds: fastestLapDriverIds,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          const user = firebase.auth().currentUser;
          const who = user?.email || "admin";

          await window.btccDb.collection("events").doc(eid).set(
            {
              resultsUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              resultsUpdatedBy: who,
            },
            { merge: true }
          );

          // Refresh saved results for preview panel
          await loadSelectedEventMetaAndResults(root);

          saveBtn.textContent = `Saved ${new Date().toLocaleString("en-GB")}`;
          console.log("✅ Race 2 saved:", eid, classified, status, fastestLapDriverIds);
        } catch (err) {
          console.error("❌ Save Race 2 failed:", err);
          if (validationEl2) {
            validationEl2.hidden = false;
            validationEl2.innerHTML = `<strong>Save failed.</strong><br><span class="tiny muted">${err?.message || err}</span>`;
          }
          saveBtn.textContent = "Save Race 2";
        } finally {
          saveBtn.disabled = false;
        }
      });
    }
    // H6.4: Save Race 3
    if (raceKey === "race3" && saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const validationEl2 = mount.querySelector(`#admin-${raceKey}-validation`);

        // Guards
        if (!window.btccDb) {
          if (validationEl2) {
            validationEl2.hidden = false;
            validationEl2.innerHTML = `<strong>Save failed.</strong><br><span class="tiny muted">Database not ready.</span>`;
          }
          return;
        }

        const eid = root.__selectedEventId;
        if (!eid) return;

        // Enforce lock
        if (root.__eventMeta?.resultsLocked === true) {
          if (validationEl2) {
            validationEl2.hidden = false;
            validationEl2.innerHTML = `<strong>Locked:</strong><br><span class="tiny muted">Results are locked for this event.</span>`;
          }
          return;
        }

        // Read draft
        const draft = root.__draftRace3 && typeof root.__draftRace3 === "object"
          ? root.__draftRace3
          : { positions: [], classified: [], status: { FIN: [], DNF: [], DNS: [], DSQ: [] }, fastestLapDriverIds: [] };

        const classified = Array.isArray(draft.classified) ? draft.classified : [];
        const status = draft.status || { FIN: [], DNF: [], DNS: [], DSQ: [] };
        const fastestLapDriverIds = Array.isArray(draft.fastestLapDriverIds) ? draft.fastestLapDriverIds : [];

        if (!classified.length) {
          if (validationEl2) {
            validationEl2.hidden = false;
            validationEl2.innerHTML = `<strong>Fix this:</strong><br><span class="tiny muted">Please enter at least one classified finisher and resolve any validation issues.</span>`;
          }
          return;
        }

        try {
          saveBtn.disabled = true;
          saveBtn.textContent = "Saving…";

          const resultsRef = window.btccDb.collection("results").doc(eid);
          await resultsRef.set(
            {
              race3: classified,
              race3Positions: Array.isArray(draft.positions) ? draft.positions : [],
              race3Status: status,
              race3FastestLapDriverIds: fastestLapDriverIds,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          const user = firebase.auth().currentUser;
          const who = user?.email || "admin";

          await window.btccDb.collection("events").doc(eid).set(
            {
              resultsUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              resultsUpdatedBy: who,
            },
            { merge: true }
          );

          // Refresh saved results for preview panel
          await loadSelectedEventMetaAndResults(root);

          saveBtn.textContent = `Saved ${new Date().toLocaleString("en-GB")}`;
          console.log("✅ Race 3 saved:", eid, classified, status, fastestLapDriverIds);
        } catch (err) {
          console.error("❌ Save Race 3 failed:", err);
          if (validationEl2) {
            validationEl2.hidden = false;
            validationEl2.innerHTML = `<strong>Save failed.</strong><br><span class="tiny muted">${err?.message || err}</span>`;
          }
          saveBtn.textContent = "Save Race 3";
        } finally {
          saveBtn.disabled = false;
        }
      });
    }
  };

  wireValidation("race1");
  wireValidation("race2");
  wireValidation("race3");

  // H7.3 — disable race inputs if locked
  if (root.__eventMeta?.resultsLocked === true) {
    mount.querySelectorAll("select").forEach(s => s.disabled = true);
    mount.querySelectorAll("button[id$='-save']").forEach(b => b.disabled = true);
  }
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

  // --- H7.1: Admin Results Preview panel (read-only, no lock/unlock writes) ---
  // ============================================================
  // SECTION 5: RESULTS PREVIEW + LOCK / UNLOCK (H7)
  // ============================================================
  async function loadSelectedEventMetaAndResults(root) {
  const eventId = root.__selectedEventId;
  if (!eventId) {
    root.__eventMeta = null;
    root.__savedResults = null;
    renderResultsPreview(root);
    return;
  }

  if (!window.btccDb) {
    root.__eventMeta = null;
    root.__savedResults = null;
    renderResultsPreview(root);
    return;
  }

  try {
    const [eventSnap, resultsSnap] = await Promise.all([
      window.btccDb.collection("events").doc(eventId).get(),
      window.btccDb.collection("results").doc(eventId).get(),
    ]);

    root.__eventMeta = eventSnap.exists ? (eventSnap.data() || {}) : null;
    root.__savedResults = resultsSnap.exists ? (resultsSnap.data() || {}) : null;

    // NOTE: H7.1 is preview only; we do NOT enforce lock behaviour yet.
    renderResultsPreview(root);
    loadAdminSubmissionTracker(root);
  } catch (err) {
    console.error("❌ loadSelectedEventMetaAndResults failed:", err);
    root.__eventMeta = null;
    root.__savedResults = null;
    renderResultsPreview(root, err);
    loadAdminSubmissionTracker(root);
  }
} 

  function renderResultsPreview(root, err) {
    const mount = root.querySelector("#admin-results-preview");
    if (!mount) return;

    const eventId = root.__selectedEventId;
    const drivers = Array.isArray(root.__drivers) ? root.__drivers : [];
    const driverNameById = new Map(drivers.map((d) => [d.id, d.name]));

    const meta = root.__eventMeta || null;
    const saved = root.__savedResults || null;

    const fmtTs = (v) => {
      try {
        if (!v) return "—";
        if (typeof v.toDate === "function") return v.toDate().toLocaleString("en-GB");
        const d = new Date(v);
        if (!isNaN(d)) return d.toLocaleString("en-GB");
        return String(v);
      } catch {
        return "—";
      }
    };

    const idsToNames = (arr) => {
      const list = Array.isArray(arr) ? arr : [];
      return list.map((id) => driverNameById.get(id) || (id ? `Unknown (${id})` : "—"));
    };

    // Choose source: saved if present, otherwise drafts
    const qualiIds = (saved && Array.isArray(saved.qualifying) && saved.qualifying.length)
      ? saved.qualifying
      : ((root.__draftQuali && Array.isArray(root.__draftQuali.classified)) ? root.__draftQuali.classified : []);

    const race1Ids = (saved && Array.isArray(saved.race1) && saved.race1.length)
      ? saved.race1
      : ((root.__draftRace1 && Array.isArray(root.__draftRace1.classified)) ? root.__draftRace1.classified : []);

    const race2Ids = (saved && Array.isArray(saved.race2) && saved.race2.length)
      ? saved.race2
      : ((root.__draftRace2 && Array.isArray(root.__draftRace2.classified)) ? root.__draftRace2.classified : []);

    const race3Ids = (saved && Array.isArray(saved.race3) && saved.race3.length)
      ? saved.race3
      : ((root.__draftRace3 && Array.isArray(root.__draftRace3.classified)) ? root.__draftRace3.classified : []);

    const qualiStatus = (saved && saved.qualifyingStatus && typeof saved.qualifyingStatus === "object")
      ? saved.qualifyingStatus
      : ((root.__draftQuali && root.__draftQuali.status && typeof root.__draftQuali.status === "object") ? root.__draftQuali.status : { FIN: [], DNF: [], DNS: [], DSQ: [] });

    const race1Status = (saved && saved.race1Status && typeof saved.race1Status === "object")
      ? saved.race1Status
      : ((root.__draftRace1 && root.__draftRace1.status && typeof root.__draftRace1.status === "object") ? root.__draftRace1.status : { FIN: [], DNF: [], DNS: [], DSQ: [] });

    const race2Status = (saved && saved.race2Status && typeof saved.race2Status === "object")
      ? saved.race2Status
      : ((root.__draftRace2 && root.__draftRace2.status && typeof root.__draftRace2.status === "object") ? root.__draftRace2.status : { FIN: [], DNF: [], DNS: [], DSQ: [] });

    const race3Status = (saved && saved.race3Status && typeof saved.race3Status === "object")
      ? saved.race3Status
      : ((root.__draftRace3 && root.__draftRace3.status && typeof root.__draftRace3.status === "object") ? root.__draftRace3.status : { FIN: [], DNF: [], DNS: [], DSQ: [] });

    const race1FastestLapIds = (saved && Array.isArray(saved.race1FastestLapDriverIds))
      ? saved.race1FastestLapDriverIds
      : ((root.__draftRace1 && Array.isArray(root.__draftRace1.fastestLapDriverIds)) ? root.__draftRace1.fastestLapDriverIds : []);

    const race2FastestLapIds = (saved && Array.isArray(saved.race2FastestLapDriverIds))
      ? saved.race2FastestLapDriverIds
      : ((root.__draftRace2 && Array.isArray(root.__draftRace2.fastestLapDriverIds)) ? root.__draftRace2.fastestLapDriverIds : []);

    const race3FastestLapIds = (saved && Array.isArray(saved.race3FastestLapDriverIds))
      ? saved.race3FastestLapDriverIds
      : ((root.__draftRace3 && Array.isArray(root.__draftRace3.fastestLapDriverIds)) ? root.__draftRace3.fastestLapDriverIds : []);

    const qualiNames = idsToNames(qualiIds);
    const race1Names = idsToNames(race1Ids);
    const race2Names = idsToNames(race2Ids);
    const race3Names = idsToNames(race3Ids);

    const statusNames = (statusObj, key) => idsToNames(Array.isArray(statusObj?.[key]) ? statusObj[key] : []);
    const qualiDnfNames = statusNames(qualiStatus, "DNF");
    const qualiDnsNames = statusNames(qualiStatus, "DNS");
    const qualiDsqNames = statusNames(qualiStatus, "DSQ");

    const race1DnfNames = statusNames(race1Status, "DNF");
    const race1DnsNames = statusNames(race1Status, "DNS");
    const race1DsqNames = statusNames(race1Status, "DSQ");

    const race2DnfNames = statusNames(race2Status, "DNF");
    const race2DnsNames = statusNames(race2Status, "DNS");
    const race2DsqNames = statusNames(race2Status, "DSQ");

    const race3DnfNames = statusNames(race3Status, "DNF");
    const race3DnsNames = statusNames(race3Status, "DNS");
    const race3DsqNames = statusNames(race3Status, "DSQ");

    const race1FastestLapNames = idsToNames(race1FastestLapIds);
    const race2FastestLapNames = idsToNames(race2FastestLapIds);
    const race3FastestLapNames = idsToNames(race3FastestLapIds);

    if (!eventId) {
      mount.innerHTML = `
        <div class="card" style="margin-top:10px;">
          <h2 style="margin:0 0 6px 0;">Preview Results</h2>
          <div class="tiny muted">Select an event above to preview Qualifying and Race results before locking.</div>
        </div>
      `;
      return;
    }

    if (drivers.length === 0) {
      mount.innerHTML = `
        <div class="card" style="margin-top:10px;">
          <h2 style="margin:0 0 6px 0;">Preview Results</h2>
          <div class="tiny muted">Loading drivers…</div>
        </div>
      `;
      return;
    }

    const status = meta?.status || "—";
    const locked = meta?.resultsLocked === true ? "Yes" : "No";
    const banner = root.querySelector("#admin-lock-banner");
if (banner) {
  if (meta?.resultsLocked === true) {
    banner.hidden = false;
    banner.innerHTML = `<strong>LOCKED:</strong><br><span class="tiny muted">This event is locked. Editing is disabled.</span>`;
  } else {
    banner.hidden = true;
    banner.innerHTML = "";
  }
}
    const updatedAt = fmtTs(meta?.resultsUpdatedAt);
    const updatedBy = meta?.resultsUpdatedBy || "—";
    const savedUpdatedAt = fmtTs(saved?.updatedAt);

    const renderListBlock = (label, names, ordered = false) => {
      const list = Array.isArray(names) ? names.filter(Boolean) : [];
      if (!list.length) return "";
      return `
        <div style="margin-top:10px;">
          <div class="tiny muted" style="margin-bottom:6px;"><strong>${label}</strong></div>
          <div style="border:1px solid var(--border); border-radius:10px; padding:10px; background:rgba(255,255,255,.02);">
            ${ordered
              ? `<ol class="list" style="margin:0; padding-left:18px;">${list.map((n, i) => `<li class="tiny" style="margin:6px 0;">${i + 1}. ${n}</li>`).join("")}</ol>`
              : `<ul class="list" style="margin:0; padding-left:18px;">${list.map((n) => `<li class="tiny" style="margin:6px 0;">${n}</li>`).join("")}</ul>`}
          </div>
        </div>
      `;
    };

    const section = (title, cfg) => {
      const orderedNames = Array.isArray(cfg?.orderedNames) ? cfg.orderedNames : [];
      const dnfNames = Array.isArray(cfg?.dnfNames) ? cfg.dnfNames : [];
      const dnsNames = Array.isArray(cfg?.dnsNames) ? cfg.dnsNames : [];
      const dsqNames = Array.isArray(cfg?.dsqNames) ? cfg.dsqNames : [];
      const fastestLapNames = Array.isArray(cfg?.fastestLapNames) ? cfg.fastestLapNames : [];

      const hasAnything = [orderedNames, dnfNames, dnsNames, dsqNames, fastestLapNames].some(arr => Array.isArray(arr) && arr.length > 0);

      return `
        <div class="note" style="margin-top:10px;">
          <strong>${title}</strong>
          <div class="tiny muted" style="margin-top:6px;">${hasAnything ? "Expanded preview." : "Not available yet."}</div>
          ${renderListBlock("Classified order", orderedNames, true)}
          ${renderListBlock("DNF", dnfNames)}
          ${renderListBlock("DNS", dnsNames)}
          ${renderListBlock("DSQ", dsqNames)}
          ${renderListBlock("Fastest Lap awards", fastestLapNames)}
        </div>
      `;
    };

    mount.innerHTML = `
      <div class="card" style="margin-top:10px;">
        <h2 style="margin:0 0 6px 0;">Preview Results</h2>
        <div class="tiny muted" style="margin-bottom:10px;">
          Event ID: <span class="tiny">${eventId}</span><br>
          Status: <span class="tiny">${status}</span> • Locked: <span class="tiny">${locked}</span><br>
          Last updated: <span class="tiny">${updatedAt}</span> by <span class="tiny">${updatedBy}</span><br>
          Results doc updatedAt: <span class="tiny">${savedUpdatedAt}</span>
        </div>
        ${err ? `<div class="note warnNote"><strong>Preview note:</strong><br><span class="tiny muted">${err?.message || err}</span></div>` : ""}
        ${section("Qualifying", {
          orderedNames: qualiNames,
          dnfNames: qualiDnfNames,
          dnsNames: qualiDnsNames,
          dsqNames: qualiDsqNames,
        })}
        ${section("Race 1", {
          orderedNames: race1Names,
          dnfNames: race1DnfNames,
          dnsNames: race1DnsNames,
          dsqNames: race1DsqNames,
          fastestLapNames: race1FastestLapNames,
        })}
        ${section("Race 2", {
          orderedNames: race2Names,
          dnfNames: race2DnfNames,
          dnsNames: race2DnsNames,
          dsqNames: race2DsqNames,
          fastestLapNames: race2FastestLapNames,
        })}
        ${section("Race 3", {
          orderedNames: race3Names,
          dnfNames: race3DnfNames,
          dnsNames: race3DnsNames,
          dsqNames: race3DsqNames,
          fastestLapNames: race3FastestLapNames,
        })}
        <div id="admin-lock-msg" class="note warnNote" hidden style="margin-top:12px;"></div>

        ${meta?.resultsLocked === true
          ? `
            <div class="note" style="margin-top:12px;">
              <strong>Locked</strong><br>
              <span class="tiny muted">Editing is disabled. Use Unlock only if you must correct something.</span>
            </div>

            <div class="note warnNote" style="margin-top:10px;">
              <strong>Unlock (requires reason)</strong>
              <div class="tiny muted" style="margin-top:6px;">This will re-enable editing and will be recorded in the event audit fields.</div>
              <label class="tiny muted" style="display:block; margin-top:10px;">Reason</label>
              <textarea id="admin-unlock-reason" rows="3" style="width:100%; padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);" placeholder="e.g. Correction: wrong driver in P3 of Race 2"></textarea>
              <button type="button" id="admin-unlock-results" class="tile" style="margin-top:10px;">Unlock results</button>
              <div id="admin-unlock-msg" class="tiny" style="margin-top:8px; color:#facc15;"></div>
            </div>
          `
          : `<button type="button" id="admin-lock-results" class="tile" style="margin-top:12px;">Lock results (set complete)</button>`
        }

        <div class="tiny muted" style="margin-top:10px;">H7.4 records unlock reason + timestamp on events/${eventId}.</div>

        <div class="card" style="margin-top:12px;">
          <h2 style="margin:0 0 6px 0;">Engine (Phase I)</h2>
          <div class="tiny muted" style="margin:0;">
            Runs scoring for the selected event (writes overwrite-safe to event_scores), then rebuilds season standings from event_scores.
          </div>
          <button type="button" id="admin-run-engine-i1" class="tile" style="margin-top:10px;">
            Run engine for selected event
          </button>
          <div id="admin-engine-msg" class="tiny muted" style="margin-top:8px;"></div>
          <button type="button" id="admin-refresh-event-scores" class="tile tinyBtn" style="margin-top:10px;">Refresh event scores</button>
          <div id="admin-event-scores-preview" class="note" style="margin-top:10px;" hidden></div>
          <div class="note" style="margin-top:12px;">
            <strong>Standings rebuild (I3)</strong><br>
            <span class="tiny muted">Rebuilds season standings from event_scores for events up to the selected event (overwrite-safe).</span>
            <button type="button" id="admin-rebuild-standings-i3" class="tile" style="margin-top:10px;">Rebuild PLAYER standings up to selected event</button>
            <div id="admin-standings-msg" class="tiny muted" style="margin-top:8px;"></div>
            <button type="button" id="admin-refresh-standings" class="tile tinyBtn" style="margin-top:10px;">Refresh player standings preview</button>
            <div id="admin-standings-preview" class="note" style="margin-top:10px;" hidden></div>

            <div style="height:10px;"></div>

            <strong>Teams standings rebuild (I3.2)</strong><br>
            <span class="tiny muted">Aggregates player standings into team totals (sum of players in the same teamId). Overwrite-safe.</span>
            <button type="button" id="admin-rebuild-teams-i3" class="tile" style="margin-top:10px;">Rebuild TEAM standings up to selected event</button>
            <div id="admin-teams-msg" class="tiny muted" style="margin-top:8px;"></div>
            <button type="button" id="admin-refresh-teams" class="tile tinyBtn" style="margin-top:10px;">Refresh teams standings preview</button>
            <div id="admin-teams-preview" class="note" style="margin-top:10px;" hidden></div>

            <div style="height:10px;"></div>

            <strong>Driver standings rebuild (I3.3)</strong><br>
            <span class="tiny muted">Aggregates fantasy driver points from event_scores, ranks drivers, and assigns tiers using the 7 / 10 / 7 split for Event 2+.</span>
            <button type="button" id="admin-rebuild-drivers-i3" class="tile" style="margin-top:10px;">Rebuild DRIVER standings up to selected event</button>
            <div id="admin-drivers-standings-msg" class="tiny muted" style="margin-top:8px;"></div>
            <button type="button" id="admin-refresh-drivers-standings" class="tile tinyBtn" style="margin-top:10px;">Refresh driver standings preview</button>
            <div id="admin-drivers-standings-preview" class="note" style="margin-top:10px;" hidden></div>

            <div style="height:10px;"></div>

            <strong>Wingfoot standings rebuild (I3.4)</strong><br>
            <span class="tiny muted">Builds qualifying-only player standings using full qualifying scoring (1st = 24 down to 24th = 1) from results and entries up to the selected event.</span>
            <button type="button" id="admin-rebuild-wingfoot-i3" class="tile" style="margin-top:10px;">Rebuild WINGFOOT standings up to selected event</button>
            <div id="admin-wingfoot-msg" class="tiny muted" style="margin-top:8px;"></div>
            <button type="button" id="admin-refresh-wingfoot" class="tile tinyBtn" style="margin-top:10px;">Refresh Wingfoot preview</button>
            <div id="admin-wingfoot-preview" class="note" style="margin-top:10px;" hidden></div>
          </div>
        </div>
      </div>
    `;

    // I1.4: Event scores preview (read-only)
    const scoresBtn = mount.querySelector("#admin-refresh-event-scores");
    if (scoresBtn) {
      scoresBtn.onclick = async () => {
        await loadEventScoresPreview(root);
      };
    }
    // Standings preview (I3)
    const standingsRefreshBtn = mount.querySelector("#admin-refresh-standings");
    if (standingsRefreshBtn) {
      standingsRefreshBtn.onclick = async () => {
        await loadStandingsPlayersPreview(root);
      };
    }
    // Teams standings preview (I3.2)
    const teamsRefreshBtn = mount.querySelector("#admin-refresh-teams");
    if (teamsRefreshBtn) {
      teamsRefreshBtn.onclick = async () => {
        await loadStandingsTeamsPreview(root);
      };
    }
    // Driver standings preview (I3.3)
    const driversRefreshBtn = mount.querySelector("#admin-refresh-drivers-standings");
    if (driversRefreshBtn) {
      driversRefreshBtn.onclick = async () => {
        await loadStandingsDriversPreview(root);
      };
    }
    const wingfootRefreshBtn = mount.querySelector("#admin-refresh-wingfoot");
    if (wingfootRefreshBtn) {
      wingfootRefreshBtn.onclick = async () => {
        await loadStandingsWingfootPreview(root);
      };
    }
    // Auto-refresh preview when panel renders (best-effort)
    loadEventScoresPreview(root);
    loadStandingsPlayersPreview(root);
    loadStandingsTeamsPreview(root);
    loadStandingsDriversPreview(root);
    loadStandingsWingfootPreview(root);

    // H7.2: Lock results (writes to events/{eventId})
    const lockBtn = mount.querySelector("#admin-lock-results");
    const lockMsg = mount.querySelector("#admin-lock-msg");

    if (lockBtn) {
      lockBtn.onclick = async () => {
        if (!window.btccDb) return;
        const eid = root.__selectedEventId;
        if (!eid) return;

        const ok = window.confirm("Lock results for this event? This will mark the event as COMPLETE.\n\n(You can unlock later with a reason.)");
        if (!ok) return;

        try {
          lockBtn.disabled = true;
          lockBtn.textContent = "Locking…";
          if (lockMsg) { lockMsg.hidden = true; lockMsg.innerHTML = ""; }

          const user = firebase.auth().currentUser;
          const who = user?.email || "admin";

          await window.btccDb.collection("events").doc(eid).set(
            {
              resultsLocked: true,
              status: "complete",
              resultsLockedAt: firebase.firestore.FieldValue.serverTimestamp(),
              resultsLockedBy: who,
            },
            { merge: true }
          );

          // Refresh preview/meta from Firestore
          root.__eventLocked = true;
          await loadSelectedEventMetaAndResults(root);

          console.log("✅ Results locked:", eid);
        } catch (e) {
          console.error("❌ Lock results failed:", e);
          if (lockMsg) {
            lockMsg.hidden = false;
            lockMsg.innerHTML = `<strong>Lock failed.</strong><br><span class=\"tiny muted\">${e?.message || e}</span>`;
          }
          lockBtn.textContent = "Lock results (set complete)";
        } finally {
          lockBtn.disabled = false;
        }
      };
    }

    // H7.4: Unlock results (requires reason)
    const unlockBtn = mount.querySelector("#admin-unlock-results");
    const unlockReason = mount.querySelector("#admin-unlock-reason");
    const unlockMsg = mount.querySelector("#admin-unlock-msg");

    if (unlockBtn) {
      unlockBtn.onclick = async () => {
        if (!window.btccDb) return;
        const eid = root.__selectedEventId;
        if (!eid) return;

        const reason = (unlockReason?.value || "").trim();
        if (!reason) {
          if (unlockMsg) unlockMsg.textContent = "Please enter a reason before unlocking.";
          return;
        }

        const ok = window.confirm("Unlock results for this event?\n\nThis will re-enable editing and record your reason in Firestore.");
        if (!ok) return;

        try {
          unlockBtn.disabled = true;
          unlockBtn.textContent = "Unlocking…";
          if (unlockMsg) unlockMsg.textContent = "";

          const user = firebase.auth().currentUser;
          const who = user?.email || "admin";

          await window.btccDb.collection("events").doc(eid).set(
            {
              resultsLocked: false,
              resultsUnlockedAt: firebase.firestore.FieldValue.serverTimestamp(),
              resultsUnlockedBy: who,
              resultsUnlockReason: reason,
            },
            { merge: true }
          );

          // Refresh meta/results and re-render forms (H7.3 will enable inputs)
          root.__eventLocked = false;
          await loadSelectedEventMetaAndResults(root);
          renderQualifyingForm(root);
          renderRaceForms(root);

          console.log("✅ Results unlocked:", eid);
        } catch (e) {
          console.error("❌ Unlock results failed:", e);
          if (unlockMsg) unlockMsg.textContent = e?.message || String(e);
        } finally {
          unlockBtn.disabled = false;
          unlockBtn.textContent = "Unlock results";
        }
      };
    }

    // ============================================================
    // SECTION 6: ENGINE (Phase I – Event Scoring)
    // ============================================================
    // I1.2: Engine dry run (read-only)
    const engineBtn = mount.querySelector("#admin-run-engine-i1");
    const engineMsg = mount.querySelector("#admin-engine-msg");
    const setEngineMsg = (t) => {
      if (engineMsg) engineMsg.textContent = t;
    };
    // Standings rebuild (I3)
    const standingsBtn = mount.querySelector("#admin-rebuild-standings-i3");
    const standingsMsg = mount.querySelector("#admin-standings-msg");
    const setStandingsMsg = (t) => {
      if (standingsMsg) standingsMsg.textContent = t;
    };
    if (standingsBtn) {
      standingsBtn.onclick = async () => {
        try {
          if (!window.btccDb) throw new Error("Database not ready");
          const eid = root.__selectedEventId;
          if (!eid) throw new Error("No event selected");
          standingsBtn.disabled = true;
          setStandingsMsg("Rebuilding standings…");
          const result = await rebuildStandingsPlayersI3(root);
          setStandingsMsg(`Rebuilt standings for ${result.playerCount} player(s) through Event ${result.throughEventNo}.`);
          await loadStandingsPlayersPreview(root);
        } catch (e) {
          setStandingsMsg(e?.message || String(e));
        } finally {
          standingsBtn.disabled = false;
        }
      };
    }
    // Teams standings rebuild (I3.2)
    const teamsBtn = mount.querySelector("#admin-rebuild-teams-i3");
    const teamsMsg = mount.querySelector("#admin-teams-msg");
    const setTeamsMsg = (t) => {
      if (teamsMsg) teamsMsg.textContent = t;
    };
    if (teamsBtn) {
      teamsBtn.onclick = async () => {
        try {
          if (!window.btccDb) throw new Error("Database not ready");
          const eid = root.__selectedEventId;
          if (!eid) throw new Error("No event selected");
          teamsBtn.disabled = true;
          setTeamsMsg("Rebuilding team standings…");
          const result = await rebuildStandingsTeamsI3_2(root);
          setTeamsMsg(`Rebuilt team standings for ${result.teamCount} team(s) through Event ${result.throughEventNo}.`);
          await loadStandingsTeamsPreview(root);
        } catch (e) {
          setTeamsMsg(e?.message || String(e));
        } finally {
          teamsBtn.disabled = false;
        }
      };
    }
    // Driver standings rebuild (I3.3)
    const driversBtn = mount.querySelector("#admin-rebuild-drivers-i3");
    const driversMsg = mount.querySelector("#admin-drivers-standings-msg");
    const setDriversMsg = (t) => {
      if (driversMsg) driversMsg.textContent = t;
    };
    if (driversBtn) {
      driversBtn.onclick = async () => {
        try {
          if (!window.btccDb) throw new Error("Database not ready");
          const eid = root.__selectedEventId;
          if (!eid) throw new Error("No event selected");
          driversBtn.disabled = true;
          setDriversMsg("Rebuilding driver standings…");
          const result = await rebuildStandingsDriversI3_3(root);
          setDriversMsg(`Rebuilt driver standings for ${result.driverCount} driver(s) through Event ${result.throughEventNo}.`);
          await loadStandingsDriversPreview(root);
        } catch (e) {
          setDriversMsg(e?.message || String(e));
        } finally {
          driversBtn.disabled = false;
        }
      };
    }
    const wingfootBtn = mount.querySelector("#admin-rebuild-wingfoot-i3");
    const wingfootMsg = mount.querySelector("#admin-wingfoot-msg");
    const setWingfootMsg = (t) => {
      if (wingfootMsg) wingfootMsg.textContent = t;
    };
    if (wingfootBtn) {
      wingfootBtn.onclick = async () => {
        try {
          if (!window.btccDb) throw new Error("Database not ready");
          const eid = root.__selectedEventId;
          if (!eid) throw new Error("No event selected");
          wingfootBtn.disabled = true;
          setWingfootMsg("Rebuilding Wingfoot standings…");
          const result = await rebuildStandingsWingfootI3_4(root);
          setWingfootMsg(`Rebuilt Wingfoot standings for ${result.playerCount} player(s) through Event ${result.throughEventNo}.`);
          await loadStandingsWingfootPreview(root);
        } catch (e) {
          setWingfootMsg(e?.message || String(e));
        } finally {
          wingfootBtn.disabled = false;
        }
      };
    }
    if (engineBtn) {
      engineBtn.onclick = async () => {
        try {
          if (!window.btccDb) throw new Error("Database not ready");

          const eid = root.__selectedEventId;
          if (!eid) throw new Error("No event selected");

          // Require locked results before engine can run (source of truth = Firestore)
          const eventSnapNow = await window.btccDb.collection("events").doc(eid).get();
          const metaNow = eventSnapNow.exists ? (eventSnapNow.data() || {}) : {};
          // Keep in memory so the UI banner stays in sync
          root.__eventMeta = metaNow;

          if (metaNow.resultsLocked !== true) {
            throw new Error("Results must be LOCKED before running the engine");
          }

          engineBtn.disabled = true;
          engineBtn.textContent = "Running dry run…";
          setEngineMsg("Checking inputs…");

          // Read results doc
          const resultsSnap = await window.btccDb.collection("results").doc(eid).get();
          const hasResults = resultsSnap.exists;

          // Read entries (primary path)
          const entriesRefA = window.btccDb.collection("entries").doc(eid).collection("entries");
          const entriesSnapA = await entriesRefA.get();

          // Fallback (if you used a different parent collection name earlier)
          let entriesSnap = entriesSnapA;
          let entriesPathUsed = `entries/${eid}/entries`;

          if (entriesSnapA.empty) {
            const entriesRefB = window.btccDb.collection("submissions").doc(eid).collection("entries");
            const entriesSnapB = await entriesRefB.get();
            if (!entriesSnapB.empty) {
              entriesSnap = entriesSnapB;
              entriesPathUsed = `submissions/${eid}/entries`;
            }
          }

          const entryCount = entriesSnap.size;
          const uids = entriesSnap.docs.map(d => d.id);
          const entryDocs = entriesSnap.docs.map(d => ({ id: d.id, data: d.data() || {} }));

          console.log("🧠 Engine I1 dry run:");
          console.log("- eventId:", eid);
          console.log("- results doc exists:", hasResults);
          console.log("- entries path:", entriesPathUsed);
          console.log("- entries count:", entryCount);
          console.log("- uids:", uids);

          setEngineMsg(`Dry run OK. results=${hasResults ? "yes" : "no"}, entries=${entryCount} (path: ${entriesPathUsed})`);

          if (!hasResults) {
            console.warn("⚠️ No results doc found. Save qualifying/races before running engine.");
          }
          if (entryCount === 0) {
            console.warn("⚠️ No entries found for this event.");
          }

          // I1.3: Write overwrite-safe event scores (placeholder points)
          if (hasResults && entryCount > 0) {
            // Confirm before writing
            const okWrite = window.confirm(
              `Write event_scores for ${eid}?\n\nThis is overwrite-safe: it will REPLACE existing docs for this event.`
            );
            if (!okWrite) {
              setEngineMsg("Dry run complete (write cancelled)." );
              return;
            }

            setEngineMsg(`Writing event_scores for ${entryCount} player(s)…`);

            const resultsData = resultsSnap.data() || {};
            const srcUpdatedAt = resultsData.updatedAt || null;

            const qualiOrder = Array.isArray(resultsData.qualifying) ? resultsData.qualifying : [];
            const race1Order = Array.isArray(resultsData.race1) ? resultsData.race1 : [];
            const race2Order = Array.isArray(resultsData.race2) ? resultsData.race2 : [];
            const race3Order = Array.isArray(resultsData.race3) ? resultsData.race3 : [];

            const race1FastestLapIds = Array.isArray(resultsData.race1FastestLapDriverIds)
              ? resultsData.race1FastestLapDriverIds.filter(Boolean).map(String)
              : (resultsData.race1FastestLapDriverId ? [String(resultsData.race1FastestLapDriverId)] : []);

            const race2FastestLapIds = Array.isArray(resultsData.race2FastestLapDriverIds)
              ? resultsData.race2FastestLapDriverIds.filter(Boolean).map(String)
              : (resultsData.race2FastestLapDriverId ? [String(resultsData.race2FastestLapDriverId)] : []);

            const race3FastestLapIds = Array.isArray(resultsData.race3FastestLapDriverIds)
              ? resultsData.race3FastestLapDriverIds.filter(Boolean).map(String)
              : (resultsData.race3FastestLapDriverId ? [String(resultsData.race3FastestLapDriverId)] : []);

            // --- I2.1 scoring helpers (2026 locked rules) ---
            // Race scoring: full-grid linear for the 24-car 2026 grid (1st=24 .. 24th=1, DNF/DNS=0)
            // Qualifying (weekend/championship): top 6 only (6..1), rest 0
            // Source of truth: 2026 BTCC Fantasy League scoring update

            const racePointsForPos = (pos1) => {
              // pos1 is 1-based
              if (!pos1 || pos1 < 1 || pos1 > 24) return 0;
              return 25 - pos1; // 1->24, 2->23, ..., 24->1
            };

            const qualiWeekendPointsForPos = (pos1) => {
              if (!pos1 || pos1 < 1 || pos1 > 6) return 0;
              return 7 - pos1; // 1->6, 2->5, ..., 6->1
            };

            const safeTeamIdsFromEntry = (entry) => {
              // Try a few likely shapes, but always return an array of driverIds
              const candidates = [
                entry?.team,
                entry?.drivers,
                entry?.selectedDrivers,
                entry?.driverIds,
                entry?.picks,
                entry?.selection,
              ];

              const arr = candidates.find((x) => Array.isArray(x));
              const ids = Array.isArray(arr) ? arr.filter(Boolean).map(String) : [];

              // Enforce min/max team size (3–6) at engine time (invalid => 0 points)
              if (ids.length < 3 || ids.length > 6) return [];
              // Remove duplicates (shouldn't exist, but keep it safe)
              return Array.from(new Set(ids));
            };

            const scoreOrderForTeam = (teamIds, orderArr, pointsForPosFn) => {
              if (!Array.isArray(teamIds) || teamIds.length === 0) return { total: 0, perDriver: {} };
              const perDriver = {};
              let total = 0;

              teamIds.forEach((driverId) => {
                const idx = Array.isArray(orderArr) ? orderArr.indexOf(driverId) : -1;
                const pos1 = idx >= 0 ? (idx + 1) : null;
                const pts = pos1 ? pointsForPosFn(pos1) : 0;
                perDriver[driverId] = pts;
                total += pts;
              });

              return { total, perDriver };
            };

            const scoreAwardIdsForTeam = (teamIds, awardIds, pointsEach = 1) => {
              if (!Array.isArray(teamIds) || teamIds.length === 0) return { total: 0, perDriver: {} };
              const perDriver = {};
              let total = 0;

              teamIds.forEach((driverId) => {
                const count = Array.isArray(awardIds)
                  ? awardIds.filter((id) => String(id) === String(driverId)).length
                  : 0;
                const pts = count * pointsEach;
                perDriver[driverId] = pts;
                total += pts;
              });

              return { total, perDriver };
            };

            const batch = window.btccDb.batch();
            const baseRef = window.btccDb.collection("event_scores").doc(eid);

            entryDocs.forEach(({ id: uid, data }) => {
              const displayName = (data.displayName || data.name || "Unnamed").toString();
              const docRef = baseRef.collection("players").doc(uid);

              const teamIds = safeTeamIdsFromEntry(data);

              // If invalid/no team, this player scores 0 for the event (matches missed/invalid philosophy)
              const quali = scoreOrderForTeam(teamIds, qualiOrder, qualiWeekendPointsForPos);
              const r1 = scoreOrderForTeam(teamIds, race1Order, racePointsForPos);
              const r2 = scoreOrderForTeam(teamIds, race2Order, racePointsForPos);
              const r3 = scoreOrderForTeam(teamIds, race3Order, racePointsForPos);
              const fl1 = scoreAwardIdsForTeam(teamIds, race1FastestLapIds, 1);
              const fl2 = scoreAwardIdsForTeam(teamIds, race2FastestLapIds, 1);
              const fl3 = scoreAwardIdsForTeam(teamIds, race3FastestLapIds, 1);

              const breakdown = {
                qualifying: quali.total,
                race1: r1.total + fl1.total,
                race2: r2.total + fl2.total,
                race3: r3.total + fl3.total,
              };

              const pointsTotal = breakdown.qualifying + breakdown.race1 + breakdown.race2 + breakdown.race3;

              // Build driver-level breakdown + totals (for Results tab driver fantasy points table)
              const perDriverBreakdown = {};
              const perDriverTotals = {};

              teamIds.forEach((driverId) => {
                const qPts = Number(quali.perDriver?.[driverId] || 0);
                const r1Pts = Number(r1.perDriver?.[driverId] || 0) + Number(fl1.perDriver?.[driverId] || 0);
                const r2Pts = Number(r2.perDriver?.[driverId] || 0) + Number(fl2.perDriver?.[driverId] || 0);
                const r3Pts = Number(r3.perDriver?.[driverId] || 0) + Number(fl3.perDriver?.[driverId] || 0);
                const tPts = qPts + r1Pts + r2Pts + r3Pts;

                perDriverBreakdown[driverId] = { q: qPts, r1: r1Pts, r2: r2Pts, r3: r3Pts, total: tPts };
                perDriverTotals[driverId] = tPts;
              });

              batch.set(
                docRef,
                {
                  uid,
                  eventId: eid,
                  displayName,
                  teamIds,
                  pointsTotal,
                  breakdown,
                  // Totals map: driverId -> total fantasy points (what Results tab reads)
                  perDriver: perDriverTotals,
                  // Breakdown map: driverId -> { q, r1, r2, r3, total }
                  perDriverBreakdown,
                  // Keep the old per-session maps for debugging / future use
                  perDriverBySession: {
                    qualifying: quali.perDriver,
                    race1: Object.fromEntries(teamIds.map((driverId) => [driverId, Number(r1.perDriver?.[driverId] || 0) + Number(fl1.perDriver?.[driverId] || 0)])),
                    race2: Object.fromEntries(teamIds.map((driverId) => [driverId, Number(r2.perDriver?.[driverId] || 0) + Number(fl2.perDriver?.[driverId] || 0)])),
                    race3: Object.fromEntries(teamIds.map((driverId) => [driverId, Number(r3.perDriver?.[driverId] || 0) + Number(fl3.perDriver?.[driverId] || 0)])),
                    fastestLap: {
                      race1: fl1.perDriver,
                      race2: fl2.perDriver,
                      race3: fl3.perDriver,
                    },
                  },
                  sourceResultsUpdatedAt: srcUpdatedAt,
                  computedAt: firebase.firestore.FieldValue.serverTimestamp(),
                  engineVersion: "I2.2",
                },
                { merge: false }
              );
            });

            // Record engine run audit doc
            batch.set(
              window.btccDb.collection("engine_runs").doc(eid),
              {
                eventId: eid,
                mode: "I2",
                entryCount,
                sourceResultsUpdatedAt: srcUpdatedAt,
                ranAt: firebase.firestore.FieldValue.serverTimestamp(),
                engineVersion: "I2.2",
              },
              { merge: true }
            );

            await batch.commit();

            console.log("✅ Engine I1 wrote event_scores (overwrite-safe):", eid, entryCount);
            setEngineMsg(`Wrote event_scores for ${entryCount} player(s). Re-run to confirm overwrite.`);
            await loadEventScoresPreview(root);
            // PHASE I3: Rebuild standings after event_scores write
            await rebuildStandingsPlayersI3(root);
            await loadStandingsPlayersPreview(root);
            await rebuildStandingsDriversI3_3(root);
            await loadStandingsDriversPreview(root);
            await rebuildStandingsWingfootI3_4(root);
            await loadStandingsWingfootPreview(root);

           const valueResult = await runDriverValueEngineJ1(root, eid);
           const budgetResult = await runPlayerBudgetEngineJ2(root, eid);
           const tierResult = await runDriverTierEngineJ3(root, eid);

           setEngineMsg(
             tierResult.skipped
              ? `Wrote event_scores for ${entryCount} player(s). Driver values updated for ${valueResult.driverCount} active driver(s) (TDV £${valueResult.tdv.toFixed(2)}, VV ${valueResult.vv.toFixed(2)}). Budgets updated for ${budgetResult.playerCount} player(s). Tiers skipped for Event 1.`
             : `Wrote event_scores for ${entryCount} player(s). Driver values updated for ${valueResult.driverCount} active driver(s) (TDV £${valueResult.tdv.toFixed(2)}, VV ${valueResult.vv.toFixed(2)}). Budgets updated for ${budgetResult.playerCount} player(s). Tiers assigned for ${tierResult.driverCount} driver(s).`
           );
          }
        } catch (e) {
          console.error("❌ Engine dry run failed:", e);
          setEngineMsg(e?.message || String(e));
        } finally {
          if (engineBtn) {
            engineBtn.disabled = false;
            engineBtn.textContent = "Run engine for selected event";
          }
        }
      };
    }
  }
  // END renderResultsPreview

// ============================================================
// DRIVER VALUE ENGINE CONSTANTS (J1)
// ============================================================
const PPV_2026 = 930;
const PTR_2026 = 0.10;
const MIN_DRIVER_VALUE_2026 = 0.10;

  function roundMoney2(v) {
  return Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
}

async function runDriverValueEngineJ1(root, eventId) {
  if (!window.btccDb) throw new Error("Database not ready");
  if (!eventId) throw new Error("No event selected for value engine");

  const [driversSnap, scoresSnap] = await Promise.all([
    window.btccDb.collection("drivers").get(),
    window.btccDb.collection("event_scores").doc(eventId).collection("players").get(),
  ]);

  const activeDrivers = driversSnap.docs
    .map((doc) => {
      const d = doc.data() || {};
      return {
        id: doc.id,
        name: (d.name || doc.id).toString(),
        active: d.active !== false,
        value: Number(d.value || 0),
        category: d.category || "",
      };
    })
    .filter((d) => d.active);

  if (!activeDrivers.length) {
    throw new Error("No active drivers found for value engine");
  }

  const tdv = activeDrivers.reduce(
    (sum, d) => sum + Math.max(Number(d.value || 0), MIN_DRIVER_VALUE_2026),
    0
  );

  if (!tdv || tdv <= 0) {
    throw new Error("Total Driver Value (TDV) is zero");
  }

  const vv = PPV_2026 / tdv;

  const gpMap = new Map();

  scoresSnap.forEach((doc) => {
    const data = doc.data() || {};
    const perDriver = data.perDriver || {};
    Object.entries(perDriver).forEach(([driverId, pts]) => {
      const prev = Number(gpMap.get(driverId) || 0);
      gpMap.set(String(driverId), prev + Number(pts || 0));
    });
  });

  const calcRows = activeDrivers.map((driver) => {
    const dv = Math.max(Number(driver.value || 0), MIN_DRIVER_VALUE_2026);
    const gp = Number(gpMap.get(driver.id) || 0);
    const ep = vv * dv;
    const diffRatio = ep > 0 ? ((gp - ep) / ep) : 0;
    const appliedChangeRaw = dv * diffRatio * PTR_2026;
    const ndvRaw = dv + appliedChangeRaw;
    const ndv = Math.max(MIN_DRIVER_VALUE_2026, roundMoney2(ndvRaw));
    const ac = roundMoney2(ndv - dv);

    return {
      driverId: driver.id,
      name: driver.name,
      category: driver.category,
      active: true,
      dv: roundMoney2(dv),
      gp: roundMoney2(gp),
      ep: roundMoney2(ep),
      d: Number(diffRatio || 0),
      ptr: PTR_2026,
      ac,
      ndv,
    };
  });

  const batch = window.btccDb.batch();

  calcRows.forEach((row) => {
    const runRef = window.btccDb
      .collection("driver_value_runs")
      .doc(eventId)
      .collection("drivers")
      .doc(row.driverId);

    batch.set(
      runRef,
      {
        eventId,
        driverId: row.driverId,
        name: row.name,
        category: row.category,
        dv: row.dv,
        gp: row.gp,
        ep: row.ep,
        d: row.d,
        ptr: row.ptr,
        ac: row.ac,
        ndv: row.ndv,
        computedAt: firebase.firestore.FieldValue.serverTimestamp(),
        engineVersion: "J1.0",
      },
      { merge: false }
    );

    const driverRef = window.btccDb.collection("drivers").doc(row.driverId);
    batch.set(
      driverRef,
      {
        value: row.ndv,
        previousValue: row.dv,
        lastGp: row.gp,
        lastEp: row.ep,
        lastDiffRatio: row.d,
        lastValueChange: row.ac,
        lastValueEventId: eventId,
        valueUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  batch.set(
    window.btccDb.collection("driver_value_runs").doc(eventId),
    {
      eventId,
      ppv: PPV_2026,
      tdv: roundMoney2(tdv),
      vv: roundMoney2(vv),
      ptr: PTR_2026,
      activeDriverCount: activeDrivers.length,
      computedAt: firebase.firestore.FieldValue.serverTimestamp(),
      engineVersion: "J1.0",
    },
    { merge: true }
  );

  await batch.commit();

  return {
    driverCount: calcRows.length,
    tdv: roundMoney2(tdv),
    vv: roundMoney2(vv),
  };
}

async function runPlayerBudgetEngineJ2(root, eventId) {
  if (!window.btccDb) throw new Error("Database not ready");
  if (!eventId) throw new Error("No event selected for budget engine");

  const [runSnap, playersSnap, entriesSnapA] = await Promise.all([
    window.btccDb.collection("driver_value_runs").doc(eventId).collection("drivers").get(),
    window.btccDb.collection("players").get(),
    window.btccDb.collection("entries").doc(eventId).collection("entries").get(),
  ]);

  let entriesSnap = entriesSnapA;
  if (entriesSnap.empty) {
    const alt = await window.btccDb.collection("submissions").doc(eventId).collection("entries").get();
    if (!alt.empty) entriesSnap = alt;
  }

  const driverRunMap = new Map();
  runSnap.forEach((doc) => {
    const d = doc.data() || {};
    driverRunMap.set(doc.id, {
      dv: Number(d.dv || 0),
      ndv: Number(d.ndv || 0),
      ac: Number(d.ac || 0),
      gp: Number(d.gp || 0),
    });
  });

  const playerMap = new Map();
  playersSnap.forEach((doc) => {
    const d = doc.data() || {};
    playerMap.set(doc.id, {
      budget: Number(d.budget || d.baseBudget || 10),
      displayName: (d.displayName || d.name || doc.id).toString(),
      active: d.active !== false,
    });
  });

  const safeTeamIdsFromEntry = (entry) => {
    const candidates = [
      entry?.team,
      entry?.drivers,
      entry?.selectedDrivers,
      entry?.driverIds,
      entry?.picks,
      entry?.selection,
    ];
    const arr = candidates.find((x) => Array.isArray(x));
    const ids = Array.isArray(arr) ? arr.filter(Boolean).map(String) : [];
    if (ids.length < 3 || ids.length > 6) return [];
    return Array.from(new Set(ids));
  };

  const batch = window.btccDb.batch();
  let playerCount = 0;

  entriesSnap.forEach((doc) => {
    const uid = doc.id;
    const entry = doc.data() || {};
    const player = playerMap.get(uid) || { budget: 10, displayName: uid, active: true };
    const teamIds = safeTeamIdsFromEntry(entry);

    const perDriverRawChanges = {};
    const perDriverAppliedChanges = {};
    let totalPositive = 0;
    let totalNegative = 0;

    teamIds.forEach((driverId) => {
      const row = driverRunMap.get(driverId);
      const raw = Number(row?.ac || 0);
      const applied = raw < 0 ? Math.max(raw, -0.10) : raw;

      perDriverRawChanges[driverId] = roundMoney2(raw);
      perDriverAppliedChanges[driverId] = roundMoney2(applied);

      if (applied >= 0) totalPositive += applied;
      else totalNegative += applied;
    });

    const cappedNegative = Math.max(totalNegative, -0.60);
    const totalChange = roundMoney2(totalPositive + cappedNegative);
    const startingBudget = roundMoney2(player.budget);
    const newBudget = roundMoney2(startingBudget + totalChange);

    const runRef = window.btccDb.collection("player_budget_runs").doc(eventId).collection("players").doc(uid);
    batch.set(
      runRef,
      {
        eventId,
        uid,
        displayName: player.displayName,
        startingBudget,
        teamIds,
        perDriverRawChanges,
        perDriverAppliedChanges,
        totalPositive: roundMoney2(totalPositive),
        totalNegativeRaw: roundMoney2(totalNegative),
        totalNegativeApplied: roundMoney2(cappedNegative),
        totalChange,
        newBudget,
        computedAt: firebase.firestore.FieldValue.serverTimestamp(),
        engineVersion: "J2.0",
      },
      { merge: false }
    );

    const playerRef = window.btccDb.collection("players").doc(uid);
    batch.set(
      playerRef,
      {
        budget: newBudget,
        baseBudget: newBudget,
        previousBudget: startingBudget,
        lastBudgetChange: totalChange,
        lastBudgetEventId: eventId,
        budgetUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    playerCount += 1;
  });

  batch.set(
    window.btccDb.collection("player_budget_runs").doc(eventId),
    {
      eventId,
      playerCount,
      computedAt: firebase.firestore.FieldValue.serverTimestamp(),
      engineVersion: "J2.0",
    },
    { merge: true }
  );

  await batch.commit();

  return { playerCount };
}

async function runDriverTierEngineJ3(root, eventId) {
  if (!window.btccDb) throw new Error("Database not ready");
  if (!eventId) throw new Error("No event selected for tier engine");

  const eventMeta = root.__eventMeta || {};
  const eventNo = Number(eventMeta.eventNo || 0);

  if (eventNo <= 1) {
    return { driverCount: 0, skipped: true, reason: "Event 1 has no tiers" };
  }

  const standingsSnap = await window.btccDb
    .collection("standings_drivers")
    .doc("season_2026")
    .collection("drivers")
    .orderBy("pointsTotal", "desc")
    .get();

  if (standingsSnap.empty) {
    throw new Error("No driver standings found for tier engine");
  }

  const rows = standingsSnap.docs.map((doc, idx) => {
    const d = doc.data() || {};
    return {
      driverId: doc.id,
      name: (d.name || doc.id).toString(),
      pointsTotal: Number(d.pointsTotal || 0),
      standingPos: idx + 1,
    };
  });

  const batch = window.btccDb.batch();

  rows.forEach((row) => {
    let tier = "low";
    if (row.standingPos >= 1 && row.standingPos <= 7) tier = "high";
    else if (row.standingPos >= 8 && row.standingPos <= 17) tier = "middle";
    else tier = "low";

    const runRef = window.btccDb
      .collection("driver_tier_runs")
      .doc(eventId)
      .collection("drivers")
      .doc(row.driverId);

    batch.set(
      runRef,
      {
        eventId,
        driverId: row.driverId,
        name: row.name,
        standingPos: row.standingPos,
        pointsTotal: row.pointsTotal,
        tier,
        computedAt: firebase.firestore.FieldValue.serverTimestamp(),
        engineVersion: "J3.0",
      },
      { merge: false }
    );

    const driverRef = window.btccDb.collection("drivers").doc(row.driverId);
    batch.set(
      driverRef,
      {
        tier,
        tierStandingPos: row.standingPos,
        tierEventId: eventId,
        tierUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  batch.set(
    window.btccDb.collection("driver_tier_runs").doc(eventId),
    {
      eventId,
      eventNo,
      gridSize: rows.length,
      split: { high: 7, middle: 10, low: 7 },
      computedAt: firebase.firestore.FieldValue.serverTimestamp(),
      engineVersion: "J3.0",
    },
    { merge: true }
  );

  await batch.commit();

  return { driverCount: rows.length, skipped: false };
}

  // I1.4: Read-only preview of event_scores/{eventId}/players/*
  async function loadEventScoresPreview(root) {
    const mount = root.querySelector("#admin-event-scores-preview");
    if (!mount) return;

    const eid = root.__selectedEventId;
    if (!eid) {
      mount.hidden = true;
      mount.innerHTML = "";
      return;
    }

    if (!window.btccDb) {
      mount.hidden = false;
      mount.innerHTML = `<strong>Event scores</strong><br><span class="tiny muted">Waiting for database…</span>`;
      return;
    }

    mount.hidden = false;
    mount.innerHTML = `<strong>Event scores</strong><br><span class="tiny muted">Loading…</span>`;

    try {
      const snap = await window.btccDb
        .collection("event_scores")
        .doc(eid)
        .collection("players")
        .orderBy("pointsTotal", "desc")
        .get();

      if (snap.empty) {
        mount.innerHTML = `<strong>Event scores</strong><br><span class="tiny muted">No event_scores found yet for this event. Run Engine (I1) to create them.</span>`;
        return;
      }

      const fmtTs = (v) => {
        try {
          if (!v) return "—";
          if (typeof v.toDate === "function") return v.toDate().toLocaleString("en-GB");
          const d = new Date(v);
          if (!isNaN(d)) return d.toLocaleString("en-GB");
          return String(v);
        } catch {
          return "—";
        }
      };

      const rows = snap.docs.map(d => {
        const x = d.data() || {};
        return {
          uid: d.id,
          name: x.displayName || x.name || "Unnamed",
          pts: Number(x.pointsTotal || 0),
          at: fmtTs(x.computedAt),
        };
      });

      mount.innerHTML = `
        <strong>Event scores</strong>
        <div class="tiny muted" style="margin-top:6px;">Showing ${rows.length} player(s) from event_scores/${eid}/players</div>
        <div style="margin-top:10px; border:1px solid var(--border); border-radius:12px; padding:10px; background:rgba(255,255,255,.02);">
          <ol class="list" style="margin:0; padding-left:18px;">
            ${rows.map((r,i) => `<li class="tiny" style="margin:6px 0;">${i+1}. ${r.name} — ${r.pts} pts <span class="muted">(computed ${r.at})</span></li>`).join("")}
          </ol>
        </div>
      `;
    } catch (e) {
      console.error("❌ loadEventScoresPreview failed:", e);
      mount.innerHTML = `<strong>Event scores</strong><br><span class="tiny muted">Failed to load: ${e?.message || e}</span>`;
    }
  }
  // I3: Standings rebuild and preview
  // PHASE I3: Rebuild standings_players/season_2026/players/* from event_scores up to selected event
  async function rebuildStandingsPlayersI3(root) {
    if (!window.btccDb) throw new Error("Database not ready");
    const eid = root.__selectedEventId;
    if (!eid) throw new Error("No event selected");
    // Read selected event's eventNo
    const eventSnap = await window.btccDb.collection("events").doc(eid).get();
    if (!eventSnap.exists) throw new Error("Selected event not found");
    const eventData = eventSnap.data() || {};
    const selectedEventNo = eventData.eventNo;
    if (typeof selectedEventNo !== "number") throw new Error("Selected event missing eventNo");
    // Fetch all events <= selectedEventNo
    const eventsSnap = await window.btccDb.collection("events")
      .where("eventNo", "<=", selectedEventNo)
      .orderBy("eventNo")
      .get();
    const eventList = eventsSnap.docs.map(doc => ({ id: doc.id, eventNo: doc.data().eventNo }));
    const eventsIncluded = eventList.map(e => e.id);
    const throughEventNo = selectedEventNo;
    const throughEventId = eid;
    // Aggregate points per uid
    const playerMap = new Map(); // uid -> { pointsTotal, displayName, eventsIncluded: Set }
    for (const ev of eventList) {
      const scoresSnap = await window.btccDb.collection("event_scores").doc(ev.id).collection("players").get();
      scoresSnap.forEach(d => {
        const x = d.data() || {};
        const uid = x.uid || d.id;
        if (!uid) return;
        const pts = Number(x.pointsTotal || 0);
        const displayName = (x.displayName || x.name || "").toString();
        let rec = playerMap.get(uid);
        if (!rec) {
          rec = { pointsTotal: 0, displayName: "", eventsIncluded: new Set() };
          playerMap.set(uid, rec);
        }
        rec.pointsTotal += pts;
        // Use most recent non-empty displayName found
        if (displayName && displayName.length > 0) rec.displayName = displayName;
        rec.eventsIncluded.add(ev.id);
      });
    }
    // Write to standings_players/season_2026/players/{uid}, batching if >400
    const playerArr = Array.from(playerMap.entries());
    const batchLimit = 400;
    let batchCount = 0;
    for (let i = 0; i < playerArr.length; i += batchLimit) {
      const batch = window.btccDb.batch();
      const chunk = playerArr.slice(i, i + batchLimit);
      chunk.forEach(([uid, rec]) => {
        const docRef = window.btccDb.collection("standings_players").doc("season_2026").collection("players").doc(uid);
        batch.set(
          docRef,
          {
            uid,
            displayName: rec.displayName,
            pointsTotal: rec.pointsTotal,
            throughEventId,
            throughEventNo,
            eventsIncluded: Array.from(rec.eventsIncluded),
            computedAt: firebase.firestore.FieldValue.serverTimestamp(),
            engineVersion: "I3.1",
          },
          { merge: false }
        );
      });
      await batch.commit();
      batchCount++;
    }
    // Write audit doc
    await window.btccDb.collection("standings_players").doc("season_2026").collection("meta").doc("meta").set(
      {
        lastRebuildAt: firebase.firestore.FieldValue.serverTimestamp(),
        throughEventId,
        throughEventNo,
        eventsIncludedCount: eventList.length,
        engineVersion: "I3.1",
      },
      { merge: true }
    );
    return { playerCount: playerArr.length, throughEventNo, eventsIncluded };
  }

  // I3: Preview standings_players/season_2026/players (top 25)
  async function loadStandingsPlayersPreview(root) {
    const mount = root.querySelector("#admin-standings-preview");
    if (!mount) return;
    if (!window.btccDb) {
      mount.hidden = false;
      mount.innerHTML = `<strong>Standings</strong><br><span class="tiny muted">Waiting for database…</span>`;
      return;
    }
    mount.hidden = false;
    mount.innerHTML = `<strong>Standings</strong><br><span class="tiny muted">Loading…</span>`;
    try {
      const snap = await window.btccDb
        .collection("standings_players")
        .doc("season_2026")
        .collection("players")
        .orderBy("pointsTotal", "desc")
        .limit(25)
        .get();
      if (snap.empty) {
        mount.innerHTML = `<strong>Standings</strong><br><span class="tiny muted">No standings found yet. Rebuild to create them.</span>`;
        return;
      }
      const fmtTs = (v) => {
        try {
          if (!v) return "—";
          if (typeof v.toDate === "function") return v.toDate().toLocaleString("en-GB");
          const d = new Date(v);
          if (!isNaN(d)) return d.toLocaleString("en-GB");
          return String(v);
        } catch {
          return "—";
        }
      };
      const rows = snap.docs.map(d => {
        const x = d.data() || {};
        return {
          uid: d.id,
          name: x.displayName || x.name || "Unnamed",
          pts: Number(x.pointsTotal || 0),
          at: fmtTs(x.computedAt),
        };
      });
      mount.innerHTML = `
        <strong>Standings</strong>
        <div class="tiny muted" style="margin-top:6px;">Showing top ${rows.length} player(s) from standings_players/season_2026/players</div>
        <div style="margin-top:10px; border:1px solid var(--border); border-radius:12px; padding:10px; background:rgba(255,255,255,.02);">
          <ol class="list" style="margin:0; padding-left:18px;">
            ${rows.map((r,i) => `<li class="tiny" style="margin:6px 0;">${i+1}. ${r.name} — ${r.pts} pts <span class="muted">(as of ${r.at})</span></li>`).join("")}
          </ol>
        </div>
      `;
    } catch (e) {
      console.error("❌ loadStandingsPlayersPreview failed:", e);
      mount.innerHTML = `<strong>Standings</strong><br><span class="tiny muted">Failed to load: ${e?.message || e}</span>`;
    }
  }

  // I3.2: Rebuild standings_teams/season_2026/teams/* from standings_players + players team mapping
  async function rebuildStandingsTeamsI3_2(root) {
    if (!window.btccDb) throw new Error("Database not ready");
    const eid = root.__selectedEventId;
    if (!eid) throw new Error("No event selected");

    // Determine throughEventNo from selected event
    const eventSnap = await window.btccDb.collection("events").doc(eid).get();
    if (!eventSnap.exists) throw new Error("Selected event not found");
    const eventData = eventSnap.data() || {};
    const throughEventNo = eventData.eventNo;
    if (typeof throughEventNo !== "number") throw new Error("Selected event missing eventNo");

    // Read player standings (already overwrite-safe)
    const standingsSnap = await window.btccDb
      .collection("standings_players")
      .doc("season_2026")
      .collection("players")
      .get();

    if (standingsSnap.empty) {
      // Nothing to aggregate yet
      return { teamCount: 0, throughEventNo };
    }

    // Fetch players/{uid} docs for teamId/teamName
    const standingRows = standingsSnap.docs.map(d => ({ uid: d.id, ...(d.data() || {}) }));
    const playerDocs = await Promise.all(
      standingRows.map(r => window.btccDb.collection("players").doc(r.uid).get().catch(() => null))
    );

    const teamMap = new Map();

    standingRows.forEach((row, idx) => {
      const pSnap = playerDocs[idx];
      const pData = pSnap && pSnap.exists ? (pSnap.data() || {}) : {};

      const teamId = (pData.teamId || row.teamId || "unassigned").toString();
      const teamName = (pData.teamName || row.teamName || (teamId === "unassigned" ? "Unassigned" : teamId)).toString();

      const displayName = (row.displayName || pData.displayName || "Unnamed").toString();
      const points = Number(row.pointsTotal || 0);

      let rec = teamMap.get(teamId);
      if (!rec) {
        rec = {
          teamId,
          teamName,
          pointsTotal: 0,
          players: [],
        };
        teamMap.set(teamId, rec);
      }

      rec.pointsTotal += points;
      rec.players.push({ uid: row.uid, displayName, points });

      // Prefer a real human-readable teamName if later rows have it
      if (teamName && teamName !== teamId) rec.teamName = teamName;
    });

    // Sort players within each team (desc points), and sort teams (desc points)
    const teamArr = Array.from(teamMap.values()).map(t => {
      t.players.sort((a, b) => (b.points || 0) - (a.points || 0));
      return t;
    });
    teamArr.sort((a, b) => (b.pointsTotal || 0) - (a.pointsTotal || 0));

    // Write standings_teams/season_2026/teams/{teamId}
    const batchLimit = 400;
    for (let i = 0; i < teamArr.length; i += batchLimit) {
      const batch = window.btccDb.batch();
      const chunk = teamArr.slice(i, i + batchLimit);

      chunk.forEach((t) => {
        const docRef = window.btccDb
          .collection("standings_teams")
          .doc("season_2026")
          .collection("teams")
          .doc(t.teamId);

        batch.set(
          docRef,
          {
            teamId: t.teamId,
            teamName: t.teamName,
            pointsTotal: t.pointsTotal,
            players: t.players,
            throughEventNo,
            throughEventId: eid,
            computedAt: firebase.firestore.FieldValue.serverTimestamp(),
            engineVersion: "I3.2",
          },
          { merge: false }
        );
      });

      await batch.commit();
    }

    // Write audit meta
    await window.btccDb
      .collection("standings_teams")
      .doc("season_2026")
      .collection("meta")
      .doc("meta")
      .set(
        {
          lastRebuildAt: firebase.firestore.FieldValue.serverTimestamp(),
          throughEventNo,
          throughEventId: eid,
          teamCount: teamArr.length,
          engineVersion: "I3.2",
        },
        { merge: true }
      );

    return { teamCount: teamArr.length, throughEventNo };
  }

  // I3.2: Preview standings_teams/season_2026/teams (top 25)
  async function loadStandingsTeamsPreview(root) {
    const mount = root.querySelector("#admin-teams-preview");
    if (!mount) return;

    if (!window.btccDb) {
      mount.hidden = false;
      mount.innerHTML = `<strong>Teams standings</strong><br><span class="tiny muted">Waiting for database…</span>`;
      return;
    }

    mount.hidden = false;
    mount.innerHTML = `<strong>Teams standings</strong><br><span class="tiny muted">Loading…</span>`;

    try {
      const snap = await window.btccDb
        .collection("standings_teams")
        .doc("season_2026")
        .collection("teams")
        .orderBy("pointsTotal", "desc")
        .limit(25)
        .get();

      if (snap.empty) {
        mount.innerHTML = `<strong>Teams standings</strong><br><span class="tiny muted">No team standings found yet. Rebuild to create them.</span>`;
        return;
      }

      const fmtTs = (v) => {
        try {
          if (!v) return "—";
          if (typeof v.toDate === "function") return v.toDate().toLocaleString("en-GB");
          const d = new Date(v);
          if (!isNaN(d)) return d.toLocaleString("en-GB");
          return String(v);
        } catch {
          return "—";
        }
      };

      const rows = snap.docs.map(d => {
        const x = d.data() || {};
        return {
          id: d.id,
          name: x.teamName || x.teamId || "Unnamed",
          pts: Number(x.pointsTotal || 0),
          at: fmtTs(x.computedAt),
          players: Array.isArray(x.players) ? x.players : [],
        };
      });

      mount.innerHTML = `
        <strong>Teams standings</strong>
        <div class="tiny muted" style="margin-top:6px;">Showing top ${rows.length} team(s) from standings_teams/season_2026/teams</div>
        <div style="margin-top:10px; border:1px solid var(--border); border-radius:12px; padding:10px; background:rgba(255,255,255,.02);">
          <ol class="list" style="margin:0; padding-left:18px;">
            ${rows.map((r,i) => {
              const topPlayers = r.players.slice(0, 5).map(p => `${p.displayName || p.uid} (${Number(p.points||0)} pts)`).join(", ");
              const tail = r.players.length > 5 ? ` +${r.players.length - 5} more` : "";
              return `<li class="tiny" style="margin:8px 0;">
                <strong>${i+1}. ${r.name}</strong> — ${r.pts} pts <span class="muted">(as of ${r.at})</span><br>
                <span class="muted">Players:</span> <span class="tiny muted">${topPlayers || "—"}${tail}</span>
              </li>`;
            }).join("")}
          </ol>
        </div>
      `;
    } catch (e) {
      console.error("❌ loadStandingsTeamsPreview failed:", e);
      mount.innerHTML = `<strong>Teams standings</strong><br><span class="tiny muted">Failed to load: ${e?.message || e}</span>`;
    }
  }
// PHASE I3.3: Rebuild standings_drivers/season_2026/drivers/* from event_scores up to selected event
async function rebuildStandingsDriversI3_3(root) {
  if (!window.btccDb) throw new Error("Database not ready");
  const eid = root.__selectedEventId;
  if (!eid) throw new Error("No event selected");

  const eventSnap = await window.btccDb.collection("events").doc(eid).get();
  if (!eventSnap.exists) throw new Error("Selected event not found");
  const eventData = eventSnap.data() || {};
  const selectedEventNo = eventData.eventNo;
  if (typeof selectedEventNo !== "number") throw new Error("Selected event missing eventNo");

  const eventsSnap = await window.btccDb.collection("events")
    .where("eventNo", "<=", selectedEventNo)
    .orderBy("eventNo")
    .get();

  const eventList = eventsSnap.docs.map((doc) => ({
    id: doc.id,
    eventNo: doc.data().eventNo,
  }));

  const driversSnap = await window.btccDb.collection("drivers").get();
  const driverMeta = new Map();
  driversSnap.forEach((doc) => {
    const d = doc.data() || {};
    driverMeta.set(doc.id, {
      name: d.name || doc.id,
      active: d.active !== false,
    });
  });

  const totals = new Map();

  const ensureDriver = (driverId) => {
    let rec = totals.get(driverId);
    if (!rec) {
      const meta = driverMeta.get(driverId) || { name: driverId, active: true };
      rec = {
        driverId,
        name: meta.name,
        active: meta.active,
        pointsTotal: 0,
      };
      totals.set(driverId, rec);
    }
    return rec;
  };

  const racePointsForPos = (pos1) => {
    if (!pos1 || pos1 < 1 || pos1 > 24) return 0;
    return 25 - pos1; // 1->24 ... 24->1
  };

  const qualiPointsForPos = (pos1) => {
    if (!pos1 || pos1 < 1 || pos1 > 6) return 0;
    return 7 - pos1; // 1->6 ... 6->1
  };

  const scoreOrderIntoTotals = (orderArr, pointsForPosFn) => {
    if (!Array.isArray(orderArr)) return;

    orderArr.forEach((driverId, index) => {
      if (!driverId) return;
      const rec = ensureDriver(String(driverId));
      rec.pointsTotal += Number(pointsForPosFn(index + 1) || 0);
    });
  };

  for (const ev of eventList) {
    const resultsSnap = await window.btccDb.collection("results").doc(ev.id).get();
    if (!resultsSnap.exists) continue;

    const data = resultsSnap.data() || {};
    const qualifying = Array.isArray(data.qualifying) ? data.qualifying : [];
    const race1 = Array.isArray(data.race1) ? data.race1 : [];
    const race2 = Array.isArray(data.race2) ? data.race2 : [];
    const race3 = Array.isArray(data.race3) ? data.race3 : [];

    scoreOrderIntoTotals(qualifying, qualiPointsForPos);
    scoreOrderIntoTotals(race1, racePointsForPos);
    scoreOrderIntoTotals(race2, racePointsForPos);
    scoreOrderIntoTotals(race3, racePointsForPos);
  }

  // Ensure every driver exists in standings even if on zero
  driversSnap.forEach((doc) => {
    ensureDriver(doc.id);
  });

  const ranked = Array.from(totals.values())
    .sort((a, b) => {
      const pointsDiff = Number(b.pointsTotal || 0) - Number(a.pointsTotal || 0);
      if (pointsDiff !== 0) return pointsDiff;
      return String(a.name || "").localeCompare(String(b.name || ""));
    })
    .map((row, index) => {
      const position = index + 1;
      let tier = null;

      if (selectedEventNo >= 2) {
        if (position <= 7) tier = "high";
        else if (position <= 17) tier = "middle";
        else tier = "lower";
      }

      return {
        ...row,
        position,
        tier,
      };
    });

  const seasonRef = window.btccDb.collection("standings_drivers").doc("season_2026");
  const batch = window.btccDb.batch();

  batch.set(
    seasonRef,
    {
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      throughEventId: eid,
      throughEventNo: selectedEventNo,
      driverCount: ranked.length,
      tierMode: selectedEventNo >= 2 ? "7-10-7" : "event1-free-choice",
      source: "results",
    },
    { merge: true }
  );

  ranked.forEach((row) => {
    batch.set(
      seasonRef.collection("drivers").doc(row.driverId),
      {
        driverId: row.driverId,
        name: row.name,
        active: row.active,
        pointsTotal: Number(row.pointsTotal || 0),
        position: row.position,
        tier: row.tier,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    batch.set(
      window.btccDb.collection("drivers").doc(row.driverId),
      {
        pointsTotal: Number(row.pointsTotal || 0),
        position: row.position,
        tier: row.tier,
        tierUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  await batch.commit();

  return {
    driverCount: ranked.length,
    throughEventNo: selectedEventNo,
    throughEventId: eid,
  };
}

// Read-only preview of standings_drivers/season_2026/drivers/*
async function loadStandingsDriversPreview(root) {
  const mount = root.querySelector("#admin-drivers-standings-preview");
  if (!mount) return;

  const eid = root.__selectedEventId;
  if (!eid) {
    mount.hidden = true;
    mount.innerHTML = "";
    return;
  }

  if (!window.btccDb) {
    mount.hidden = false;
    mount.innerHTML = `<strong>Driver standings</strong><br><span class="tiny muted">Waiting for database…</span>`;
    return;
  }

  mount.hidden = false;
  mount.innerHTML = `<strong>Driver standings</strong><br><span class="tiny muted">Loading…</span>`;

  try {
    let snap;
    try {
      snap = await window.btccDb
        .collection("standings_drivers")
        .doc("season_2026")
        .collection("drivers")
        .orderBy("position")
        .get();
    } catch (err) {
      snap = await window.btccDb
        .collection("standings_drivers")
        .doc("season_2026")
        .collection("drivers")
        .get();
    }

    if (snap.empty) {
      mount.innerHTML = `<strong>Driver standings</strong><br><span class="tiny muted">No driver standings found yet. Run the driver rebuild first.</span>`;
      return;
    }

    const rows = snap.docs
      .map((doc) => {
        const x = doc.data() || {};
        return {
          name: x.name || doc.id,
          position: Number(x.position || 999),
          pointsTotal: Number(x.pointsTotal || 0),
          tier: x.tier || (Number(x.position || 0) >= 1 ? "—" : "—"),
        };
      })
      .sort((a, b) => {
        const posDiff = a.position - b.position;
        if (posDiff !== 0) return posDiff;
        return a.name.localeCompare(b.name);
      });

    mount.innerHTML = `
      <strong>Driver standings</strong>
      <div class="tiny muted" style="margin-top:6px;">Showing ${rows.length} driver(s) from standings_drivers/season_2026/drivers</div>
      <div style="margin-top:10px; border:1px solid var(--border); border-radius:12px; padding:10px; background:rgba(255,255,255,.02);">
        <ol class="list" style="margin:0; padding-left:18px;">
          ${rows.map((r) => `<li class="tiny" style="margin:6px 0;">${r.position}. ${r.name} — ${r.pointsTotal} pts <span class="muted">(${r.tier || "—"})</span></li>`).join("")}
        </ol>
      </div>
    `;
  } catch (e) {
    console.error("❌ loadStandingsDriversPreview failed:", e);
    mount.innerHTML = `<strong>Driver standings</strong><br><span class="tiny muted">Failed to load: ${e?.message || e}</span>`;
  }
}
// --- WINGFOOT STANDINGS REBUILD (I3.4) ---
async function rebuildStandingsWingfootI3_4(root) {
  if (!window.btccDb) throw new Error("Database not ready");
  const eid = root.__selectedEventId;
  if (!eid) throw new Error("No event selected");

  const eventSnap = await window.btccDb.collection("events").doc(eid).get();
  if (!eventSnap.exists) throw new Error("Selected event not found");
  const eventData = eventSnap.data() || {};
  const selectedEventNo = eventData.eventNo;
  if (typeof selectedEventNo !== "number") throw new Error("Selected event missing eventNo");

  const eventsSnap = await window.btccDb.collection("events")
    .where("eventNo", "<=", selectedEventNo)
    .orderBy("eventNo")
    .get();

  const playerSnap = await window.btccDb.collection("players").get();
  const playerMeta = new Map();
  playerSnap.forEach((doc) => {
    const d = doc.data() || {};
    playerMeta.set(doc.id, {
      displayName: d.displayName || d.name || doc.id,
      teamId: d.teamId || "unassigned",
      teamName: d.teamName || d.teamId || "unassigned",
    });
  });

  const totals = new Map();

  const ensurePlayer = (uid) => {
    let rec = totals.get(uid);
    if (!rec) {
      const meta = playerMeta.get(uid) || { displayName: uid, teamId: "unassigned", teamName: "unassigned" };
      rec = {
        uid,
        displayName: meta.displayName,
        teamId: meta.teamId,
        teamName: meta.teamName,
        pointsTotal: 0,
      };
      totals.set(uid, rec);
    }
    return rec;
  };

  const qualifyingTablePointsForPos = (pos1) => {
    if (!pos1 || pos1 < 1 || pos1 > 24) return 0;
    return 25 - pos1; // 1->24, 2->23, ..., 24->1
  };

  const normaliseDriverIdsFromEntry = (data) => {
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
          .map(String)
      )
    );
  };

  const scoreQualifyingForTeam = (teamIds, qualifyingOrder) => {
    if (!Array.isArray(teamIds) || teamIds.length === 0) return 0;
    return teamIds.reduce((total, driverId) => {
      const idx = Array.isArray(qualifyingOrder) ? qualifyingOrder.indexOf(driverId) : -1;
      const pos1 = idx >= 0 ? idx + 1 : null;
      return total + qualifyingTablePointsForPos(pos1);
    }, 0);
  };

  for (const ev of eventsSnap.docs) {
    const eventId = ev.id;

    const resultsSnap = await window.btccDb.collection("results").doc(eventId).get();
    if (!resultsSnap.exists) continue;
    const resultsData = resultsSnap.data() || {};
    const qualifyingOrder = Array.isArray(resultsData.qualifying) ? resultsData.qualifying : [];

    let entriesSnap = await window.btccDb.collection("entries").doc(eventId).collection("entries").get();
    if (entriesSnap.empty) {
      entriesSnap = await window.btccDb.collection("submissions").doc(eventId).collection("entries").get();
    }

    entriesSnap.forEach((doc) => {
      const uid = doc.id;
      const teamIds = normaliseDriverIdsFromEntry(doc.data() || {});
      const rec = ensurePlayer(uid);
      rec.pointsTotal += Number(scoreQualifyingForTeam(teamIds, qualifyingOrder) || 0);
    });
  }

  playerSnap.forEach((doc) => ensurePlayer(doc.id));

  const ranked = Array.from(totals.values())
    .sort((a, b) => {
      const pointsDiff = Number(b.pointsTotal || 0) - Number(a.pointsTotal || 0);
      if (pointsDiff !== 0) return pointsDiff;
      return String(a.displayName || "").localeCompare(String(b.displayName || ""));
    })
    .map((row, index) => ({ ...row, position: index + 1 }));

  const seasonRef = window.btccDb.collection("standings_wingfoot").doc("season_2026");
  const batch = window.btccDb.batch();

  batch.set(
    seasonRef,
    {
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      throughEventId: eid,
      throughEventNo: selectedEventNo,
      playerCount: ranked.length,
      source: "results.qualifying + entries (24-to-1)",
    },
    { merge: true }
  );

  ranked.forEach((row) => {
    batch.set(
      seasonRef.collection("players").doc(row.uid),
      {
        uid: row.uid,
        displayName: row.displayName,
        teamId: row.teamId,
        teamName: row.teamName,
        pointsTotal: Number(row.pointsTotal || 0),
        position: row.position,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  await batch.commit();

  return {
    playerCount: ranked.length,
    throughEventNo: selectedEventNo,
    throughEventId: eid,
  };
}

async function loadStandingsWingfootPreview(root) {
  const mount = root.querySelector("#admin-wingfoot-preview");
  if (!mount) return;

  if (!window.btccDb) {
    mount.hidden = false;
    mount.innerHTML = `<strong>Wingfoot standings</strong><br><span class="tiny muted">Waiting for database…</span>`;
    return;
  }

  mount.hidden = false;
  mount.innerHTML = `<strong>Wingfoot standings</strong><br><span class="tiny muted">Loading…</span>`;

  try {
    let snap;
    try {
      snap = await window.btccDb
        .collection("standings_wingfoot")
        .doc("season_2026")
        .collection("players")
        .orderBy("position")
        .get();
    } catch (err) {
      snap = await window.btccDb
        .collection("standings_wingfoot")
        .doc("season_2026")
        .collection("players")
        .get();
    }

    if (snap.empty) {
      mount.innerHTML = `<strong>Wingfoot standings</strong><br><span class="tiny muted">No Wingfoot standings found yet.</span>`;
      return;
    }

    const rows = snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .sort((a, b) => Number(a.position || 999) - Number(b.position || 999));

    mount.innerHTML = `
      <strong>Wingfoot standings</strong>
      <div class="tiny muted" style="margin-top:6px;">Showing ${rows.length} player(s)</div>
      <div style="margin-top:10px; border:1px solid var(--border); border-radius:12px; padding:10px; background:rgba(255,255,255,.02);">
        <ol class="list" style="margin:0; padding-left:18px;">
          ${rows.map((r) => `<li class="tiny" style="margin:6px 0;">${r.position}. ${r.displayName || r.id} — ${Number(r.pointsTotal || 0)} pts</li>`).join("")}
        </ol>
      </div>
    `;
  } catch (e) {
    console.error("❌ loadStandingsWingfootPreview failed:", e);
    mount.innerHTML = `<strong>Wingfoot standings</strong><br><span class="tiny muted">Failed to load: ${e?.message || e}</span>`;
  }
}
})();