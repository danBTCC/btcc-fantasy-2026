const admin = require("firebase-admin");
const path = require("path");

const email = process.argv[2];
const keyPathArg = process.argv[3];

if (!email || !keyPathArg) {
  console.error("Usage: node tools/setAdminClaim.js <email> <path-to-service-account-json>");
  process.exit(1);
}

const keyPath = path.resolve(keyPathArg);

admin.initializeApp({
  credential: admin.credential.cert(require(keyPath)),
});

async function run() {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });

  console.log(`✅ Set admin claim for ${email} (uid: ${user.uid})`);
  console.log("➡️ Now sign out/in in the web app to refresh the token.");
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
