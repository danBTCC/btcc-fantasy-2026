const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

describe("driver season snapshot", () => {
  it("renders the preserved 2026 table without reading mutable live data", async () => {
    const dom = new JSDOM('<div id="drivers-list"></div>', { runScripts: "dangerously" });
    dom.window.eval(read("js/data/driver-season-snapshots.js"));
    dom.window.eval(read("js/pages/drivers.js"));

    await dom.window.loadDrivers();

    const container = dom.window.document.getElementById("drivers-list");
    assert.match(container.textContent, /2026 final performance/);
    assert.match(container.textContent, /Ash Sutton/);
    assert.match(container.textContent, /602/);
    assert.equal(container.querySelectorAll("tbody tr").length, 27);
    assert.equal(container.querySelector("tbody tr strong").textContent, "Ash Sutton");
    dom.window.close();
  });

  it("keeps immutable season data separate from the live driver collection", () => {
    const source = read("js/data/driver-season-snapshots.js");
    assert.match(source, /2026:/);
    assert.match(source, /status: "final"/);
    assert.doesNotMatch(source, /btccDb|collection\("drivers"\)/);
  });
});
