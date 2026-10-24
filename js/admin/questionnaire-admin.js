(function () {
  const QUESTIONNAIRE_ID = "2026-end-of-season";
  const fieldLabels = {
    q1_return: "Q1 — Play again in 2027",
    q2_enjoyment: "Q2 — Enjoyment",
    q2_rules: "Q2 — Rules",
    q2_website: "Q2 — Website",
    q2_submission: "Q2 — Submission",
    q2_competitive: "Q2 — Competitiveness",
    q2_fair: "Q2 — Fairness",
    q3_budget: "Q3 — Budget",
    q3_influence: "Q3 — Budget influence",
    q3_values: "Q3 — Driver values",
    q3_values_comment: "Q3 — Suggested changes",
    q4_tiers: "Q4 — Tiers",
    q4_repetition: "Q4 — Repetition",
    q4_size: "Q4 — Team size",
    q4_rules_comment: "Q4 — Suggested changes",
    q5_strategy: "Q5 — Strategy",
    q5_action: "Q5 — Action",
    q5_action_comment: "Q5 — Comment",
    q6_notice: "Q6 — Notice",
    q6_competitive: "Q6 — Competitiveness",
    q6_action: "Q6 — Action",
    q6_action_comment: "Q6 — Comment",
    q7_underdog: "Q7 — Underdog",
    q7_form: "Q7 — Form",
    q7_action_comment: "Q7 — Comment",
    q8_wingfoot: "Q8 — WingFoot",
    q8_manufacturer: "Q8 — Manufacturer",
    q8_independent: "Q8 — Independent",
    q8_jack_sears: "Q8 — Jack Sears",
    q8_race_1: "Q8 — Race 1",
    q8_race_2: "Q8 — Race 2",
    q8_race_3: "Q8 — Race 3",
    q8_teams: "Q8 — Fantasy Teams",
    q8_comment: "Q8 — Comment",
    q9_use: "Q9 — Use",
    q9_amount: "Q9 — Amount",
    q9_value: "Q9 — Value",
    q9_structure: "Q9 — Structure",
    q9_structure_comment: "Q9 — Comment",
    q10_use: "Q10 — News use",
    q10_reason: "Q10 — Reason",
    q10_reason_other: "Q10 — Other reason",
    q10_continue: "Q10 — Continue",
    q11_feeling: "Q11 — Awards value",
    q11_system: "Q11 — Award format",
    q11_system_other: "Q11 — Other format",
    q12_keep: "Q12 — Keep one",
    q12_change: "Q12 — Change one",
    q12_add: "Q12 — Add one",
    q12_other: "Q12 — Other comment",
  };
  const writtenFields = new Set(Object.keys(fieldLabels).filter((key) =>
    key.includes("comment") || key.includes("other") || key.startsWith("q12_")));

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
    if (value === null || value === undefined || value === "") return "—";
    return window.btccQuestionnaireAnswerOptions?.[field]?.[String(value)] || String(value);
  }

  async function setupAdminQuestionnaire(root) {
    const body = root.querySelector("#admin-questionnaire-body");
    if (!body || body.dataset.bound) return;
    body.dataset.bound = "true";

    const status = root.querySelector("#admin-questionnaire-status");
    const playersElement = root.querySelector("#admin-questionnaire-players");
    const detail = root.querySelector("#admin-questionnaire-detail");
    const aggregates = root.querySelector("#admin-questionnaire-aggregates");
    const reloadButton = root.querySelector("#admin-questionnaire-reload");

    try {
      const currentUser = firebase.auth().currentUser;
      const token = await currentUser?.getIdTokenResult();
      if (!currentUser || token?.claims?.admin !== true) {
        throw new Error("The Firebase Admin custom claim is required to manage questionnaire responses.");
      }

      const questionnaireRef = window.btccDb.collection("questionnaires").doc(QUESTIONNAIRE_ID);
      const responsesRef = questionnaireRef.collection("responses");

      async function load() {
        status.textContent = "Loading questionnaire data…";
        const [configSnapshot, playersSnapshot, responsesSnapshot] = await Promise.all([
          questionnaireRef.get(),
          window.btccDb.collection("players").get(),
          responsesRef.get(),
        ]);
        const questionnaireConfig = configSnapshot.exists ? configSnapshot.data() : {};
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
        status.textContent = `Archive ${questionnaireConfig.enabled === true ? "warning: still enabled" : "closed"} · ${submitted} / ${players.length} submitted · ${drafts} drafts · ${players.length - submitted - drafts} not started`;

        playersElement.innerHTML = `
          <div class="tableWrap"><table>
            <thead><tr><th>Player</th><th>Status</th><th>Reached</th><th>Updated</th><th></th></tr></thead>
            <tbody>${players.map((player) => {
              const playerResponse = responses.get(player.uid);
              const state = playerResponse?.status === "submitted" ? "Submitted" : playerResponse ? "In progress" : "Not started";
              return `<tr>
                <td>${escapeHtml(player.name)}</td><td>${state}</td><td>${escapeHtml(playerResponse?.reachedQuestion || "—")}</td>
                <td>${escapeHtml(formatTimestamp(playerResponse?.updatedAt))}</td>
                <td><button class="tile tinyBtn" type="button" data-questionnaire-player="${escapeHtml(player.uid)}">Open</button></td>
              </tr>`;
            }).join("")}</tbody>
          </table></div>`;

        playersElement.querySelectorAll("[data-questionnaire-player]").forEach((button) => {
          button.addEventListener("click", () => {
            const player = players.find((candidate) => candidate.uid === button.dataset.questionnairePlayer);
            const playerResponse = responses.get(player.uid);
            if (!playerResponse) {
              detail.innerHTML = `<div class="note">${escapeHtml(player.name)} has not started the questionnaire.</div>`;
              return;
            }
            detail.innerHTML = `
              <div class="note">
                <strong>${escapeHtml(player.name)}</strong><br>
                Status: ${escapeHtml(playerResponse.status)} · Version: ${escapeHtml(playerResponse.questionnaireVersion)} · Reached: ${escapeHtml(playerResponse.reachedQuestion)}<br>
                Started: ${escapeHtml(formatTimestamp(playerResponse.startedAt))} · Updated: ${escapeHtml(formatTimestamp(playerResponse.updatedAt))} · Submitted: ${escapeHtml(formatTimestamp(playerResponse.submittedAt))}
              </div>
              <div class="tableWrap"><table><tbody>
                ${Object.keys(fieldLabels).map((field) => `<tr><th>${escapeHtml(fieldLabels[field])}</th><td style="white-space:pre-wrap">${escapeHtml(displayAnswer(field, playerResponse.answers?.[field]))}</td></tr>`).join("")}
              </tbody></table></div>`;
          });
        });

        const submittedResponses = [...responses.values()].filter((item) => item.status === "submitted");
        if (!submittedResponses.length) {
          aggregates.innerHTML = `<div class="tiny muted">No submitted responses to aggregate yet.</div>`;
          return;
        }
        aggregates.innerHTML = Object.keys(fieldLabels)
          .filter((field) => !writtenFields.has(field))
          .map((field) => {
            const counts = new Map();
            submittedResponses.forEach((item) => {
              const value = item.answers?.[field];
              if (value) counts.set(String(value), (counts.get(String(value)) || 0) + 1);
            });
            if (!counts.size) return "";
            return `<div class="note questionnaireAggregate"><strong>${escapeHtml(fieldLabels[field])}</strong><ul class="list tiny">${[...counts]
              .sort((a, b) => b[1] - a[1])
              .map(([value, count]) => `<li><strong>${count}</strong> — ${escapeHtml(displayAnswer(field, value))}</li>`).join("")}</ul></div>`;
          }).join("");
      }

      reloadButton.addEventListener("click", load);
      await load();
    } catch (error) {
      status.textContent = error?.message || "Questionnaire data could not be loaded.";
    }
  }

  window.setupAdminQuestionnaire = setupAdminQuestionnaire;
  window.btccQuestionnaireFieldLabels = fieldLabels;
  window.btccQuestionnaireDisplayAnswer = displayAnswer;
})();
