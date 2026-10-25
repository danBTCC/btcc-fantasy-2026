const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

const voteSource = fs.readFileSync(path.join(__dirname, "..", "js/pages/player-vote.js"), "utf8");
const adminSource = fs.readFileSync(path.join(__dirname, "..", "js/admin/player-vote-admin.js"), "utf8");
const collectionSnapshot = (docs) => ({ docs, empty: !docs.length });
const documentSnapshot = (id, data) => ({ id, exists: !!data, data: () => data });

describe("2027 Player Vote Admin view", () => {
  it("shows participation, readable individual votes and multi-select aggregates", async () => {
    const dom = new JSDOM(`
      <div id="root"><div id="admin-player-vote-body">
        <div id="admin-player-vote-status"></div>
        <input id="admin-player-vote-enabled" type="checkbox">
        <input id="admin-player-vote-version">
        <button id="admin-player-vote-config-save"></button>
        <button id="admin-player-vote-reload"></button>
        <div id="admin-player-vote-players"></div>
        <div id="admin-player-vote-detail"></div>
        <div id="admin-player-vote-aggregates"></div>
      </div></div>`, { runScripts: "dangerously" });
    const window = dom.window;
    const root = window.document.getElementById("root");
    const timestamp = { toDate: () => new Date("2026-10-24T12:00:00Z") };
    const players = collectionSnapshot([
      documentSnapshot("player-a", { displayName: "Player A", active: true }),
      documentSnapshot("player-b", { displayName: "Player B", active: true }),
      documentSnapshot("player-c", { displayName: "Player C", active: true }),
    ]);
    const responses = collectionSnapshot([
      documentSnapshot("player-a", { status: "submitted", voteVersion: "2027.1", startedAt: timestamp, updatedAt: timestamp, submittedAt: timestamp, answers: { p1_minimum_budget: "1", p9_extra_competitions: ["1", "3"] } }),
      documentSnapshot("player-b", { status: "draft", voteVersion: "2027.1", startedAt: timestamp, updatedAt: timestamp, submittedAt: null, answers: { p1_minimum_budget: "2" } }),
    ]);
    const config = documentSnapshot("2027-player-vote", { enabled: true, version: "2027.1" });
    let savedConfiguration = null;
    const voteRef = {
      get: async () => config,
      collection: () => ({ get: async () => responses }),
      set: async (value) => { savedConfiguration = value; },
    };
    window.btccDb = { collection: (name) => name === "questionnaires" ? { doc: () => voteRef } : { get: async () => players } };
    window.firebase = {
      auth: () => ({ currentUser: { uid: "admin", getIdTokenResult: async () => ({ claims: { admin: true } }) } }),
      firestore: { FieldValue: { serverTimestamp: () => timestamp } },
    };
    window.eval(voteSource);
    window.eval(adminSource);
    await window.setupAdminPlayerVote(root);
    assert.match(root.querySelector("#admin-player-vote-status").textContent, /1 \/ 3 voted \(33%\) · 1 in progress · 1 not started/);
    root.querySelector("[data-player-vote-player]").click();
    assert.match(root.querySelector("#admin-player-vote-detail").textContent, /Introduce the £9.70 minimum budget/);
    assert.match(root.querySelector("#admin-player-vote-detail").textContent, /Singles knockout; Mini leagues \/ divisions/);
    assert.match(root.querySelector("#admin-player-vote-aggregates").textContent, /Minimum Budget Protection/);
    assert.match(root.querySelector("#admin-player-vote-aggregates").textContent, /Singles knockout/);
    root.querySelector("#admin-player-vote-config-save").click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(savedConfiguration.updatedBy, "admin");
    assert.equal(Object.values(savedConfiguration).includes("admin@example.com"), false);
    dom.window.close();
  });
});
