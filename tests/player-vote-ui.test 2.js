const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

const source = fs.readFileSync(path.join(__dirname, "..", "js/pages/player-vote.js"), "utf8");
const SERVER_TIMESTAMP = { server: true };

class TestTimestamp {
  constructor(value) { this.value = new Date(value); }
  toDate() { return new Date(this.value); }
}

const resolveTimestamps = (value) => {
  if (value === SERVER_TIMESTAMP || value?.server) return new TestTimestamp(Date.now());
  if (value instanceof TestTimestamp) return value;
  if (Array.isArray(value)) return value.map(resolveTimestamps);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, resolveTimestamps(child)]));
  return value;
};

function harness({ store = new Map(), uid = "player-a", name = "Player A", enabled = true, configExists = true } = {}) {
  const dom = new JSDOM('<div id="player-vote-root"></div>', { runScripts: "dangerously", url: "http://localhost/#vote" });
  const window = dom.window;
  const consoleErrors = [];
  window.console.error = (...args) => consoleErrors.push(args);
  const config = { enabled, version: "2027.1" };
  const snapshot = (exists, data) => ({ exists, data: () => data });
  const responseRef = (id) => ({
    get: async () => store.has(id) ? snapshot(true, store.get(id)) : snapshot(false),
    set: async (data) => store.set(id, resolveTimestamps(data)),
  });
  const voteDocument = {
    onSnapshot: (callback) => { queueMicrotask(() => callback(snapshot(configExists, configExists ? config : undefined))); return () => {}; },
    collection: () => ({ doc: responseRef }),
  };
  window.btccDb = {
    collection: (collectionName) => collectionName === "questionnaires"
      ? { doc: () => voteDocument }
      : collectionName === "players"
        ? { doc: () => ({ get: async () => snapshot(true, { uid, displayName: name }) }) }
        : (() => { throw new Error(collectionName); })(),
  };
  const account = { uid, email: `${uid}@test` };
  const auth = {
    currentUser: account,
    onAuthStateChanged(callback) { queueMicrotask(() => callback(this.currentUser)); return () => {}; },
    signInWithEmailAndPassword: async () => ({ user: account }),
    signOut: async () => { auth.currentUser = null; },
  };
  window.firebase = {
    auth: () => auth,
    firestore: { FieldValue: { serverTimestamp: () => SERVER_TIMESTAMP } },
  };
  window.eval(source);
  window.loadPlayerVote();
  return { dom, window, root: window.document.getElementById("player-vote-root"), store, consoleErrors };
}

const wait = (milliseconds = 20) => new Promise((resolve) => setTimeout(resolve, milliseconds));

describe("2027 Player Vote flow", function () {
  this.timeout(10000);

  it("shows a graceful closed state when disabled or missing", async () => {
    for (const settings of [{ enabled: false }, { configExists: false }]) {
      const test = harness(settings);
      await wait();
      assert.match(test.root.textContent, /Player Vote not currently open/);
      assert.doesNotMatch(test.root.textContent, /Submit My Votes/);
      assert.equal(test.consoleErrors.length, 0);
      test.dom.window.close();
    }
  });

  it("shows all ten approved proposals as one ballot without questionnaire progress language", async () => {
    const test = harness();
    await wait();
    assert.equal(test.root.querySelectorAll(".playerVoteProposal").length, 10);
    assert.match(test.root.textContent, /Minimum Budget Protection/);
    assert.match(test.root.textContent, /Forever Forward Championship/);
    assert.match(test.root.textContent, /0 of 10 proposals voted/);
    assert.doesNotMatch(test.root.textContent, /Question \d+ of/);
    test.dom.window.close();
  });

  it("treats None as exclusive in Extra Competitions", async () => {
    const test = harness();
    await wait();
    test.root.querySelector('[name="p9_extra_competitions"][value="1"]').click();
    test.root.querySelector('[name="p9_extra_competitions"][value="2"]').click();
    assert.equal(test.root.querySelector('[name="p9_extra_competitions"][value="1"]').checked, true);
    assert.equal(test.root.querySelector('[name="p9_extra_competitions"][value="2"]').checked, true);
    test.root.querySelector('[name="p9_extra_competitions"][value="4"]').click();
    assert.equal(test.root.querySelector('[name="p9_extra_competitions"][value="4"]').checked, true);
    assert.equal(test.root.querySelector('[name="p9_extra_competitions"][value="1"]').checked, false);
    test.root.querySelector('[name="p9_extra_competitions"][value="3"]').click();
    assert.equal(test.root.querySelector('[name="p9_extra_competitions"][value="3"]').checked, true);
    assert.equal(test.root.querySelector('[name="p9_extra_competitions"][value="4"]').checked, false);
    test.dom.window.close();
  });

  it("submits one UID document, reopens it and updates the same response", async () => {
    const store = new Map();
    const firstVisit = harness({ store });
    await wait();
    firstVisit.root.querySelector('[name="p1_minimum_budget"][value="1"]').click();
    firstVisit.root.querySelector('[name="p9_extra_competitions"][value="1"]').click();
    firstVisit.root.querySelector("#player-vote-form").dispatchEvent(new firstVisit.window.Event("submit", { bubbles: true, cancelable: true }));
    await wait();
    assert.equal(store.size, 1);
    assert.equal(store.get("player-a").status, "submitted");
    assert.equal(store.get("player-a").answers.p1_minimum_budget, "1");
    assert.deepEqual(Array.from(store.get("player-a").answers.p9_extra_competitions), ["1"]);
    firstVisit.dom.window.close();

    const returnVisit = harness({ store });
    await wait();
    assert.equal(returnVisit.root.querySelector('[name="p1_minimum_budget"][value="1"]').checked, true);
    assert.match(returnVisit.root.textContent, /saved votes are shown below/i);
    returnVisit.root.querySelector('[name="p1_minimum_budget"][value="2"]').click();
    returnVisit.root.querySelector("#player-vote-form").dispatchEvent(new returnVisit.window.Event("submit", { bubbles: true, cancelable: true }));
    await wait();
    assert.equal(store.size, 1);
    assert.equal(store.get("player-a").answers.p1_minimum_budget, "2");
    returnVisit.dom.window.close();
  });

  it("keeps different logged-in players on separate response documents", async () => {
    const store = new Map();
    const playerA = harness({ store });
    await wait();
    playerA.root.querySelector('[name="p1_minimum_budget"][value="1"]').click();
    playerA.root.querySelector("#player-vote-form").dispatchEvent(new playerA.window.Event("submit", { bubbles: true, cancelable: true }));
    await wait();
    playerA.dom.window.close();
    const playerB = harness({ store, uid: "player-b", name: "Player B" });
    await wait();
    assert.equal(playerB.root.querySelector('[name="p1_minimum_budget"][value="1"]').checked, false);
    assert.equal(store.has("player-b"), false);
    playerB.dom.window.close();
  });
});
