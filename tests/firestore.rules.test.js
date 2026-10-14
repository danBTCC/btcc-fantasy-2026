const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } = require("firebase/firestore");

const PROJECT_ID = "btcc-fantasy-2026-rules-test";
const QUESTIONNAIRE_ID = "2026-end-of-season";
let testEnvironment;

const responsePayload = (uid, name, extra = {}) => ({
  uid,
  playerName: name,
  questionnaireVersion: "2026.1",
  status: "draft",
  currentQuestion: 1,
  reachedQuestion: 1,
  answers: {},
  startedAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  submittedAt: null,
  ...extra,
});

async function seed(enabled = true) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, "meta", "app"), { season: 2026 }),
      setDoc(doc(db, "events", "event_10"), { eventNo: 10 }),
      setDoc(doc(db, "drivers", "driver_1"), { name: "Driver" }),
      setDoc(doc(db, "results", "event_10"), { locked: true }),
      setDoc(doc(db, "event_scores", "event_10", "players", "player-a"), { points: 100 }),
      setDoc(doc(db, "standings_players", "season_2026", "players", "player-a"), { points: 100 }),
      setDoc(doc(db, "pitstop", "tracker"), { season: 2026 }),
      setDoc(doc(db, "news", "final"), { title: "Final" }),
      setDoc(doc(db, "players", "player-a"), { uid: "player-a", displayName: "Player A", budget: 10 }),
      setDoc(doc(db, "players", "player-b"), { uid: "player-b", displayName: "Player B", budget: 10 }),
      setDoc(doc(db, "submissions", "event_10", "entries", "player-a"), { uid: "player-a", driverIds: ["driver_1"] }),
      setDoc(doc(db, "entries", "event_10", "entries", "player-a"), { uid: "player-a", driverIds: ["driver_1"] }),
      setDoc(doc(db, "questionnaires", QUESTIONNAIRE_ID), { enabled, version: "2026.1" }),
    ]);
  });
}

