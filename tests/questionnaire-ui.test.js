const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

const source = fs.readFileSync(path.join(__dirname, "..", "js/pages/questionnaire.js"), "utf8");
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
  const dom = new JSDOM('<div id="questionnaire-root"></div>', { runScripts: "dangerously", url: "http://localhost/#questionnaire" });
  const window = dom.window;
  const consoleErrors = [];
  window.console.error = (...args) => consoleErrors.push(args);
  const config = { enabled, version: "2026.1" };
  const snapshot = (exists, data) => ({ exists, data: () => data });
  const responseRef = (id) => ({
    get: async () => store.has(id) ? snapshot(true, store.get(id)) : snapshot(false),
    set: async (data) => store.set(id, resolveTimestamps(data)),
  });
  const questionnaireDocument = {
    onSnapshot: (callback) => { queueMicrotask(() => callback(snapshot(configExists, configExists ? config : undefined))); return () => {}; },
    collection: () => ({ doc: responseRef }),
  };
  window.btccDb = {
    collection: (collectionName) => collectionName === "questionnaires"
      ? { doc: () => questionnaireDocument }
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
  window.loadQuestionnaire();
  return { dom, window, root: window.document.getElementById("questionnaire-root"), store, consoleErrors };
}

const wait = (milliseconds = 20) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const clickAction = (root, action) => {
  const button = root.querySelector(`[data-questionnaire-action="${action}"]`);
  assert.ok(button, `Missing ${action} button`);
  button.click();
};

describe("questionnaire player flow", function () {
  this.timeout(10000);

  it("shows the Admin-controlled closed state", async () => {
    const test = harness({ enabled: false });
    await wait();
    assert.match(test.root.textContent, /not currently open/i);
    assert.doesNotMatch(test.root.textContent, /Start Questionnaire/);
    test.dom.window.close();
  });

  it("fails gracefully when the questionnaire configuration document does not exist", async () => {
    const test = harness({ configExists: false });
    await wait();
    assert.match(test.root.textContent, /Questionnaire not currently open/);
    assert.match(test.root.textContent, /not accepting responses yet/);
    assert.doesNotMatch(test.root.textContent, /Start Questionnaire/);
    assert.equal(test.consoleErrors.length, 0);
    test.dom.window.close();
  });

  it("starts, saves on Next, and Back retains answers", async () => {
    const test = harness();
    await wait();
    assert.match(test.root.textContent, /Start Questionnaire/);
    clickAction(test.root, "start");
    await wait();
    test.root.querySelector('[name="q1_return"][value="1"]').click();
    clickAction(test.root, "next");
    await wait();
    assert.match(test.root.textContent, /Question 2 of 12/);
    assert.equal(test.store.get("player-a").answers.q1_return, "1");
    clickAction(test.root, "back");
    assert.equal(test.root.querySelector('[name="q1_return"][value="1"]').checked, true);
    test.dom.window.close();
  });

  it("Save Progress persists a draft and conditional values resume", async () => {
    const store = new Map();
    const firstVisit = harness({ store });
    await wait();
    clickAction(firstVisit.root, "start");
    await wait();
    clickAction(firstVisit.root, "next");
    await wait();
    clickAction(firstVisit.root, "next");
    await wait();
    firstVisit.root.querySelector('[name="q3_values"][value="2"]').click();
    const comment = firstVisit.root.querySelector('[name="q3_values_comment"]');
    comment.value = "Smaller changes";
    comment.dispatchEvent(new firstVisit.window.Event("input", { bubbles: true }));
    clickAction(firstVisit.root, "save");
    await wait();
    firstVisit.dom.window.close();

    const returnVisit = harness({ store });
    await wait();
    assert.match(returnVisit.root.textContent, /Continue Questionnaire/);
    clickAction(returnVisit.root, "start");
    await wait();
    assert.equal(returnVisit.root.querySelector('[name="q3_values_comment"]').value, "Smaller changes");
    assert.equal(returnVisit.root.querySelector("#q3-values-follow").hidden, false);
    returnVisit.dom.window.close();
  });

  it("keeps both Question 11 award questions visible to every player", async () => {
    const test = harness();
    await wait();
    clickAction(test.root, "start");
    await wait();
    for (let step = 1; step < 11; step += 1) {
      clickAction(test.root, "next");
      await wait();
    }
    assert.match(test.root.textContent, /How do you feel about the end-of-season trophies and medals/);
    assert.match(test.root.textContent, /If the award system changed, which would you prefer/);
    test.root.querySelector('[name="q11_feeling"][value="1"]').click();
    assert.ok(test.root.querySelector('[name="q11_system"]'));
    test.dom.window.close();
  });

  it("submits then reopens the same response for editing", async () => {
    const test = harness();
    await wait();
    clickAction(test.root, "start");
    await wait();
    for (let step = 1; step < 12; step += 1) {
      clickAction(test.root, "next");
      await wait();
    }
    clickAction(test.root, "submit");
    await wait();
    assert.match(test.root.textContent, /Questionnaire submitted/);
    assert.equal(test.store.size, 1);
    assert.equal(test.store.get("player-a").status, "submitted");
    clickAction(test.root, "review");
    assert.match(test.root.textContent, /Question 1 of 12/);
    test.root.querySelector('[name="q1_return"][value="3"]').click();
    clickAction(test.root, "save");
    await wait();
    assert.equal(test.store.size, 1);
    assert.equal(test.store.get("player-a").status, "submitted");
    assert.equal(test.store.get("player-a").answers.q1_return, "3");
    test.dom.window.close();
  });

  it("keeps logged-in players isolated", async () => {
    const store = new Map();
    const playerA = harness({ store });
    await wait();
    clickAction(playerA.root, "start");
    await wait();
    clickAction(playerA.root, "save");
    await wait();
    playerA.dom.window.close();
    const playerB = harness({ store, uid: "player-b", name: "Player B" });
    await wait();
    assert.match(playerB.root.textContent, /Start Questionnaire/);
    assert.equal(store.has("player-b"), false);
    playerB.dom.window.close();
  });
});
