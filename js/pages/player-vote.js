(function () {
  const VOTE_ID = "2027-player-vote";
  const TOTAL_PROPOSALS = 10;
  const answers = {};
  let config = null;
  let response = null;
  let user = null;
  let playerName = "";
  let loadedUid = null;
  let authUnsubscribe = null;
  let configUnsubscribe = null;
  let saveMessage = "";
  let loadNumber = 0;

  const proposalOptions = {
    p1_minimum_budget: [
      "Introduce the £9.70 minimum budget",
      "Keep the 2026 system with no minimum",
      "No preference",
    ],
    p2_sld_premium: [
      "+10% — keep the 2026 premium",
      "+5% — reduce the premium",
      "No premium — SLD costs the normal driver price",
      "No preference / I don't use SLD",
    ],
    p3_sld_star_pricing: [
      "Use both — apply the Star Driver adjustment and the SLD premium",
      "Keep the 2026 rule — SLD pricing overrides Star Driver pricing",
      "No preference / I don't use SLD",
    ],
    p4_form_driver: [
      "Remove the Form Driver — let the Elite Tier take over that role",
      "Keep the Form Driver at +5%",
      "Keep the Form Driver but review/change its price premium",
      "No preference",
    ],
    p5_team_names: [
      "Yes — teams choose their own names",
      "No — continue using organiser-created names",
      "No preference",
    ],
    p6_team_weekend_bonus: [
      "Add the £0.05 Team of the Weekend bonus",
      "Do not add a budget reward",
      "No preference",
    ],
    p7_team_captain: [
      "Add captains and the nominated-player bonus",
      "Have team captains, but no nomination bonus",
      "Do not add a captain system",
      "No preference",
    ],
    p8_qualifying_format: [
      "Yes — qualifying-group performance should also earn Fantasy League points",
      "No — only the Race to Pole should count towards qualifying fantasy points",
      "No preference",
    ],
    p9_extra_competitions: [
      "Singles knockout",
      "Doubles knockout",
      "Mini leagues / divisions",
      "None — keep only the existing championships",
    ],
    p10_pit_stop_pot: [
      "Keep the Pit Stop Pot exactly as it is",
      "Keep the main Pit Stop Pot but explore additional smaller-win ideas",
      "Redesign the Pit Stop Pot more significantly",
      "No preference",
    ],
  };

  const proposals = [
    {
      field: "p1_minimum_budget",
      title: "Minimum Budget Protection",
      description: `
        <p>Introduce a <strong>£9.70 minimum available spending budget</strong>.</p>
        <p>The player's real base budget would still rise and fall normally and Budget Boost would still apply.</p>
        <p>The protection would only step in if their available budget dropped below £9.70.</p>
        <p>Testing against the completed 2026 season showed that a £9.70 floor would have affected only <strong>7 submitted player-events across 5 players</strong>.</p>
        <p>It therefore acts as a safety net rather than resetting everybody's budget.</p>`,
    },
    {
      field: "p2_sld_premium",
      title: "Season Long Driver Premium",
      description: `
        <p>An SLD can be selected at every event and ignores the normal repetition restriction.</p>
        <p>In 2026 it cost <strong>10% more</strong> than the driver's normal value.</p>
        <p>Several players who commented on SLD suggested making the premium smaller.</p>`,
    },
    {
      field: "p3_sld_star_pricing",
      title: "SLD + Star Driver Pricing",
      description: `
        <p>In 2026, SLD pricing overrode Star Driver pricing completely.</p>
        <p>For example, if a player's SLD became the Underdog Driver, that driver did not receive the normal Underdog discount.</p>`,
    },
    {
      field: "p4_form_driver",
      title: "Form Driver",
      description: `
        <p>The <strong>Underdog Driver will remain</strong> for 2027.</p>
        <p>The new <strong>Elite Tier</strong> is already confirmed for 2027 and will restrict fantasy teams to a maximum of one Elite driver.</p>
        <p>Because the Elite Tier already makes the strongest drivers more difficult to stack together, we need to decide what happens to the Form Driver.</p>`,
    },
    {
      field: "p5_team_names",
      title: "Team Names",
      section: "Fantasy Teams",
      description: "<p>Allow each Fantasy Team to choose its own team name before the season.</p>",
    },
    {
      field: "p6_team_weekend_bonus",
      title: "Team of the Weekend Bonus",
      description: `
        <p>The highest-scoring Fantasy Team at each event would become the <strong>Team of the Weekend</strong>.</p>
        <p>Each member of the winning team would receive <strong>+£0.05 temporary spending budget for the following event only.</strong></p>
        <p>The bonus would not permanently increase their base budget.</p>`,
    },
    {
      field: "p7_team_captain",
      title: "Team Captain",
      description: `
        <p>Each Fantasy Team could have a captain.</p>
        <p>Before an event, the captain could nominate one member of their team.</p>
        <p>A strong result from the nominated player could earn <strong>bonus points for the Fantasy Teams Championship only</strong>.</p>
        <p>It would not change that player's Individual Championship score.</p>
        <p>The exact bonus scoring would be designed later if this proposal is supported.</p>`,
    },
    {
      field: "p8_qualifying_format",
      title: "New Qualifying Format",
      description: `
        <p>The new BTCC Saturday format includes separate qualifying groups before the <strong>Race to Pole</strong>.</p>
        <p>One suggestion from the 2026 questionnaire was that performance in those qualifying groups should also contribute to Fantasy League scoring, rather than only the Race to Pole result counting.</p>
        <p>The exact Fantasy League scoring system would require further development and testing before the 2027 season.</p>
        <p><strong>This vote is only about whether the qualifying-group stage should count towards Fantasy League scoring at all.</strong></p>`,
    },
    {
      field: "p9_extra_competitions",
      title: "Extra Competitions",
      multiple: true,
      description: `
        <p>These would use the fantasy scores players are already earning.</p>
        <p>They would not affect Overall Championship points, budgets, driver values, tiers or normal fantasy scoring.</p>
        <p>You may select more than one option.</p>`,
    },
    {
      field: "p10_pit_stop_pot",
      title: "Pit Stop Pot",
      description: `
        <p>The 2026 questionnaire showed that the current contribution and value were generally well received, but some players wanted more chances to win smaller prizes or something more interactive.</p>
        <p>No entry-fee increase, merchandise scheme or specific prize redesign is being approved by this vote. Those would require separate consideration if players vote for further changes.</p>`,
    },
  ];

  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const root = () => document.getElementById("player-vote-root");

  function selectedCount() {
    return proposals.filter(({ field, multiple }) => multiple
      ? Array.isArray(answers[field]) && answers[field].length > 0
      : Boolean(answers[field])).length;
  }

  function renderOptions(proposal) {
    const options = proposalOptions[proposal.field];
    const selected = proposal.multiple && Array.isArray(answers[proposal.field]) ? answers[proposal.field] : [];
    return options.map((label, index) => {
      const value = String(index + 1);
      const checked = proposal.multiple ? selected.includes(value) : answers[proposal.field] === value;
      return `<label class="questionnaireOption playerVoteOption">
        <input type="${proposal.multiple ? "checkbox" : "radio"}" name="${proposal.field}" value="${value}" ${checked ? "checked" : ""}>
        <span>${escapeHtml(label)}</span>
      </label>`;
    }).join("");
  }

  function renderLoading(message = "Loading the 2027 Player Vote…") {
    root().innerHTML = `<div class="questionnaireShell"><section class="card questionnaireCard"><div class="tiny muted">${escapeHtml(message)}</div></section></div>`;
  }

  function renderUnavailable(title, message) {
    root().innerHTML = `<div class="questionnaireShell"><section class="card questionnaireCard questionnaireConfirmation"><div class="questionnaireEyebrow">2027 Player Vote</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></section></div>`;
  }

  function renderLogin() {
    root().innerHTML = `<div class="questionnaireShell"><section class="card questionnaireCard">
      <div class="questionnaireEyebrow">2027 Player Vote</div>
      <h1>Sign in to vote</h1>
      <p class="questionnaireLead">Use the same account you use to submit your Fantasy League team.</p>
      <form id="player-vote-login-form" class="questionnaireLogin">
        <label>Email<input id="player-vote-email" type="email" autocomplete="email" required></label>
        <label>Password<input id="player-vote-password" type="password" autocomplete="current-password" required></label>
        <button class="questionnaireButton questionnaireButton--primary">Sign in</button>
        <div id="player-vote-login-message" class="tiny" role="status"></div>
      </form>
    </section></div>`;
  }

  function savedLabel(timestamp) {
    const date = timestamp?.toDate?.();
    return date
      ? `Votes saved ${date.toLocaleDateString("en-GB")} at ${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.`
      : "Votes saved.";
  }

  function renderBallot() {
    const count = selectedCount();
    root().innerHTML = `<div class="questionnaireShell playerVoteShell">
      <section class="card questionnaireCard playerVoteIntro">
        <div class="questionnaireEyebrow">BTCC Fantasy League</div>
        <h1>2027 Player Vote</h1>
        <p>Thanks for the feedback from the 2026 end-of-season questionnaire.</p>
        <p>That questionnaire was about finding out what worked, what didn't, and what ideas were worth exploring.</p>
        <p>This is different.</p>
        <p>The proposals below are the changes now being considered for the 2027 Fantasy League.</p>
        <p>There are no ratings or long questionnaires this time — just vote for what you would actually like to see happen.</p>
        <div class="playerVoteConfirmed">
          <h2>Already confirmed for 2027</h2>
          <p><strong>Elite Tier:</strong> An Elite driver tier will be added above High / Middle / Low. A fantasy team may select a maximum of one Elite driver. Further details will be finalised separately.</p>
          <p><strong>Forever Forward Championship:</strong> A new specialist championship based on positive positions gained during races. This will remain separate from the Overall Championship.</p>
        </div>
      </section>
      <div class="playerVoteProgress card" role="status" aria-live="polite">
        <div><strong>${count} of ${TOTAL_PROPOSALS} proposals voted</strong><span>${response?.status === "submitted" ? "Your saved votes are shown below and can be changed while voting remains open." : `Hi ${escapeHtml(playerName)}. You may leave any proposal unanswered.`}</span></div>
        <div class="questionnaireProgress" role="progressbar" aria-valuenow="${count}" aria-valuemin="0" aria-valuemax="${TOTAL_PROPOSALS}"><span style="width:${count / TOTAL_PROPOSALS * 100}%"></span></div>
      </div>
      <form id="player-vote-form">
        ${proposals.map((proposal, index) => `${proposal.section ? `<h2 class="playerVoteSectionTitle">${escapeHtml(proposal.section)}</h2>` : ""}
          <section class="card questionnaireCard playerVoteProposal">
            <div class="playerVoteProposal__number">Proposal ${index + 1}</div>
            <h2>${escapeHtml(proposal.title)}</h2>
            <div class="playerVoteProposal__description">${proposal.description}</div>
            <fieldset class="questionnaireGroup"><legend>Your vote</legend><div class="questionnaireOptions">${renderOptions(proposal)}</div></fieldset>
          </section>`).join("")}
        <section class="card playerVoteSubmit">
          <div id="player-vote-save-status" class="questionnaireSaveStatus tiny muted" role="status" aria-live="polite">${escapeHtml(saveMessage)}</div>
          <button class="questionnaireButton questionnaireButton--primary" type="submit">Submit My Votes</button>
          <button class="questionnaireButton questionnaireButton--secondary" type="button" data-player-vote-action="logout">Sign out</button>
        </section>
      </form>
    </div>`;
  }

  const responseRef = () => window.btccDb.collection("questionnaires").doc(VOTE_ID).collection("responses").doc(user.uid);

  async function saveVotes() {
    const timestamp = firebase.firestore.FieldValue.serverTimestamp();
    const payload = {
      uid: user.uid,
      playerName,
      voteVersion: config.version,
      status: "submitted",
      answers: { ...answers },
      startedAt: response?.startedAt || timestamp,
      updatedAt: timestamp,
      submittedAt: response?.submittedAt || timestamp,
    };
    root().querySelectorAll("button").forEach((button) => { button.disabled = true; });
    await responseRef().set(payload, { merge: false });
    const snapshot = await responseRef().get();
    response = snapshot.data();
    saveMessage = savedLabel(response.updatedAt);
  }

  function replaceAnswers(values = {}) {
    Object.keys(answers).forEach((key) => delete answers[key]);
    Object.assign(answers, values);
  }

  async function loadResponse() {
    const currentLoad = ++loadNumber;
    renderLoading("Loading your votes…");
    try {
      const [playerSnapshot, responseSnapshot] = await Promise.all([
        window.btccDb.collection("players").doc(user.uid).get(),
        responseRef().get(),
      ]);
      if (currentLoad !== loadNumber) return;
      if (!playerSnapshot.exists) throw new Error("Your Fantasy League player profile could not be found.");
      const player = playerSnapshot.data() || {};
      playerName = String(player.displayName || player.name || "").trim();
      if (!playerName) throw new Error("Your player profile does not have a display name.");
      response = responseSnapshot.exists ? responseSnapshot.data() : null;
      replaceAnswers(response?.answers);
      saveMessage = response?.updatedAt ? savedLabel(response.updatedAt) : "";
      loadedUid = user.uid;
      renderBallot();
    } catch (error) {
      renderUnavailable("Player Vote unavailable", error?.message || "Your votes could not be loaded.");
    }
  }

  function refresh() {
    if (!config?.enabled) {
      renderUnavailable("Player Vote not currently open", "The 2027 Player Vote is not accepting votes at the moment.");
      return;
    }
    if (!user) {
      renderLogin();
      return;
    }
    if (loadedUid !== user.uid) {
      loadResponse();
      return;
    }
    renderBallot();
  }

  function bindEvents() {
    if (root().dataset.bound) return;
    root().dataset.bound = "true";
    root().addEventListener("change", (event) => {
      const field = event.target.name;
      if (!field || !proposalOptions[field]) return;
      if (field === "p9_extra_competitions") {
        const selected = new Set(Array.isArray(answers[field]) ? answers[field] : []);
        if (event.target.checked) {
          if (event.target.value === "4") {
            selected.clear();
            selected.add("4");
          } else {
            selected.delete("4");
            selected.add(event.target.value);
          }
        } else {
          selected.delete(event.target.value);
        }
        answers[field] = [...selected].sort();
      } else {
        answers[field] = event.target.value;
      }
      renderBallot();
    });
    root().addEventListener("submit", async (event) => {
      if (event.target.id === "player-vote-login-form") {
        event.preventDefault();
        const message = root().querySelector("#player-vote-login-message");
        try {
          message.textContent = "Signing in…";
          await firebase.auth().signInWithEmailAndPassword(
            root().querySelector("#player-vote-email").value.trim(),
            root().querySelector("#player-vote-password").value,
          );
        } catch (error) {
          message.textContent = error?.message || "Sign in failed.";
        }
        return;
      }
      if (event.target.id !== "player-vote-form") return;
      event.preventDefault();
      try {
        await saveVotes();
        renderBallot();
      } catch (error) {
        saveMessage = error?.message || "Your votes could not be saved.";
        renderBallot();
      }
    });
    root().addEventListener("click", async (event) => {
      if (event.target.closest('[data-player-vote-action="logout"]')) await firebase.auth().signOut();
    });
  }

  function loadPlayerVote() {
    if (!root()) return;
    bindEvents();
    renderLoading();
    if (!window.btccDb || typeof firebase === "undefined" || !firebase.auth) {
      renderUnavailable("Player Vote unavailable", "Firebase is not available.");
      return;
    }
    if (!authUnsubscribe) {
      authUnsubscribe = firebase.auth().onAuthStateChanged((nextUser) => {
        const changedUser = loadedUid !== nextUser?.uid;
        user = nextUser;
        if (changedUser) {
          loadedUid = null;
          response = null;
          replaceAnswers();
        }
        refresh();
      });
    }
    if (!configUnsubscribe) {
      configUnsubscribe = window.btccDb.collection("questionnaires").doc(VOTE_ID).onSnapshot(
        (snapshot) => {
          config = snapshot.exists ? snapshot.data() : null;
          refresh();
        },
        () => renderUnavailable("Player Vote unavailable", "The Player Vote configuration could not be loaded."),
      );
    } else {
      refresh();
    }
  }

  window.btccPlayerVoteOptions = proposalOptions;
  window.loadPlayerVote = loadPlayerVote;
})();
