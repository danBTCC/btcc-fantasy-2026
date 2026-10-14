(function () {
  const QUESTIONNAIRE_ID = "2026-end-of-season";
  const TOTAL_QUESTIONS = 12;
  const answers = {};
  let questionIndex = 0;
  let reachedQuestion = 1;
  let response = null;
  let config = null;
  let user = null;
  let playerName = "";
  let screen = "loading";
  let loadedUid = null;
  let authUnsubscribe = null;
  let configUnsubscribe = null;
  let saveMessage = "";
  let loadNumber = 0;

  const unsure = "Not sure / No opinion / I did not really use or understand this";
  const answerOptions = {};

  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const numberedOptions = (name, labels) => {
    answerOptions[name] = Object.fromEntries(labels.map((label, index) => [String(index + 1), label]));
    return labels.map((label, index) => [String(index + 1), label]);
  };

  function radio(name, legend, labels, note = "") {
    return `
      <fieldset class="questionnaireGroup">
        <legend>${legend}</legend>
        ${note ? `<p class="questionnaireGroup__note">${note}</p>` : ""}
        <div class="questionnaireOptions">
          ${numberedOptions(name, labels).map(([value, label]) => `
            <label class="questionnaireOption">
              <input type="radio" name="${name}" value="${value}" ${answers[name] === value ? "checked" : ""}>
              <span>${label}</span>
            </label>
          `).join("")}
        </div>
      </fieldset>`;
  }

  function rating(name, legend) {
    answerOptions[name] = { 1: "Very poor", 2: "Poor", 3: "OK / Average", 4: "Good", 5: "Excellent" };
    return `
      <fieldset class="questionnaireRating">
        <legend>${legend}</legend>
        <div class="questionnaireRating__choices">
          ${[1, 2, 3, 4, 5].map((value) => `
            <label>
              <input type="radio" name="${name}" value="${value}" ${answers[name] === String(value) ? "checked" : ""}>
              <span>${value}</span>
            </label>`).join("")}
        </div>
      </fieldset>`;
  }

  function select(name, label, labels) {
    return `
      <label class="questionnaireSelect">
        <span>${label}</span>
        <select name="${name}">
          <option value="">Choose an answer</option>
          ${numberedOptions(name, labels).map(([value, text]) => `<option value="${value}" ${answers[name] === value ? "selected" : ""}>${text}</option>`).join("")}
        </select>
      </label>`;
  }

  function textArea(name, label) {
    return `
      <label class="questionnaireText">
        <span>${label}</span>
        <textarea name="${name}" rows="4" placeholder="Type your answer here…">${escapeHtml(answers[name] || "")}</textarea>
      </label>`;
  }

  const conditional = (id, body) => `<div id="${id}" class="questionnaireConditional" hidden>${body}</div>`;

  const pages = [
    () => `<h1>2027</h1>${radio("q1_return", "Do you want to play in the BTCC Fantasy League again in 2027?", ["Yes", "No", "Not sure yet"])}`,
    () => `
      <h1>Your Overall 2026 Experience</h1>
      <p class="questionnaireLead">Thinking about the season as a whole, how would you rate the following?</p>
      <div class="questionnaireScale">
        <span><strong>1</strong> Very poor</span><span><strong>2</strong> Poor</span><span><strong>3</strong> OK / Average</span><span><strong>4</strong> Good</span><span><strong>5</strong> Excellent</span>
      </div>
      <div class="questionnaireRatings">
        ${[
          ["q2_enjoyment", "How much you enjoyed the Fantasy League"],
          ["q2_rules", "How easy the rules were to understand"],
          ["q2_website", "How easy the website was to use"],
          ["q2_submission", "How easy it was to submit your team"],
          ["q2_competitive", "How competitive the league felt"],
          ["q2_fair", "How fair the league felt"],
        ].map((item) => rating(...item)).join("")}
      </div>`,
    () => `
      <h1>Budget and Driver Values</h1>
      <p class="questionnaireLead">How did the budget and changing driver-value system work for you?</p>
      ${radio("q3_budget", "Starting budget and available money", ["Usually too restrictive", "About right", "Usually too generous", "Not sure / I did not really understand this"])}
      ${radio("q3_influence", "How much did the budget influence your driver choices?", ["A lot", "Sometimes", "Hardly ever", "Not at all", "Not sure / I did not really notice this"])}
      ${radio("q3_values", "Drivers changing value after each event", ["Keep it as it is", "Keep it, but change how it works", "Remove changing driver values", unsure])}
      ${conditional("q3-values-follow", textArea("q3_values_comment", "What would you change about driver values or the budget system?"))}`,
    () => `
      <h1>Team Selection and Rules</h1>
      <p class="questionnaireLead">What do you think should happen to these rules in 2027?</p>
      ${radio("q4_tiers", "High, Middle and Low driver tier requirements", ["Keep them as they are", "Keep them, but change the rules", "Remove the tier requirement", unsure])}
      ${radio("q4_repetition", "Driver repetition rule", ["Keep it as it is", "Keep it, but change the rule", "Remove it", unsure], "A normal driver cannot be selected for three events in a row.")}
      ${radio("q4_size", "Selecting between 3 and 6 drivers", ["Keep it as it is", "Change the allowed team size", unsure])}
      ${conditional("q4-rules-follow", textArea("q4_rules_comment", "What would you change about the team-selection rules?"))}`,
    () => `
      <h1>Season Long Driver</h1>
      <p class="questionnaireLead">How do you think the Season Long Driver worked in 2026?</p>
      ${radio("q5_strategy", "Did the Season Long Driver add useful long-term strategy to the game?", ["Yes", "A little", "No", "Not sure / I did not really use or understand this"])}
      ${radio("q5_action", "What should happen to the Season Long Driver in 2027?", ["Keep it as it is", "Keep it, but change how it works", "Remove it", unsure])}
      ${conditional("q5-sld-follow", textArea("q5_action_comment", "What would you change about the Season Long Driver, or why do you think it should be removed?"))}`,
    () => `
      <h1>Budget Boost</h1>
      <p class="questionnaireLead">How did the Budget Boost affect your experience in 2026?</p>
      ${radio("q6_notice", "Did you notice the Budget Boost affecting the money available to you?", ["Yes", "Sometimes", "No", "Not sure / I did not really use or understand this"])}
      ${radio("q6_competitive", "What effect, if any, did the Budget Boost have on how competitive you felt?", ["It helped me feel more competitive", "It helped me feel a little more competitive", "It had no noticeable effect on how competitive I felt", "It made me feel less competitive", "Not sure / I did not really use or understand this"])}
      ${radio("q6_action", "What should happen to Budget Boost in 2027?", ["Keep it as it is", "Keep it, but change how it works", "Remove it", unsure])}
      ${conditional("q6-boost-follow", textArea("q6_action_comment", "What would you change about Budget Boost, or why do you think it should be removed?"))}`,
    () => `
      <h1>Star Drivers</h1>
      <p class="questionnaireLead">What should happen to the two Star Driver features in 2027?</p>
      ${radio("q7_underdog", "Underdog Driver", ["Keep it as it is", "Keep it, but change how it works", "Remove it", unsure], "Currently receives a 20% price discount.")}
      ${radio("q7_form", "Form Driver", ["Keep it as it is", "Keep it, but change how it works", "Remove it", unsure], "Currently costs 5% more.")}
      ${conditional("q7-star-follow", textArea("q7_action_comment", "What would you change about either Star Driver?"))}`,
    () => {
      const options = ["Regularly", "Sometimes", "Rarely", "I knew it existed but did not really follow it", "I did not know it existed"];
      return `
        <h1>Other Championships and Fantasy Teams</h1>
        <p class="questionnaireLead">How much did you follow or use these parts of the league?</p>
        <div class="questionnaireSelectGrid">
          ${[
            ["q8_wingfoot", "WingFoot qualifying championship"],
            ["q8_manufacturer", "Manufacturer championship"],
            ["q8_independent", "Independent championship"],
            ["q8_jack_sears", "Jack Sears championship"],
            ["q8_race_1", "Race 1 standings"],
            ["q8_race_2", "Race 2 standings"],
            ["q8_race_3", "Race 3 standings"],
            ["q8_teams", "Fantasy Teams championship"],
          ].map((item) => select(item[0], item[1], options)).join("")}
        </div>
        ${textArea("q8_comment", "Optional: Is there anything here you would particularly like to keep, change or remove for 2027?")}`;
    },
    () => `
      <h1>Pit Stop Pot</h1>
      ${radio("q9_use", "How much did you interact with or follow the Pit Stop Pot during 2026?", ["I followed it regularly and looked forward to the draws and results", "I checked it sometimes", "I rarely checked it", "I knew about it but was not particularly interested", "I did not really know or understand how it worked"])}
      ${radio("q9_amount", "How does the contribution amount feel?", ["Too little", "About right", "Too much", "Not sure / No opinion"], "The Pit Stop Pot currently costs 50p per race — £1.50 per race weekend, or £15 across a 30-race season.")}
      ${radio("q9_value", "Does £15 across a 30-race season feel like good value for the experience and prize opportunities?", ["Very good value", "Fairly good value", "Neither good nor poor value", "Poor value", unsure])}
      ${radio("q9_structure", "What would you prefer from the Pit Stop Pot prize structure?", ["Keep the current system", "More chances to win smaller prizes", "Fewer wins but larger prizes", "Bigger checkpoint or shared payouts", "I would like the system changed, but in another way", unsure])}
      ${conditional("q9-pot-follow", textArea("q9_structure_comment", "If you would change the Pit Stop Pot, what would you like to see?"))}`,
    () => `
      <h1>News and Weekend Reviews</h1>
      ${radio("q10_use", "Before this questionnaire, which best describes your use of the News section?", ["I did not know there was a News section", "I knew about it but never read the weekend reviews", "I read a few weekend reviews", "I read most weekend reviews", "I read all or nearly all of the weekend reviews"])}
      ${conditional("q10-reason-follow", `${radio("q10_reason", "What was the main reason you did not read them more often?", ["I forgot the News section was there", "I did not notice when a new review had been posted", "The reviews were too long", "I mainly wanted to check my results and standings", "I was not particularly interested in the reviews", "Other"])}${conditional("q10-other-follow", textArea("q10_reason_other", "Optional: What was the other reason?"))}`)}
      ${radio("q10_continue", "Would you like the weekend reviews to continue in 2027?", ["Yes", "I do not mind either way", "No", "Not sure / No opinion"])}`,
    () => `
      <h1>Trophies, Medals and End-of-Season Awards</h1>
      ${radio("q11_feeling", "How do you feel about the end-of-season trophies and medals?", ["I really like them and look forward to receiving them", "I like them, but they are not a major part of the league for me", "I do not mind either way", "I would prefer a simpler award system", "I do not think physical awards are necessary"])}
      ${radio("q11_system", "If the award system changed, which would you prefer?", ["New trophies and medals each year, as now", "One perpetual championship trophy or plaque, passed to each new winner with names and years added", "A perpetual championship trophy or plaque plus smaller individual awards", "Another approach", "No preference"])}
      ${conditional("q11-other-follow", textArea("q11_system_other", "Optional: Tell us about another approach."))}`,
    () => `
      <h1>Looking Ahead to 2027</h1>
      ${textArea("q12_keep", "Keep one: If you could guarantee one existing part of the Fantasy League stays in 2027, what would it be?")}
      ${textArea("q12_change", "Change one: If you could change or remove one existing part, what would it be?")}
      ${textArea("q12_add", "Add one: If you could add one new thing for 2027, what would it be?")}
      <details class="questionnaireOptional" ${answers.q12_other ? "open" : ""}>
        <summary>Anything else? <span>Optional</span></summary>
        ${textArea("q12_other", "Is there anything else about the 2026 Fantasy League that you think we genuinely need to know before planning 2027?")}
      </details>`,
  ];

  function updateConditionalFields(root) {
    const show = (id, visible) => {
      const element = root.querySelector(`#${id}`);
      if (element) element.hidden = !visible;
    };
    show("q3-values-follow", answers.q3_values === "2");
    show("q4-rules-follow", [answers.q4_tiers, answers.q4_repetition, answers.q4_size].includes("2"));
    show("q5-sld-follow", ["2", "3"].includes(answers.q5_action));
    show("q6-boost-follow", ["2", "3"].includes(answers.q6_action));
    show("q7-star-follow", [answers.q7_underdog, answers.q7_form].some((value) => ["2", "3"].includes(value)));
    show("q9-pot-follow", ["2", "3", "4", "5"].includes(answers.q9_structure));
    show("q10-reason-follow", ["1", "2", "3"].includes(answers.q10_use));
    show("q10-other-follow", answers.q10_reason === "6");
    show("q11-other-follow", answers.q11_system === "4");
  }

  const root = () => document.getElementById("questionnaire-root");

  function renderLoading(message = "Loading questionnaire…") {
    root().innerHTML = `<div class="questionnaireShell"><section class="card questionnaireCard"><div class="tiny muted">${escapeHtml(message)}</div></section></div>`;
  }

  function renderUnavailable(title, message) {
    root().innerHTML = `<div class="questionnaireShell"><section class="card questionnaireCard questionnaireConfirmation"><div class="questionnaireEyebrow">2026 End of Season Questionnaire</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></section></div>`;
  }

  function savedLabel(timestamp) {
    const date = timestamp?.toDate?.();
    return date
      ? `Saved ${date.toLocaleDateString("en-GB")} at ${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.`
      : "Progress saved.";
  }

  function renderLogin() {
    root().innerHTML = `
      <div class="questionnaireShell"><section class="card questionnaireCard">
        <div class="questionnaireEyebrow">2026 End of Season Questionnaire</div>
        <h1>Sign in to continue</h1>
        <p class="questionnaireLead">Use the same account you use to submit your Fantasy League team.</p>
        <form id="questionnaire-login-form" class="questionnaireLogin">
          <label>Email<input id="questionnaire-email" type="email" autocomplete="email" required></label>
          <label>Password<input id="questionnaire-password" type="password" autocomplete="current-password" required></label>
          <button class="questionnaireButton questionnaireButton--primary">Sign in</button>
          <div id="questionnaire-login-message" class="tiny" role="status"></div>
        </form>
      </section></div>`;
  }

  function renderLanding() {
    const submitted = response?.status === "submitted";
    const draft = response?.status === "draft";
    root().innerHTML = `
      <div class="questionnaireShell"><section class="card questionnaireCard questionnaireConfirmation">
        <div class="questionnaireEyebrow">2026 End of Season Questionnaire</div>
        <h1>${submitted ? "Questionnaire submitted" : "Help shape the 2027 Fantasy League"}</h1>
        <p>${submitted
          ? `Thank you, ${escapeHtml(playerName)}. Your responses are saved and can still be reviewed or edited while the questionnaire is open.`
          : `Hi ${escapeHtml(playerName)}. The questionnaire contains 12 questions and should take around 10 minutes.`}</p>
        ${response?.updatedAt ? `<div class="tiny muted">${escapeHtml(savedLabel(response.updatedAt))}</div>` : ""}
        <button class="questionnaireButton questionnaireButton--primary" data-questionnaire-action="start">${submitted ? "View or edit responses" : draft ? "Continue Questionnaire" : "Start Questionnaire"}</button>
        <button class="questionnaireButton questionnaireButton--quiet" data-questionnaire-action="logout">Sign out</button>
      </section></div>`;
  }

  function renderConfirmation() {
    root().innerHTML = `
      <div class="questionnaireShell"><section class="card questionnaireCard questionnaireConfirmation">
        <div class="questionnaireConfirmation__flag">🏁</div>
        <div class="questionnaireEyebrow">2026 End of Season Questionnaire</div>
        <h1>Questionnaire submitted</h1>
        <p>Thank you, ${escapeHtml(playerName)}. Your responses have been saved. You can review or edit them while the questionnaire remains open.</p>
        <div class="questionnaireSaveStatus tiny muted">${escapeHtml(saveMessage)}</div>
        <button class="questionnaireButton questionnaireButton--primary" data-questionnaire-action="review">View or edit my responses</button>
      </section></div>`;
  }

  function renderQuestion() {
    if (screen === "confirmation") {
      renderConfirmation();
      return;
    }
    const number = questionIndex + 1;
    const isLast = number === TOTAL_QUESTIONS;
    root().innerHTML = `
      <div class="questionnaireShell"><section class="card questionnaireCard">
        <header class="questionnaireHeader">
          <div><div class="questionnaireEyebrow">2026 End of Season Questionnaire</div><div class="questionnaireCounter">Question ${number} of ${TOTAL_QUESTIONS}</div></div>
          <div class="questionnaireStatusBadge">${response?.status === "submitted" ? "Submitted" : "Saved draft"}</div>
        </header>
        <div class="questionnaireProgress" role="progressbar" aria-valuenow="${number}" aria-valuemin="1" aria-valuemax="12"><span style="width:${Math.round(number / TOTAL_QUESTIONS * 100)}%"></span></div>
        <div class="questionnaireBody">${pages[questionIndex]()}</div>
        <div class="questionnaireSaveStatus tiny muted" role="status" aria-live="polite">${escapeHtml(saveMessage)}</div>
        <footer class="questionnaireControls">
          <button class="questionnaireButton questionnaireButton--secondary" data-questionnaire-action="back" ${questionIndex === 0 ? "disabled" : ""}>Back</button>
          <button class="questionnaireButton questionnaireButton--quiet" data-questionnaire-action="save">Save Progress</button>
          <button class="questionnaireButton questionnaireButton--primary" data-questionnaire-action="${isLast ? "submit" : "next"}">${isLast ? "Submit Questionnaire" : "Next"}</button>
        </footer>
      </section></div>`;
    updateConditionalFields(root());
  }

  const responseRef = () => window.btccDb
    .collection("questionnaires")
    .doc(QUESTIONNAIRE_ID)
    .collection("responses")
    .doc(user.uid);

  async function saveResponse(submit = false) {
    const status = submit || response?.status === "submitted" ? "submitted" : "draft";
    const timestamp = firebase.firestore.FieldValue.serverTimestamp();
    const payload = {
      uid: user.uid,
      playerName,
      questionnaireVersion: config.version,
      status,
      currentQuestion: questionIndex + 1,
      reachedQuestion: Math.max(reachedQuestion, questionIndex + 1),
      answers: { ...answers },
      startedAt: response?.startedAt || timestamp,
      updatedAt: timestamp,
      submittedAt: status === "submitted" ? (response?.submittedAt || timestamp) : null,
    };

    root().querySelectorAll("button").forEach((button) => { button.disabled = true; });
    await responseRef().set(payload, { merge: false });
    const snapshot = await responseRef().get();
    response = snapshot.data();
    reachedQuestion = response.reachedQuestion;
    saveMessage = savedLabel(response.updatedAt);
  }

  function replaceAnswers(values = {}) {
    Object.keys(answers).forEach((key) => delete answers[key]);
    Object.assign(answers, values);
  }

  async function loadResponse() {
    const currentLoad = ++loadNumber;
    renderLoading("Loading your questionnaire…");
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
      questionIndex = Math.max(0, Math.min(11, Number(response?.currentQuestion || 1) - 1));
      reachedQuestion = Math.max(1, Math.min(12, Number(response?.reachedQuestion || 1)));
      saveMessage = response?.updatedAt ? savedLabel(response.updatedAt) : "";
      loadedUid = user.uid;
      screen = "landing";
      renderLanding();
    } catch (error) {
      renderUnavailable("Questionnaire unavailable", error?.message || "Your questionnaire could not be loaded.");
    }
  }

  function refresh() {
    if (!config?.enabled) {
      screen = "closed";
      renderUnavailable("Questionnaire not currently open", "The end-of-season questionnaire is not accepting responses yet.");
      return;
    }
    if (!user) {
      screen = "login";
      renderLogin();
      return;
    }
    if (loadedUid !== user.uid) {
      loadResponse();
      return;
    }
    if (screen === "question" || screen === "confirmation") {
      renderQuestion();
      return;
    }
    renderLanding();
  }

  function bindEvents() {
    if (root().dataset.bound) return;
    root().dataset.bound = "true";
    root().addEventListener("input", (event) => {
      if (event.target.name) answers[event.target.name] = event.target.value;
    });
    root().addEventListener("change", (event) => {
      if (event.target.name) answers[event.target.name] = event.target.value;
      updateConditionalFields(root());
    });
    root().addEventListener("submit", async (event) => {
      if (event.target.id !== "questionnaire-login-form") return;
      event.preventDefault();
      const message = root().querySelector("#questionnaire-login-message");
      try {
        message.textContent = "Signing in…";
        await firebase.auth().signInWithEmailAndPassword(
          root().querySelector("#questionnaire-email").value.trim(),
          root().querySelector("#questionnaire-password").value,
        );
      } catch (error) {
        message.textContent = error?.message || "Sign in failed.";
      }
    });
    root().addEventListener("click", async (event) => {
      const button = event.target.closest("[data-questionnaire-action]");
      if (!button) return;
      const action = button.dataset.questionnaireAction;
      if (action === "back") {
        questionIndex = Math.max(0, questionIndex - 1);
        renderQuestion();
      } else if (action === "logout") {
        await firebase.auth().signOut();
      } else if (action === "start") {
        try {
          if (!response) await saveResponse();
          screen = "question";
          renderQuestion();
        } catch (error) {
          saveMessage = error?.message || "Progress could not be started.";
          renderLanding();
        }
      } else if (action === "next") {
        try {
          await saveResponse();
          questionIndex = Math.min(11, questionIndex + 1);
          reachedQuestion = Math.max(reachedQuestion, questionIndex + 1);
          renderQuestion();
        } catch (error) {
          saveMessage = error?.message || "Progress could not be saved.";
          renderQuestion();
        }
      } else if (action === "save") {
        try {
          await saveResponse();
          renderQuestion();
        } catch (error) {
          saveMessage = error?.message || "Progress could not be saved.";
          renderQuestion();
        }
      } else if (action === "submit") {
        try {
          await saveResponse(true);
          screen = "confirmation";
          renderQuestion();
        } catch (error) {
          saveMessage = error?.message || "Questionnaire could not be submitted.";
          renderQuestion();
        }
      } else if (action === "review") {
        screen = "question";
        questionIndex = 0;
        renderQuestion();
      }
    });
  }

  function loadQuestionnaire() {
    if (!root()) return;
    bindEvents();
    renderLoading();
    if (!window.btccDb || typeof firebase === "undefined" || !firebase.auth) {
      renderUnavailable("Questionnaire unavailable", "Firebase is not available.");
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
      configUnsubscribe = window.btccDb.collection("questionnaires").doc(QUESTIONNAIRE_ID).onSnapshot(
        (snapshot) => {
          config = snapshot.exists ? snapshot.data() : null;
          refresh();
        },
        () => renderUnavailable("Questionnaire unavailable", "The questionnaire configuration could not be loaded."),
      );
    } else {
      refresh();
    }
  }

  // Build the option-label lookup once so Admin and exports can present readable answers.
  pages.forEach((page) => page());
  window.btccQuestionnaireAnswerOptions = answerOptions;
  window.loadQuestionnaire = loadQuestionnaire;
})();
