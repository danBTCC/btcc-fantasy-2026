(function () {
  const VOTE_ID = "2027-player-vote";
  const DEFAULT_VERSION = "2027.1";
  const fieldLabels = {
    p1_minimum_budget: "Proposal 1 — Minimum Budget Protection",
    p2_sld_premium: "Proposal 2 — Season Long Driver Premium",
    p3_sld_star_pricing: "Proposal 3 — SLD + Star Driver Pricing",
    p4_form_driver: "Proposal 4 — Form Driver",
    p5_team_names: "Proposal 5 — Team Names",
    p6_team_weekend_bonus: "Proposal 6 — Team of the Weekend Bonus",
    p7_team_captain: "Proposal 7 — Team Captain",
    p8_qualifying_format: "Proposal 8 — New Qualifying Format",
    p9_extra_competitions: "Proposal 9 — Extra Competitions",
    p10_pit_stop_pot: "Proposal 10 — Pit Stop Pot",
  };

  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const formatTimestamp = (timestamp) => timestamp?.toDate?.().toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }) || "—";

  function displayAnswer(field, value) {
    if (value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length)) return "—";
    const options = window.btccPlayerVoteOptions?.[field] || [];
    if (Array.isArray(value)) return value.map((item) => options[Number(item) - 1] || String(item)).join("; ");
    return options[Number(value) - 1] || String(value);
  }

  async function setupAdminPlayerVote(root) {
    const body = root.querySelector("#admin-player-vote-body");
    if (!body || body.dataset.bound) return;
    body.dataset.bound = "true";

    const status = root.querySelector("#admin-player-vote-status");
    const playersElement = root.querySelector("#admin-player-vote-players");
    const detail = root.querySelector("#admin-player-vote-detail");
    const aggregates = root.querySelector("#admin-player-vote-aggregates");
    const saveButton = root.querySelector("#admin-player-vote-config-save");
    const reloadButton = root.querySelector("#admin-player-vote-reload");

    try {
      const currentUser = firebase.auth().currentUser;
      const token = await currentUser?.getIdTokenResult();
      if (!currentUser || token?.claims?.admin !== true) {
        throw new Error("The Firebase Admin custom claim is required to manage Player Vote responses.");
      }

      const voteRef = window.btccDb.collection("questionnaires").doc(VOTE_ID);
      const responsesRef = voteRef.collection("responses");

      async function load() {
        status.textContent = "Loading Player Vote data…";
        const [configSnapshot, playersSnapshot, responsesSnapshot] = await Promise.all([
          voteRef.get(),
          window.btccDb.collection("players").get(),
          responsesRef.get(),
        ]);
        const voteConfig = configSnapshot.exists ? configSnapshot.data() : {};
        root.querySelector("#admin-player-vote-enabled").checked = voteConfig.enabled === true;
        root.querySelector("#admin-player-vote-version").value = voteConfig.version || DEFAULT_VERSION;

        const responses = new Map(responsesSnapshot.docs.map((doc) => [doc.id, { uid: doc.id, ...doc.data() }]));
        const players = playersSnapshot.docs
          .map((doc) => ({
            uid: doc.id,
            name: String(doc.data().displayName || doc.data().name || doc.id),
            active: doc.data().active !== false,
          }))
          .filter((player) => player.active)
          .sort((a, b) => a.name.localeCompare(b.name));

        const submitted = players.filter((player) => responses.get(player.uid)?.status === "submitted").length;
        const drafts = players.filter((player) => responses.get(player.uid)?.status === "draft").length;
        const percentage = players.length ? Math.round(submitted / players.length * 100) : 0;
        status.textContent = `${submitted} / ${players.length} voted (${percentage}%) · ${drafts} in progress · ${players.length - submitted - drafts} not started`;

        playersElement.innerHTML = `
          <div class="tableWrap"><table>
            <thead><tr><th>Player</th><th>Status</th><th>Updated</th><th></th></tr></thead>
            <tbody>${players.map((player) => {
              const playerResponse = responses.get(player.uid);
              const state = playerResponse?.status === "submitted" ? "Voted" : playerResponse ? "In progress" : "Not started";
              return `<tr>
                <td>${escapeHtml(player.name)}</td><td>${state}</td>
                <td>${escapeHtml(formatTimestamp(playerResponse?.updatedAt))}</td>
                <td><button class="tile tinyBtn" type="button" data-player-vote-player="${escapeHtml(player.uid)}">Open</button></td>
              </tr>`;
            }).join("")}</tbody>
          </table></div>`;

        playersElement.querySelectorAll("[data-player-vote-player]").forEach((button) => {
          button.addEventListener("click", () => {
            const player = players.find((candidate) => candidate.uid === button.dataset.playerVotePlayer);
            const playerResponse = responses.get(player.uid);
            if (!playerResponse) {
              detail.innerHTML = `<div class="note">${escapeHtml(player.name)} has not voted yet.</div>`;
              return;
            }
            detail.innerHTML = `
              <div class="note">
                <strong>${escapeHtml(player.name)}</strong><br>
                Status: ${escapeHtml(playerResponse.status)} · Version: ${escapeHtml(playerResponse.voteVersion)}<br>
                Started: ${escapeHtml(formatTimestamp(playerResponse.startedAt))} · Updated: ${escapeHtml(formatTimestamp(playerResponse.updatedAt))} · Submitted: ${escapeHtml(formatTimestamp(playerResponse.submittedAt))}
              </div>
              <div class="tableWrap"><table><tbody>
                ${Object.keys(fieldLabels).map((field) => `<tr><th>${escapeHtml(fieldLabels[field])}</th><td>${escapeHtml(displayAnswer(field, playerResponse.answers?.[field]))}</td></tr>`).join("")}
              </tbody></table></div>`;
          });
        });

        const submittedResponses = [...responses.values()].filter((item) => item.status === "submitted");
        if (!submittedResponses.length) {
          aggregates.innerHTML = '<div class="tiny muted">No submitted votes to aggregate yet.</div>';
          return;
        }
        aggregates.innerHTML = Object.keys(fieldLabels).map((field) => {
          const counts = new Map();
          submittedResponses.forEach((item) => {
            const rawValue = item.answers?.[field];
            const values = Array.isArray(rawValue) ? rawValue : rawValue ? [rawValue] : [];
            values.forEach((value) => counts.set(String(value), (counts.get(String(value)) || 0) + 1));
          });
          if (!counts.size) return "";
          return `<div class="note questionnaireAggregate"><strong>${escapeHtml(fieldLabels[field])}</strong><ul class="list tiny">${[...counts]
            .sort((a, b) => b[1] - a[1])
            .map(([value, count]) => `<li><strong>${count}</strong> — ${escapeHtml(displayAnswer(field, value))}</li>`).join("")}</ul></div>`;
        }).join("");
      }

      saveButton.addEventListener("click", async () => {
        try {
          saveButton.disabled = true;
          const version = root.querySelector("#admin-player-vote-version").value.trim();
          if (!version) throw new Error("A Player Vote version is required.");
          await voteRef.set({
            title: "BTCC Fantasy League — 2027 Player Vote",
            version,
            enabled: root.querySelector("#admin-player-vote-enabled").checked,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: currentUser.uid,
          }, { merge: true });
          await load();
        } catch (error) {
          status.textContent = error?.message || "Player Vote configuration could not be saved.";
        } finally {
          saveButton.disabled = false;
        }
      });
      reloadButton.addEventListener("click", load);
      await load();
    } catch (error) {
      status.textContent = error?.message || "Player Vote data could not be loaded.";
    }
  }

  window.setupAdminPlayerVote = setupAdminPlayerVote;
  window.btccPlayerVoteFieldLabels = fieldLabels;
  window.btccPlayerVoteDisplayAnswer = displayAnswer;
})();
