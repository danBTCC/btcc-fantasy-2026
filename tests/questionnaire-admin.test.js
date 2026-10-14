const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

const questionnaireSource = fs.readFileSync(path.join(__dirname, "..", "js/pages/questionnaire.js"), "utf8");
const adminSource = fs.readFileSync(path.join(__dirname, "..", "js/admin/questionnaire-admin.js"), "utf8");
const collectionSnapshot = (docs) => ({ docs, empty: !docs.length });
const documentSnapshot = (id, data) => ({ id, exists: !!data, data: () => data });

describe("questionnaire Admin view", () => {
  it("shows states, counts, readable individual answers and aggregates", async () => {
    const dom = new JSDOM(`
      <div id="root"><div id="admin-questionnaire-body">
        <div id="admin-questionnaire-status"></div>
        <input id="admin-questionnaire-enabled" type="checkbox">
        <input id="admin-questionnaire-version">
        <button id="admin-questionnaire-config-save"></button>
        <button id="admin-questionnaire-reload"></button>
        <div id="admin-questionnaire-players"></div>
        <div id="admin-questionnaire-detail"></div>
        <div id="admin-questionnaire-aggregates"></div>
      </div></div>`, { runScripts: "dangerously" });
    const window = dom.window;
    const root = window.document.getElementById("root");
    const timestamp = { toDate: () => new Date("2026-10-10T12:00:00Z") };
    const players = collectionSnapshot([
      documentSnapshot("player-a", { displayName: "Player A", active: true }),
      documentSnapshot("player-b", { displayName: "Player B", active: true }),
      documentSnapshot("player-c", { displayName: "Player C", active: true }),
    ]);
    const responses = collectionSnapshot([
      documentSnapshot("player-a", { status: "submitted", questionnaireVersion: "2026.1", reachedQuestion: 12, startedAt: timestamp, updatedAt: timestamp, submittedAt: timestamp, answers: { q1_return: "1", q12_keep: "Standings" } }),
      documentSnapshot("player-b", { status: "draft", questionnaireVersion: "2026.1", reachedQuestion: 4, startedAt: timestamp, updatedAt: timestamp, submittedAt: null, answers: { q1_return: "2" } }),
    ]);
    const config = documentSnapshot("2026-end-of-season", { enabled: true, version: "2026.1" });
    let savedConfiguration = null;
    const questionnaireRef = {
      get: async () => config,
      collection: () => ({ get: async () => responses }),
      set: async (value) => { savedConfiguration = value; },
    };
    window.btccDb = { collection: (name) => name === "questionnaires" ? { doc: () => questionnaireRef } : { get: async () => players } };
    window.firebase = {
      auth: () => ({ currentUser: { uid: "admin", getIdTokenResult: async () => ({ claims: { admin: true } }) } }),
      firestore: { FieldValue: { serverTimestamp: () => timestamp } },
    };
    window.eval(questionnaireSource);
    window.eval(adminSource);
    await window.setupAdminQuestionnaire(root);
    assert.match(root.querySelector("#admin-questionnaire-status").textContent, /1 \/ 3 submitted · 1 in progress · 1 not started/);
    const buttons = root.querySelectorAll("[data-questionnaire-player]");
    assert.equal(buttons.length, 3);
    buttons[0].click();
    assert.match(root.querySelector("#admin-questionnaire-detail").textContent, /Player A/);
    assert.match(root.querySelector("#admin-questionnaire-detail").textContent, /Yes/);
    assert.match(root.querySelector("#admin-questionnaire-detail").textContent, /Standings/);
    assert.match(root.querySelector("#admin-questionnaire-aggregates").textContent, /Play again in 2027/);
    root.querySelector("#admin-questionnaire-config-save").click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(savedConfiguration.updatedBy, "admin");
    assert.equal(Object.values(savedConfiguration).includes("admin@example.com"), false);
    dom.window.close();
  });

  it("refuses response loading without the Admin custom claim", async () => {
    const dom = new JSDOM('<div id="root"><div id="admin-questionnaire-body"><div id="admin-questionnaire-status"></div></div></div>', { runScripts: "dangerously" });
    const window = dom.window;
    const root = window.document.getElementById("root");
    window.firebase = { auth: () => ({ currentUser: { getIdTokenResult: async () => ({ claims: {} }) } }) };
    window.eval(adminSource);
    await window.setupAdminQuestionnaire(root);
    assert.match(root.textContent, /Admin custom claim is required/);
    dom.window.close();
  });
});
