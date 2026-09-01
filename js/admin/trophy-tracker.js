// Admin-only, read-only trophy tracker.
// Rankings come from getBtccStandingsSnapshot(), the same loader used by the public Standings page.

(function () {
  const PLAYER_TABLES = [
    { key: "overall", label: "Overall Championship", awards: ["trophy", "trophy", "trophy"] },
    { key: "wingfoot", label: "WingFoot (Qualifying)", awards: ["trophy", "trophy", "trophy"] },
    { key: "manufacturer", label: "Manufacturer", awards: ["trophy", "medal", "medal"] },
    { key: "independent", label: "Independents", awards: ["trophy", "medal", "medal"] },
    { key: "jacksears", label: "Jack Sears", awards: ["trophy", "medal", "medal"] },
    { key: "race1", label: "Race 1", awards: ["trophy", "medal", "medal"] },
    { key: "race2", label: "Race 2", awards: ["trophy", "medal", "medal"] },
    { key: "race3", label: "Race 3", awards: ["trophy", "medal", "medal"] },
  ];

  const AWARD_LABELS = {
    trophy: "Trophy",
    medal: "Medal",
    plate: "Plate",
  };

  const AWARD_ICONS = {
    trophy: "🏆",
    medal: "🏅",
    plate: "🍽️",
  };

  const AWARD_COUNT_KEYS = {
    trophy: "trophies",
    medal: "medals",
    plate: "plates",
  };

  let unsubscribeStandings = [];
  let reloadTimer = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function buildTrackerModel(standings, players) {
    const awardsByPlayer = new Map();
    const tables = PLAYER_TABLES.map((table) => {
      const standingsRows = Array.isArray(standings?.[table.key]) ? standings[table.key] : [];
      const recipients = table.awards.map((award, index) => {
        const row = standingsRows[index] || null;
        if (!row) return { position: index + 1, award, player: null };

        const playerId = String(row.id || "");
        const summary = awardsByPlayer.get(playerId) || {
          id: playerId,
          name: row.name || "Unnamed",
          trophies: 0,
          medals: 0,
          plates: 0,
        };
        summary[AWARD_COUNT_KEYS[award]] += 1;
        awardsByPlayer.set(playerId, summary);

        return { position: index + 1, award, player: row };
      });
      return { ...table, recipients };
    });

    const winningTeam = Array.isArray(standings?.teams) ? (standings.teams[0] || null) : null;
    const teamMembers = winningTeam
      ? players
          .filter((player) => String(player.teamId || "") === String(winningTeam.id || ""))
          .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
      : [];
    const teamPlateRecipients = winningTeam
      ? Array.from({ length: 4 }, (_, index) => teamMembers[index] || null)
      : [];

    teamPlateRecipients.forEach((player, index) => {
      const playerId = player ? String(player.id || "") : `missing-team-plate-${index + 1}`;
      const summary = awardsByPlayer.get(playerId) || {
        id: playerId,
        name: player?.name || "Unassigned team plate recipient",
        trophies: 0,
        medals: 0,
        plates: 0,
        missingRecipient: !player,
      };
      summary.plates += 1;
      awardsByPlayer.set(playerId, summary);
    });

    const summary = Array.from(awardsByPlayer.values()).sort((a, b) => {
      const aTotal = a.trophies + a.medals + a.plates;
      const bTotal = b.trophies + b.medals + b.plates;
      return bTotal - aTotal || a.name.localeCompare(b.name);
    });

    const counts = summary.reduce((totals, player) => ({
      trophies: totals.trophies + player.trophies,
      medals: totals.medals + player.medals,
      plates: totals.plates + player.plates,
    }), { trophies: 0, medals: 0, plates: 0 });

    return {
      tables,
      winningTeam,
      teamMembers,
      teamPlateRecipients,
      summary,
      counts,
      physicalAwardCount: counts.trophies + counts.medals + counts.plates,
    };
  }

  function recipientRow(recipient) {
    const award = AWARD_LABELS[recipient.award];
    const icon = AWARD_ICONS[recipient.award];
    if (!recipient.player) {
      return `
        <div class="trophy-recipient trophy-recipient--empty">
          <span class="trophy-position">${recipient.position}</span>
          <span>No current recipient</span>
          <span class="trophy-award">${icon} ${award}</span>
        </div>
      `;
    }

    return `
      <div class="trophy-recipient">
        <span class="trophy-position">${recipient.position}</span>
        <span class="trophy-recipient__name">${escapeHtml(recipient.player.name)}</span>
        <span class="trophy-recipient__points">${Number(recipient.player.points || 0)} pts</span>
        <span class="trophy-award trophy-award--${recipient.award}">${icon} ${award}</span>
      </div>
    `;
  }

  function renderTracker(mount, model) {
    const countStatus = model.physicalAwardCount === 28
      ? "28 physical awards currently allocated"
      : `${model.physicalAwardCount} of 28 physical awards currently allocated`;
    const teamMemberWarning = model.winningTeam && model.teamMembers.length !== 4
      ? `<div class="note warnNote tiny" style="margin-top:10px;">The leading team currently has ${model.teamMembers.length} linked member(s); four plate recipients are expected. Check player team assignments.</div>`
      : "";

    mount.innerHTML = `
      <div class="trophy-totals" aria-label="Current physical award totals">
        <div><strong>${model.counts.trophies}</strong><span>🏆 Trophies</span></div>
        <div><strong>${model.counts.medals}</strong><span>🏅 Medals</span></div>
        <div><strong>${model.counts.plates}</strong><span>🍽️ Plates</span></div>
      </div>
      <p class="tiny muted" style="margin:10px 0 0;">${countStatus}. Positions and ties follow the live Standings tables exactly.</p>

      <h3 class="trophy-section-title">Current recipients by standings table</h3>
      <div class="trophy-table-grid">
        ${model.tables.map((table) => `
          <section class="trophy-table-card" data-trophy-table="${table.key}">
            <h4>${escapeHtml(table.label)}</h4>
            ${table.recipients.map(recipientRow).join("")}
          </section>
        `).join("")}

        <section class="trophy-table-card trophy-table-card--team" data-trophy-table="teams">
          <h4>Teams</h4>
          ${model.winningTeam ? `
            <div class="trophy-team-winner">
              <span class="trophy-position">1</span>
              <span><strong>${escapeHtml(model.winningTeam.name)}</strong><br><span class="tiny muted">${Number(model.winningTeam.points || 0)} pts</span></span>
            </div>
            <div class="trophy-team-members">
              ${model.teamPlateRecipients.map((member) => member
                ? `<span>🍽️ ${escapeHtml(member.name)} — Plate</span>`
                : '<span class="trophy-missing-recipient">🍽️ Unassigned recipient — Plate</span>'
              ).join("")}
            </div>
          ` : '<div class="tiny muted">No current winning team</div>'}
          ${teamMemberWarning}
        </section>
      </div>

      <h3 class="trophy-section-title">Per-player order summary</h3>
      <div class="trophy-summary">
        ${model.summary.map((player) => `
          <div class="trophy-summary__row">
            <strong${player.missingRecipient ? ' class="trophy-missing-recipient"' : ""}>${escapeHtml(player.name)}</strong>
            <span>${player.trophies ? `🏆 ${player.trophies}` : ""}</span>
            <span>${player.medals ? `🏅 ${player.medals}` : ""}</span>
            <span>${player.plates ? `🍽️ ${player.plates}` : ""}</span>
          </div>
        `).join("") || '<div class="tiny muted">No awards can be allocated yet.</div>'}
      </div>
      <p class="tiny muted" style="margin:10px 0 0;">Live data checked ${new Date().toLocaleString("en-GB")}.</p>
    `;
  }

  async function loadPlayers() {
    const snapshot = await window.btccDb.collection("players").get();
    return snapshot.docs.map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        name: data.displayName || data.name || doc.id,
        teamId: data.teamId || "",
        teamName: data.teamName || "",
      };
    });
  }

  async function loadTracker(root) {
    const mount = root.querySelector("#admin-trophy-tracker");
    const status = root.querySelector("#admin-trophy-tracker-status");
    if (!mount || !status) return;
    if (root.__trophyTrackerLoading) {
      root.__trophyTrackerReloadPending = true;
      return;
    }

    root.__trophyTrackerLoading = true;
    status.textContent = "Updating from live standings…";
    try {
      if (!window.btccDb) throw new Error("Database not ready");
      if (typeof window.getBtccStandingsSnapshot !== "function") {
        throw new Error("Standings loader not available");
      }

      const [standings, players] = await Promise.all([
        window.getBtccStandingsSnapshot(),
        loadPlayers(),
      ]);
      if (!standings || typeof standings !== "object") {
        throw new Error("Live standings could not be loaded");
      }
      const model = buildTrackerModel(standings, players);
      renderTracker(mount, model);
      root.__trophyTrackerModel = model;
      status.textContent = "Read-only • auto-updates with standings";
    } catch (error) {
      console.error("❌ Trophy Tracker failed:", error);
      status.textContent = "Could not load Trophy Tracker";
      mount.innerHTML = `<div class="note warnNote">Failed to load current awards.<br><span class="tiny muted">${escapeHtml(error?.message || error)}</span></div>`;
    } finally {
      root.__trophyTrackerLoading = false;
      if (root.__trophyTrackerReloadPending) {
        root.__trophyTrackerReloadPending = false;
        loadTracker(root);
      }
    }
  }

  function stopWatchingStandings() {
    unsubscribeStandings.forEach((unsubscribe) => unsubscribe());
    unsubscribeStandings = [];
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = null;
  }

  function watchStandings(root) {
    stopWatchingStandings();
    if (!window.btccDb) return;

    const seasonPlayers = (collectionName) => window.btccDb
      .collection(collectionName)
      .doc("season_2026")
      .collection("players");
    const refs = [
      seasonPlayers("standings_players"),
      seasonPlayers("standings_wingfoot"),
      seasonPlayers("standings_manufacturer"),
      seasonPlayers("standings_independent"),
      seasonPlayers("standings_jacksears"),
      seasonPlayers("standings_race1"),
      seasonPlayers("standings_race2"),
      seasonPlayers("standings_race3"),
      window.btccDb.collection("standings_teams").doc("season_2026").collection("teams"),
    ];

    refs.forEach((ref) => {
      let initialSnapshot = true;
      const unsubscribe = ref.onSnapshot(() => {
        if (initialSnapshot) {
          initialSnapshot = false;
          return;
        }
        if (reloadTimer) clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => loadTracker(root), 350);
      }, (error) => {
        console.warn("Trophy Tracker live update unavailable for one standings table:", error?.message || error);
      });
      unsubscribeStandings.push(unsubscribe);
    });
  }

  function setupAdminTrophyTracker(root) {
    loadTracker(root);
    watchStandings(root);
  }

  window.setupAdminTrophyTracker = setupAdminTrophyTracker;
  window.stopAdminTrophyTracker = stopWatchingStandings;
  window.btccTrophyTracker = { buildTrackerModel };
})();
