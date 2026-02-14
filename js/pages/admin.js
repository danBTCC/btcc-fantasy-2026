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

  async function loadAdminEventPicker(root) {
    const wrap = root.querySelector("#admin-results-entry");
    if (!wrap) return;

    // Ensure Firestore is ready
    if (!window.btccDb) {
      wrap.innerHTML = `<div class="tiny muted">Waiting for database…</div>`;
      setTimeout(() => loadAdminEventPicker(root), 300);
      return;
    }

    wrap.innerHTML = `<div class="tiny muted">Loading events…</div>`;

    try {
      const snap = await window.btccDb.collection("events").orderBy("eventNo").get();

      if (snap.empty) {
        wrap.innerHTML = `<div class="note warnNote">No events found.</div>`;
        return;
      }

      const fmtDate = (v) => {
        if (v && typeof v.toDate === "function") return v.toDate().toLocaleDateString("en-GB");
        if (typeof v === "string" && v.length >= 10) {
          const d = new Date(v);
          if (!isNaN(d)) return d.toLocaleDateString("en-GB");
          return v;
        }
        return "—";
      };

      const rows = snap.docs.map((doc) => {
        const d = doc.data() || {};
        const from = fmtDate(d.dateFrom);
        const to = fmtDate(d.dateTo);
        const dates = from !== "—" && to !== "—" ? `${from}–${to}` : from;
        const rounds = d.roundFrom && d.roundTo ? `R${d.roundFrom}–${d.roundTo}` : "";
        const status = (d.status || "upcoming").toString();
        return {
          id: doc.id,
          eventNo: d.eventNo ?? "—",
          title: d.venue ?? d.name ?? "Unnamed",
          dates,
          rounds,
          status,
        };
      });

      wrap.innerHTML = `
        <div class="note" style="margin-top:10px;">
          <strong>Select event</strong>
          <div class="tiny muted" style="margin-top:6px;">Pick an event to start entering Qualifying and Race results (next steps).</div>
        </div>

        <ul class="list" id="admin-events-list" style="margin-top:10px;">
          ${rows
            .map(
              (e) => `
              <li class="eventItem" data-event-id="${e.id}">
                <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
                  <div>
                    <strong>Event ${e.eventNo}</strong> — ${e.title}<br>
                    <span class="tiny muted">${e.rounds} • ${e.dates} • ${e.status}</span>
                  </div>
                  <button type="button" class="tile tinyBtn" data-action="select-event">Select</button>
                </div>
              </li>
            `
            )
            .join("")}
        </ul>

        <div id="admin-selected-event" class="note" style="margin-top:10px;" hidden>
          <strong>Selected:</strong> <span id="admin-selected-event-label" class="tiny muted"></span>
        </div>
      `;

      const selectedBox = wrap.querySelector("#admin-selected-event");
      const selectedLabel = wrap.querySelector("#admin-selected-event-label");

      wrap.querySelectorAll("[data-action='select-event']").forEach((btn) => {
        btn.addEventListener("click", () => {
          const li = btn.closest("[data-event-id]");
          const eventId = li?.getAttribute("data-event-id");
          if (!eventId) return;

          const match = rows.find((r) => r.id === eventId);
          root.__selectedEventId = eventId;
          root.__draftQuali = null;
          root.__eventLocked = false;
          renderQualifyingForm(root);
          renderRaceForms(root);
          loadSelectedEventMetaAndResults(root);

          // Visual highlight
          wrap.querySelectorAll("[data-event-id]").forEach((x) => {
            x.style.outline = "none";
          });
          li.style.outline = "2px solid rgba(250, 204, 21, 0.45)";

          if (selectedBox && selectedLabel && match) {
            selectedBox.hidden = false;
            selectedLabel.textContent = `Event ${match.eventNo} — ${match.title}`;
          }

          console.log("✅ Admin selected event:", eventId);
        });
      });

      console.log("✅ Admin events loaded:", snap.size);
    } catch (err) {
      console.error("❌ loadAdminEventPicker failed:", err);
      wrap.innerHTML = `
        <div class="note warnNote">
          Failed to load events.<br>
          <span class="tiny muted">${err?.message || err}</span>
        </div>
      `;
    }
  }

  async function loadAdminDrivers(root) {
    const el = root.querySelector("#admin-drivers-status");
    if (!el) return;

    // Ensure Firestore is ready
    if (!window.btccDb) {
      el.textContent = "Drivers: Waiting for database…";
      setTimeout(() => loadAdminDrivers(root), 300);
      return;
    }

    el.textContent = "Drivers: Loading…";

    try {
      const snap = await window.btccDb.collection("drivers").orderBy("name").get();

      if (snap.empty) {
        el.textContent = "Drivers: none found";
        root.__drivers = [];
        return;
      }

      const list = snap.docs.map((doc) => {
        const d = doc.data() || {};
        return {
          id: doc.id,
          name: d.name ?? "Unnamed",
          price: Number(d.price ?? d.cost ?? 0),
        };
      });

      root.__drivers = list;
      // Re-render preview now that we can map driverIds -> names
      renderResultsPreview(root);
      el.textContent = `Drivers loaded: ${list.length}`;
      console.log("✅ Admin drivers loaded:", list.length);
    } catch (err) {
      console.error("❌ loadAdminDrivers failed:", err);
      el.textContent = `Drivers: failed to load (${err?.message || err})`;
      root.__drivers = [];
    }
  }

  function renderQualifyingForm(root) {
    const mount = root.querySelector("#admin-results-form");
    if (!mount) return;

    const eventId = root.__selectedEventId;
    const drivers = Array.isArray(root.__drivers) ? root.__drivers : [];

    if (!eventId) {
      mount.innerHTML = `
        <div class="note" style="margin-top:10px;">
          <strong>Qualifying</strong><br>
          <span class="tiny muted">Select an event above to start entering qualifying positions.</span>
        </div>
      `;
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

    // For v1 UI, we enter positions for all drivers in the current test set.
    const N = drivers.length;

    const options = drivers
      .map((d) => `<option value="${d.id}">${d.name}</option>`)
      .join("");

    mount.innerHTML = `
      <div class="card" style="margin-top:10px;">
        <h2 style="margin:0 0 6px 0;">Qualifying</h2>
        <div class="tiny muted" style="margin-bottom:10px;">
          Event ID: <span class="tiny">${eventId}</span><br>
          Enter finishing order. No saving yet (next step).
        </div>

        <div id="admin-quali-validation" class="note warnNote" hidden></div>

        <div id="admin-quali-grid" style="display:flex; flex-direction:column; gap:10px;">
          ${Array.from({ length: N }).map((_, i) => {
            const pos = i + 1;
            return `
              <div style="display:flex; gap:10px; align-items:center;">
                <div style="min-width:64px;"><strong>P${pos}</strong></div>
                <select data-quali-pos="${pos}" style="flex:1; padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);">
                  <option value="">Select driver…</option>
                  ${options}
                </select>
              </div>
            `;
          }).join("")}
        </div>

        <button type="button" id="admin-quali-preview" class="tile" style="margin-top:12px;" disabled>
          Save qualifying
        </button>
      </div>
    `;

    const validationEl = mount.querySelector("#admin-quali-validation");
    const previewBtn = mount.querySelector("#admin-quali-preview");
    const btn = previewBtn;

    const validate = () => {
      const selects = Array.from(mount.querySelectorAll("select[data-quali-pos]"));
      const chosen = selects.map((s) => s.value).filter(Boolean);

      const dupes = chosen.filter((v, idx) => chosen.indexOf(v) !== idx);
      const missing = selects.filter((s) => !s.value).length;

      const issues = [];
      if (missing > 0) issues.push(`Select a driver for all positions (${missing} missing).`);
      if (dupes.length > 0) issues.push("Each driver can only appear once.");

      const valid = issues.length === 0;

      if (validationEl) {
        if (valid) {
          validationEl.hidden = true;
        } else {
          validationEl.hidden = false;
          validationEl.innerHTML = `<strong>Fix this:</strong><br><span class="tiny muted">${issues.join("<br>")}</span>`;
        }
      }

      if (previewBtn) previewBtn.disabled = !valid;

      // Store draft for next step (no Firestore write)
      root.__draftQuali = selects.map((s) => s.value || null);
      renderResultsPreview(root);
    };

    mount.querySelectorAll("select[data-quali-pos]").forEach((sel) => {
      sel.addEventListener("change", validate);
    });

    // Initial validation state
    validate();

    // H7.3 — disable qualifying inputs if locked
if (root.__eventMeta?.resultsLocked === true) {
  mount.querySelectorAll("select").forEach(s => s.disabled = true);
  const saveBtn = mount.querySelector("#admin-quali-preview");
  if (saveBtn) saveBtn.disabled = true;
}

    btn?.addEventListener("click", async () => {
      // Guard
      if (!window.btccDb) {
        if (validationEl) {
          validationEl.hidden = false;
          validationEl.innerHTML = `<strong>Save failed.</strong><br><span class="tiny muted">Database not ready.</span>`;
        }
        return;
      }

      const eventId2 = root.__selectedEventId;
      if (!eventId2) return;

      // Ensure draft exists and is valid
      const draft = Array.isArray(root.__draftQuali) ? root.__draftQuali : [];
      const ids = draft.filter(Boolean);
      const hasDupes = ids.some((v, i) => ids.indexOf(v) !== i);
      const hasMissing = draft.some((v) => !v);
      if (hasMissing || hasDupes) {
        if (validationEl) {
          validationEl.hidden = false;
          validationEl.innerHTML = `<strong>Fix this:</strong><br><span class="tiny muted">Please complete the grid with no duplicates.</span>`;
        }
        return;
      }

      // Lock check (optional in UI; enforce later)
      if (root.__eventLocked === true) {
        if (validationEl) {
          validationEl.hidden = false;
          validationEl.innerHTML = `<strong>Locked:</strong><br><span class="tiny muted">Results are locked for this event.</span>`;
        }
        return;
      }

      try {
        btn.disabled = true;
        btn.textContent = "Saving…";

        const resultsRef = window.btccDb.collection("results").doc(eventId2);
        await resultsRef.set(
          {
            qualifying: draft,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        const user = firebase.auth().currentUser;
        const who = user?.email || "admin";

        await window.btccDb.collection("events").doc(eventId2).set(
          {
            resultsUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            resultsUpdatedBy: who,
          },
          { merge: true }
        );

        btn.textContent = `Saved ${new Date().toLocaleString("en-GB")}`;
        console.log("✅ Qualifying saved:", eventId2, draft);
      } catch (err) {
        console.error("❌ Save qualifying failed:", err);
        if (validationEl) {
          validationEl.hidden = false;
          validationEl.innerHTML = `<strong>Save failed.</strong><br><span class="tiny muted">${err?.message || err}</span>`;
        }
        btn.textContent = "Save qualifying";
      } finally {
        btn.disabled = false;
      }
    });
  }

  function renderAdminUnlocked(root, email) {
    render(
      root,
      `
      <h1>Admin</h1>
      <p class="muted">Admin unlocked for <strong>${email}</strong></p>

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
    renderQualifyingForm(root);
    renderRaceForms(root);
    renderResultsPreview(root);
  }

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

      <div id="admin-${raceKey}-grid" style="display:flex; flex-direction:column; gap:10px;">
        ${Array.from({ length: N }).map((_, i) => {
          const pos = i + 1;
          return `
            <div style="display:flex; gap:10px; align-items:center;">
              <div style="min-width:64px;"><strong>P${pos}</strong></div>
              <select data-${raceKey}-pos="${pos}" style="flex:1; padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);">
                <option value="">Select driver…</option>
                ${options}
              </select>
            </div>
          `;
        }).join("")}
      </div>

      <button type="button" id="admin-${raceKey}-save" class="tile" style="margin-top:12px;" disabled>
        Save ${title} (next step)
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
      const selects = Array.from(mount.querySelectorAll(`select[data-${raceKey}-pos]`));
      const chosen = selects.map(s => s.value).filter(Boolean);

      const dupes = chosen.filter((v, idx) => chosen.indexOf(v) !== idx);
      const missing = selects.filter(s => !s.value).length;

      const issues = [];
      if (missing > 0) issues.push(`Select a driver for all positions (${missing} missing).`);
      if (dupes.length > 0) issues.push("Each driver can only appear once.");

      const valid = issues.length === 0;

      if (validationEl) {
        if (valid) validationEl.hidden = true;
        else {
          validationEl.hidden = false;
          validationEl.innerHTML = `<strong>Fix this:</strong><br><span class="tiny muted">${issues.join("<br>")}</span>`;
        }
      }

      if (saveBtn) saveBtn.disabled = !valid;

      // Store drafts for next step (no Firestore write)
      const draft = selects.map(s => s.value || null);
      if (raceKey === "race1") root.__draftRace1 = draft;
      if (raceKey === "race2") root.__draftRace2 = draft;
      if (raceKey === "race3") root.__draftRace3 = draft;
      renderResultsPreview(root);
    };

    mount.querySelectorAll(`select[data-${raceKey}-pos]`).forEach(sel => {
      sel.addEventListener("change", validate);
    });

    validate();
  };

  wireValidation("race1");
  wireValidation("race2");
  wireValidation("race3");
}

// H7.3 — disable race inputs if locked
if (root.__eventMeta?.resultsLocked === true) {
  mount.querySelectorAll("select").forEach(s => s.disabled = true);
  mount.querySelectorAll("button[id^='admin-race']").forEach(b => b.disabled = true);
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
  // --- H7.1: Admin Results Preview panel (read-only, no lock/unlock writes) ---
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
    } catch (err) {
      console.error("❌ loadSelectedEventMetaAndResults failed:", err);
      root.__eventMeta = null;
      root.__savedResults = null;
      renderResultsPreview(root, err);
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
      : (Array.isArray(root.__draftQuali) ? root.__draftQuali : []);

    const race1Ids = (saved && Array.isArray(saved.race1) && saved.race1.length)
      ? saved.race1
      : (Array.isArray(root.__draftRace1) ? root.__draftRace1 : []);

    const race2Ids = (saved && Array.isArray(saved.race2) && saved.race2.length)
      ? saved.race2
      : (Array.isArray(root.__draftRace2) ? root.__draftRace2 : []);

    const race3Ids = (saved && Array.isArray(saved.race3) && saved.race3.length)
      ? saved.race3
      : (Array.isArray(root.__draftRace3) ? root.__draftRace3 : []);

    const qualiNames = idsToNames(qualiIds);
    const race1Names = idsToNames(race1Ids);
    const race2Names = idsToNames(race2Ids);
    const race3Names = idsToNames(race3Ids);

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

    const section = (title, names) => {
      const filled = Array.isArray(names) && names.some((n) => n && n !== "—");
      return `
        <div class="note" style="margin-top:10px;">
          <strong>${title}</strong>
          <div class="tiny muted" style="margin-top:6px;">${filled ? "Full order preview." : "Not available yet."}</div>
          <div style="max-height:260px; overflow:auto; margin-top:10px; border:1px solid var(--border); border-radius:12px; padding:10px; background:rgba(255,255,255,.02);">
            <ol class="list" style="margin:0; padding-left:18px;">
              ${names.map((n, i) => `<li class="tiny" style="margin:6px 0;">${i + 1}. ${n}</li>`).join("")}
            </ol>
          </div>
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
        ${section("Qualifying", qualiNames)}
        ${section("Race 1", race1Names)}
        ${section("Race 2", race2Names)}
        ${section("Race 3", race3Names)}
        <div id="admin-lock-msg" class="note warnNote" hidden style="margin-top:12px;"></div>

        ${meta?.resultsLocked === true
          ? `<div class="note" style="margin-top:12px;"><strong>Locked</strong><br><span class="tiny muted">This event is locked. Unlock comes next (H7.4).</span></div>`
          : `<button type="button" id="admin-lock-results" class="tile" style="margin-top:12px;">Lock results (set complete)</button>`
        }

        <div class="tiny muted" style="margin-top:10px;">H7.2 writes lock + status to events/${eventId}. Inputs are still editable until H7.3.</div>
      </div>
    `;

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
  }