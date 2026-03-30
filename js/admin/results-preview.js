   (function () {
  
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

    }

    window.loadSelectedEventMetaAndResults = loadSelectedEventMetaAndResults;
window.renderResultsPreview = renderResultsPreview;
window.loadEventScoresPreview = loadEventScoresPreview;
window.loadStandingsPlayersPreview = loadStandingsPlayersPreview;
window.loadStandingsTeamsPreview = loadStandingsTeamsPreview;
window.loadStandingsDriversPreview = loadStandingsDriversPreview;
window.loadStandingsWingfootPreview = loadStandingsWingfootPreview;

})();