describe("questionnaire Firestore rules", function () {
  this.timeout(30000);

  before(async () => {
    testEnvironment = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8"),
        host: "127.0.0.1",
        port: 8080,
      },
    });
  });

  beforeEach(async () => testEnvironment.clearFirestore());
  after(async () => testEnvironment.cleanup());

  it("preserves public reads used by completed 2026 league pages", async () => {
    await seed();
    const db = testEnvironment.unauthenticatedContext().firestore();
    for (const target of [
      ["meta", "app"],
      ["events", "event_10"],
      ["drivers", "driver_1"],
      ["results", "event_10"],
      ["event_scores", "event_10", "players", "player-a"],
      ["standings_players", "season_2026", "players", "player-a"],
      ["pitstop", "tracker"],
      ["news", "final"],
      ["players", "player-a"],
      ["questionnaires", QUESTIONNAIRE_ID],
    ]) {
      await assertSucceeds(getDoc(doc(db, ...target)));
    }
  });

  it("deliberately preserves public historical submission reads", async () => {
    await seed();
    const anonymous = testEnvironment.unauthenticatedContext().firestore();
    const otherPlayer = testEnvironment.authenticatedContext("player-b").firestore();
    for (const base of ["submissions", "entries"]) {
      const target = [base, "event_10", "entries", "player-a"];
      await assertSucceeds(getDoc(doc(anonymous, base, "event_10")));
      await assertSucceeds(getDoc(doc(anonymous, ...target)));
      await assertSucceeds(getDoc(doc(otherPlayer, ...target)));
    }
  });

  it("keeps existing own-player profile writes and blocks writes to another profile", async () => {
    await seed();
    const player = testEnvironment.authenticatedContext("player-a").firestore();
    await assertSucceeds(setDoc(doc(player, "players", "player-a"), { budget: 999 }, { merge: true }));
    await assertFails(setDoc(doc(player, "players", "player-b"), { budget: 999 }, { merge: true }));
  });

  it("denies public reads of unknown collections", async () => {
    await seed();
    await testEnvironment.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), "future_private_data", "secret"), { value: 1 }));
    await assertFails(getDoc(doc(testEnvironment.unauthenticatedContext().firestore(), "future_private_data", "secret")));
    await assertSucceeds(getDoc(doc(testEnvironment.authenticatedContext("admin", { admin: true }).firestore(), "future_private_data", "secret")));
  });

  it("rejects player response writes while the questionnaire is disabled", async () => {
    await seed(false);
    const player = testEnvironment.authenticatedContext("player-a").firestore();
    await assertFails(setDoc(doc(player, "questionnaires", QUESTIONNAIRE_ID, "responses", "player-a"), responsePayload("player-a", "Player A")));
  });

  it("rejects player response creates and updates when the questionnaire configuration does not exist", async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "players", "player-a"), {
        uid: "player-a",
        displayName: "Player A",
      });
    });

    const player = testEnvironment.authenticatedContext("player-a").firestore();
    const target = doc(player, "questionnaires", QUESTIONNAIRE_ID, "responses", "player-a");
    await assertFails(setDoc(target, responsePayload("player-a", "Player A")));

    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "questionnaires", QUESTIONNAIRE_ID, "responses", "player-a"), responsePayload("player-a", "Player A"));
    });
    const existing = await getDoc(target);
    await assertFails(setDoc(target, responsePayload("player-a", "Player A", {
      currentQuestion: 2,
      reachedQuestion: 2,
      startedAt: existing.data().startedAt,
    })));
  });

  it("allows only Admin to change questionnaire configuration", async () => {
    await seed();
    const player = testEnvironment.authenticatedContext("player-a").firestore();
    const admin = testEnvironment.authenticatedContext("admin", { admin: true }).firestore();
    await assertFails(setDoc(doc(player, "questionnaires", QUESTIONNAIRE_ID), { enabled: false }, { merge: true }));
    await assertSucceeds(setDoc(doc(admin, "questionnaires", QUESTIONNAIRE_ID), { enabled: false }, { merge: true }));
  });

  it("allows an owner draft while denying anonymous and other-player access", async () => {
    await seed();
    const playerA = testEnvironment.authenticatedContext("player-a").firestore();
    const playerB = testEnvironment.authenticatedContext("player-b").firestore();
    const response = doc(playerA, "questionnaires", QUESTIONNAIRE_ID, "responses", "player-a");
    await assertSucceeds(setDoc(response, responsePayload("player-a", "Player A")));
    await assertSucceeds(getDoc(response));
    await assertFails(getDoc(doc(playerB, "questionnaires", QUESTIONNAIRE_ID, "responses", "player-a")));
    await assertFails(getDoc(doc(testEnvironment.unauthenticatedContext().firestore(), "questionnaires", QUESTIONNAIRE_ID, "responses", "player-a")));
    await assertFails(setDoc(doc(playerB, "questionnaires", QUESTIONNAIRE_ID, "responses", "player-a"), responsePayload("player-a", "Player A")));
  });

  it("lets Admin list and read all responses", async () => {
    await seed();
    const playerA = testEnvironment.authenticatedContext("player-a").firestore();
    await setDoc(doc(playerA, "questionnaires", QUESTIONNAIRE_ID, "responses", "player-a"), responsePayload("player-a", "Player A"));
    const admin = testEnvironment.authenticatedContext("admin", { admin: true }).firestore();
    const responses = await assertSucceeds(getDocs(collection(admin, "questionnaires", QUESTIONNAIRE_ID, "responses")));
    assert.equal(responses.size, 1);
  });

  it("updates one document through draft, submit and submitted edit", async () => {
    await seed();
    const player = testEnvironment.authenticatedContext("player-a").firestore();
    const target = doc(player, "questionnaires", QUESTIONNAIRE_ID, "responses", "player-a");
    await setDoc(target, responsePayload("player-a", "Player A"));
    let snapshot = await getDoc(target);
    await assertSucceeds(setDoc(target, responsePayload("player-a", "Player A", {
      currentQuestion: 2,
      reachedQuestion: 2,
      answers: { q1_return: "1" },
      startedAt: snapshot.data().startedAt,
    })));
    snapshot = await getDoc(target);
    await assertSucceeds(setDoc(target, responsePayload("player-a", "Player A", {
      status: "submitted",
      currentQuestion: 12,
      reachedQuestion: 12,
      answers: { q1_return: "1", q12_keep: "Standings" },
      startedAt: snapshot.data().startedAt,
      submittedAt: serverTimestamp(),
    })));
    snapshot = await getDoc(target);
    await assertSucceeds(setDoc(target, responsePayload("player-a", "Player A", {
      status: "submitted",
      currentQuestion: 1,
      reachedQuestion: 12,
      answers: { q1_return: "3", q12_keep: "Standings" },
      startedAt: snapshot.data().startedAt,
      submittedAt: snapshot.data().submittedAt,
    })));
    assert.equal((await getDocs(collection(testEnvironment.authenticatedContext("admin", { admin: true }).firestore(), "questionnaires", QUESTIONNAIRE_ID, "responses"))).size, 1);
  });
});
