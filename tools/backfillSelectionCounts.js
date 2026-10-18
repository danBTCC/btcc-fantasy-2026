const admin = require("firebase-admin");
const path = require("path");

const keyPathArg = process.argv[2];
const apply = process.argv.includes("--apply");

if (!keyPathArg) {
  console.error("Usage: node tools/backfillSelectionCounts.js <path-to-service-account-json> [--apply]");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(path.resolve(keyPathArg))),
});

function teamIds(data) {
  const values = data.team || data.drivers || data.selectedDrivers || data.driverIds || data.picks || data.selection;
  if (!Array.isArray(values) || values.length < 3 || values.length > 6) return [];
  return [...new Set(values.map((value) => {
    if (typeof value === "string") return value;
    return value?.driverId || value?.id || value?.ref || null;
  }).filter(Boolean).map(String))];
}

async function eventEntries(db, eventId) {
  const legacy = await db.collection("entries").doc(eventId).collection("entries").get();
  if (!legacy.empty) return legacy;
  return db.collection("submissions").doc(eventId).collection("entries").get();
}

async function run() {
  const db = admin.firestore();
  const events = await db.collection("events").get();
  let eventCount = 0;
  let driverCount = 0;

  for (const eventDoc of events.docs) {
    const [entries, driverScores] = await Promise.all([
      eventEntries(db, eventDoc.id),
      db.collection("event_scores").doc(eventDoc.id).collection("drivers").get(),
    ]);
    if (entries.empty || driverScores.empty) continue;

    const counts = new Map();
    entries.forEach((entry) => {
      teamIds(entry.data() || {}).forEach((driverId) => {
        counts.set(driverId, Number(counts.get(driverId) || 0) + 1);
      });
    });

    console.log(`${eventDoc.id}: ${entries.size} entries, ${driverScores.size} driver score rows`);
    eventCount += 1;
    driverCount += driverScores.size;
    if (!apply) continue;

    const batch = db.batch();
    driverScores.forEach((driver) => {
      batch.set(driver.ref, { selectionCount: Number(counts.get(driver.id) || 0) }, { merge: true });
    });
    await batch.commit();
  }

  console.log(`${apply ? "Updated" : "Would update"} ${driverCount} driver rows across ${eventCount} events.`);
  if (!apply) console.log("Dry run only. Re-run with --apply after reviewing the event totals.");
}

run().catch((error) => {
  console.error("Selection-count backfill failed:", error);
  process.exitCode = 1;
});
