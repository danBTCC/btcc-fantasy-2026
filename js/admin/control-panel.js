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

            // --- SAFE driver totals (post-write, sourced from scored player docs) ---
            const driverTotals = new Map();

            const playerScoresSnap = await window.btccDb
              .collection("event_scores")
              .doc(eid)
              .collection("players")
              .get();

            playerScoresSnap.forEach((doc) => {
              const data = doc.data() || {};
              const perDriver = data.perDriver || {};

              Object.entries(perDriver).forEach(([driverId, pts]) => {
                const prev = Number(driverTotals.get(driverId) || 0);
                driverTotals.set(driverId, prev + Number(pts || 0));
              });
            });

            const driverBatch = window.btccDb.batch();
            const driverBaseRef = window.btccDb.collection("event_scores").doc(eid);

            driverTotals.forEach((pointsTotal, driverId) => {
              driverBatch.set(
                driverBaseRef.collection("drivers").doc(driverId),
                {
                  driverId,
                  pointsTotal: Number(pointsTotal || 0),
                  computedAt: firebase.firestore.FieldValue.serverTimestamp(),
                  engineVersion: "I2.4",
                },
                { merge: false }
              );
            });

            await driverBatch.commit();

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
            await rebuildStandingsRace1(root);
            await rebuildStandingsRace2(root);
            await rebuildStandingsRace3(root);

           const valueResult = await runDriverValueEngineJ1(root, eid);
           const budgetResult = await runPlayerBudgetEngineJ2(root, eid);
           const tierResult = await runDriverTierEngineJ3(root, eid);
           const boostResult = await runBudgetBoostEngineJ4(root, eid);
           const categoryResult = await runCategoryStandingsEngineJ5(root, eid);

           setEngineMsg(
            tierResult.skipped
             ? (boostResult.skipped
               ? `Wrote event_scores for ${entryCount} player(s). Driver values updated for ${valueResult.driverCount} active driver(s) (TDV £${valueResult.tdv.toFixed(2)}, VV ${valueResult.vv.toFixed(2)}). Budgets updated for ${budgetResult.playerCount} player(s). Tiers skipped for Event 1. Budget Boost skipped for Event 1.`
               : `Wrote event_scores for ${entryCount} player(s). Driver values updated for ${valueResult.driverCount} active driver(s) (TDV £${valueResult.tdv.toFixed(2)}, VV ${valueResult.vv.toFixed(2)}). Budgets updated for ${budgetResult.playerCount} player(s). Tiers skipped for Event 1. Budget Boost updated for ${boostResult.playerCount} player(s).`)
             : (boostResult.skipped
                ? `Wrote event_scores for ${entryCount} player(s). Driver values updated for ${valueResult.driverCount} active driver(s) (TDV £${valueResult.tdv.toFixed(2)}, VV ${valueResult.vv.toFixed(2)}). Budgets updated for ${budgetResult.playerCount} player(s). Tiers assigned for ${tierResult.driverCount} driver(s). Budget Boost skipped for Event 1.`
               : `Wrote event_scores for ${entryCount} player(s). Driver values updated for ${valueResult.driverCount} active driver(s) (TDV £${valueResult.tdv.toFixed(2)}, VV ${valueResult.vv.toFixed(2)}). Budgets updated for ${budgetResult.playerCount} player(s). Tiers assigned for ${tierResult.driverCount} driver(s). Budget Boost updated for ${boostResult.playerCount} player(s).`)
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

// --- RACE 1 STANDINGS REBUILD ---
async function rebuildStandingsRace1(root) {
  if (!window.btccDb) throw new Error("Database not ready");
  const eid = root.__selectedEventId;
  if (!eid) throw new Error("No event selected");

  const resultsSnap = await window.btccDb.collection("results").doc(eid).get();
  if (!resultsSnap.exists) throw new Error("No results found for event");

  const results = resultsSnap.data() || {};
  const race1Order = Array.isArray(results.race1) ? results.race1 : [];

  const playerSnap = await window.btccDb.collection("players").get();
  const playerMeta = new Map();
  playerSnap.forEach((doc) => {
    const d = doc.data() || {};
    playerMeta.set(doc.id, {
      displayName: d.displayName || d.name || doc.id,
    });
  });

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

  let entriesSnap = await window.btccDb.collection("entries").doc(eid).collection("entries").get();
  if (entriesSnap.empty) {
    entriesSnap = await window.btccDb.collection("submissions").doc(eid).collection("entries").get();
  }

  const totals = new Map();

  const racePoints = (pos) => (pos >= 1 && pos <= 24 ? 25 - pos : 0);

  entriesSnap.forEach((doc) => {
    const uid = doc.id;
    const data = doc.data() || {};
    const team = normaliseDriverIdsFromEntry(data);

    let total = 0;
    team.forEach((driverId) => {
      const idx = race1Order.indexOf(String(driverId));
      if (idx >= 0) total += racePoints(idx + 1);
    });

    totals.set(uid, {
      uid,
      displayName: playerMeta.get(uid)?.displayName || uid,
      pointsTotal: total,
    });
  });

  const ranked = Array.from(totals.values())
    .sort((a, b) => {
      const pointsDiff = Number(b.pointsTotal || 0) - Number(a.pointsTotal || 0);
      if (pointsDiff !== 0) return pointsDiff;
      return String(a.displayName || "").localeCompare(String(b.displayName || ""));
    })
    .map((row, i) => ({ ...row, position: i + 1 }));

  const batch = window.btccDb.batch();
  const base = window.btccDb.collection("standings_race1").doc("season_2026");

  ranked.forEach((row) => {
    batch.set(base.collection("players").doc(row.uid), {
      uid: row.uid,
      displayName: row.displayName,
      pointsTotal: Number(row.pointsTotal || 0),
      position: row.position,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();

  return { playerCount: ranked.length };
}

// --- RACE 2 STANDINGS REBUILD ---
async function rebuildStandingsRace2(root) {
  if (!window.btccDb) throw new Error("Database not ready");
  const eid = root.__selectedEventId;
  if (!eid) throw new Error("No event selected");

  const resultsSnap = await window.btccDb.collection("results").doc(eid).get();
  if (!resultsSnap.exists) throw new Error("No results found for event");

  const results = resultsSnap.data() || {};
  const race2Order = Array.isArray(results.race2) ? results.race2 : [];

  const playerSnap = await window.btccDb.collection("players").get();
  const playerMeta = new Map();
  playerSnap.forEach((doc) => {
    const d = doc.data() || {};
    playerMeta.set(doc.id, {
      displayName: d.displayName || d.name || doc.id,
    });
  });

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

  let entriesSnap = await window.btccDb.collection("entries").doc(eid).collection("entries").get();
  if (entriesSnap.empty) {
    entriesSnap = await window.btccDb.collection("submissions").doc(eid).collection("entries").get();
  }

  const totals = new Map();
  const racePoints = (pos) => (pos >= 1 && pos <= 24 ? 25 - pos : 0);

  entriesSnap.forEach((doc) => {
    const uid = doc.id;
    const data = doc.data() || {};
    const team = normaliseDriverIdsFromEntry(data);

    let total = 0;
    team.forEach((driverId) => {
      const idx = race2Order.indexOf(String(driverId));
      if (idx >= 0) total += racePoints(idx + 1);
    });

    totals.set(uid, {
      uid,
      displayName: playerMeta.get(uid)?.displayName || uid,
      pointsTotal: total,
    });
  });

  const ranked = Array.from(totals.values())
    .sort((a, b) => {
      const pointsDiff = Number(b.pointsTotal || 0) - Number(a.pointsTotal || 0);
      if (pointsDiff !== 0) return pointsDiff;
      return String(a.displayName || "").localeCompare(String(b.displayName || ""));
    })
    .map((row, i) => ({ ...row, position: i + 1 }));

  const batch = window.btccDb.batch();
  const base = window.btccDb.collection("standings_race2").doc("season_2026");

  ranked.forEach((row) => {
    batch.set(base.collection("players").doc(row.uid), {
      uid: row.uid,
      displayName: row.displayName,
      pointsTotal: Number(row.pointsTotal || 0),
      position: row.position,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();

  return { playerCount: ranked.length };
}

// --- RACE 3 STANDINGS REBUILD ---
async function rebuildStandingsRace3(root) {
  if (!window.btccDb) throw new Error("Database not ready");
  const eid = root.__selectedEventId;
  if (!eid) throw new Error("No event selected");

  const resultsSnap = await window.btccDb.collection("results").doc(eid).get();
  if (!resultsSnap.exists) throw new Error("No results found for event");

  const results = resultsSnap.data() || {};
  const race3Order = Array.isArray(results.race3) ? results.race3 : [];

  const playerSnap = await window.btccDb.collection("players").get();
  const playerMeta = new Map();
  playerSnap.forEach((doc) => {
    const d = doc.data() || {};
    playerMeta.set(doc.id, {
      displayName: d.displayName || d.name || doc.id,
    });
  });

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

  let entriesSnap = await window.btccDb.collection("entries").doc(eid).collection("entries").get();
  if (entriesSnap.empty) {
    entriesSnap = await window.btccDb.collection("submissions").doc(eid).collection("entries").get();
  }

  const totals = new Map();
  const racePoints = (pos) => (pos >= 1 && pos <= 24 ? 25 - pos : 0);

  entriesSnap.forEach((doc) => {
    const uid = doc.id;
    const data = doc.data() || {};
    const team = normaliseDriverIdsFromEntry(data);

    let total = 0;
    team.forEach((driverId) => {
      const idx = race3Order.indexOf(String(driverId));
      if (idx >= 0) total += racePoints(idx + 1);
    });

    totals.set(uid, {
      uid,
      displayName: playerMeta.get(uid)?.displayName || uid,
      pointsTotal: total,
    });
  });

  const ranked = Array.from(totals.values())
    .sort((a, b) => {
      const pointsDiff = Number(b.pointsTotal || 0) - Number(a.pointsTotal || 0);
      if (pointsDiff !== 0) return pointsDiff;
      return String(a.displayName || "").localeCompare(String(b.displayName || ""));
    })
    .map((row, i) => ({ ...row, position: i + 1 }));

  const batch = window.btccDb.batch();
  const base = window.btccDb.collection("standings_race3").doc("season_2026");

  ranked.forEach((row) => {
    batch.set(base.collection("players").doc(row.uid), {
      uid: row.uid,
      displayName: row.displayName,
      pointsTotal: Number(row.pointsTotal || 0),
      position: row.position,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();

  return { playerCount: ranked.length };
}

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

// exports
window.loadSelectedEventMetaAndResults = loadSelectedEventMetaAndResults;
window.renderResultsPreview = renderResultsPreview;
window.loadEventScoresPreview = loadEventScoresPreview;
window.loadStandingsPlayersPreview = loadStandingsPlayersPreview;
window.loadStandingsTeamsPreview = loadStandingsTeamsPreview;
window.loadStandingsDriversPreview = loadStandingsDriversPreview;
window.loadStandingsWingfootPreview = loadStandingsWingfootPreview;

window.rebuildStandingsPlayersI3 = rebuildStandingsPlayersI3;
window.rebuildStandingsTeamsI3_2 = rebuildStandingsTeamsI3_2;
window.rebuildStandingsDriversI3_3 = rebuildStandingsDriversI3_3;
window.rebuildStandingsWingfootI3_4 = rebuildStandingsWingfootI3_4;
window.rebuildStandingsRace1 = rebuildStandingsRace1;
window.rebuildStandingsRace2 = rebuildStandingsRace2;
window.rebuildStandingsRace3 = rebuildStandingsRace3;

})();