const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

describe("existing site regression checks", () => {
  it("retains every existing route while adding Questionnaire", () => {
    const app = read("app.js");
    for (const route of ["home", "submit", "tables", "season-stats", "drivers", "results", "news", "pitstop", "admin", "questionnaire"]) {
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

  it("loads questionnaire scripts after Firebase and before Admin setup", () => {
    const html = read("index.html");
    const firebase = html.indexOf("firebase-config.js");
    const questionnaire = html.indexOf("js/pages/questionnaire.js");
    const questionnaireAdmin = html.indexOf("js/admin/questionnaire-admin.js");
    const admin = html.indexOf("js/pages/admin.js");
    assert.ok(firebase >= 0 && firebase < questionnaire);
    assert.ok(questionnaire < questionnaireAdmin && questionnaireAdmin < admin);
  });

  it("adds questionnaire export without removing existing exports", () => {
    const admin = read("js/pages/admin.js");
    for (const id of ["admin-export-full-history", "admin-export-latest-event", "admin-export-current-drivers", "admin-export-current-players", "admin-export-questionnaire"]) {
      assert.match(admin, new RegExp(id));
    }
    const exporter = read("js/admin/data-export.js");
    assert.match(exporter, /questionnaireVersion/);
    assert.match(exporter, /readableAnswers/);
  });
});
