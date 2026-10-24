const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

describe("existing site regression checks", () => {
  it("retains every existing route while adding the 2027 Player Vote", () => {
    const app = read("app.js");
    for (const route of ["home", "submit", "tables", "season-stats", "drivers", "results", "news", "pitstop", "admin", "vote"]) {
      assert.match(app, new RegExp(`(?:\\"|')?${route}(?:\\"|')?`));
    }
  });

  it("retains all existing page containers and navigation tabs", () => {
    const html = read("index.html");
    for (const route of ["home", "submit", "tables", "season-stats", "drivers", "results", "news", "pitstop", "admin"]) {
      assert.match(html, new RegExp(`data-view=\\"${route}\\"`));
    }
    for (const route of ["home", "submit", "drivers", "season-stats", "results", "news", "pitstop", "admin"]) {
      assert.match(html, new RegExp(`data-route=\\"${route}\\"`));
    }
  });

  it("does not change Drivers to require a new aggregate or backfill", () => {
    const drivers = read("js/pages/drivers.js");
    assert.match(drivers, /collection\("entries"\)/);
    assert.match(drivers, /collection\("submissions"\)/);
  });

  it("loads the archive and Player Vote scripts after Firebase and before Admin setup", () => {
    const html = read("index.html");
    const firebase = html.indexOf("firebase-config.js");
    const questionnaire = html.indexOf("js/pages/questionnaire.js");
    const playerVote = html.indexOf("js/pages/player-vote.js");
    const questionnaireAdmin = html.indexOf("js/admin/questionnaire-admin.js");
    const playerVoteAdmin = html.indexOf("js/admin/player-vote-admin.js");
    const admin = html.indexOf("js/pages/admin.js");
    assert.ok(firebase >= 0 && firebase < questionnaire);
    assert.ok(questionnaire < playerVote && playerVote < questionnaireAdmin);
    assert.ok(questionnaireAdmin < playerVoteAdmin && playerVoteAdmin < admin);
  });

  it("adds questionnaire export without removing existing exports", () => {
    const admin = read("js/pages/admin.js");
    for (const id of ["admin-export-full-history", "admin-export-latest-event", "admin-export-current-drivers", "admin-export-current-players", "admin-export-questionnaire", "admin-export-player-vote"]) {
      assert.match(admin, new RegExp(id));
    }
    const exporter = read("js/admin/data-export.js");
    assert.match(exporter, /questionnaireVersion/);
    assert.match(exporter, /voteVersion/);
    assert.match(exporter, /readableAnswers/);
  });

  it("keeps the Player Vote responsive without an internal scrolling card", () => {
    const css = read("styles.css");
    assert.match(css, /\.questionnaireCard\s*\{[^}]*overflow:\s*visible/s);
    assert.match(css, /@media \(max-width:\s*620px\)[\s\S]*\.playerVoteProgress\s*\{[^}]*position:\s*static/s);
    assert.match(css, /@media \(max-width:\s*620px\)[\s\S]*\.playerVoteSubmit \.questionnaireButton\s*\{[^}]*width:\s*100%/s);
  });
});
