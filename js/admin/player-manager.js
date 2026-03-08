(function () {
  // ============================================================
  // ADMIN: PLAYER MANAGER (Create / Update players)
  // ============================================================
  function setupAdminPlayerManager(root) {
    const btn = root.querySelector("#admin-player-save");
    if (!btn) return;

    const msg = root.querySelector("#admin-player-msg");

    btn.addEventListener("click", async () => {
      const uid = root.querySelector("#admin-player-uid")?.value?.trim();
      const displayName = root.querySelector("#admin-player-name")?.value?.trim();
      const teamId = root.querySelector("#admin-player-team")?.value?.trim() || "unassigned";
      const budget = Number(root.querySelector("#admin-player-budget")?.value || 0);

      if (!uid || !displayName) {
        if (msg) msg.textContent = "UID and Display Name are required.";
        return;
      }

      if (!window.btccDb) {
        if (msg) msg.textContent = "Database not ready.";
        return;
      }

      try {
        btn.disabled = true;
        btn.textContent = "Saving…";

        await window.btccDb.collection("players").doc(uid).set(
          {
            uid,
            displayName,
            teamId,
            teamName: teamId,
            budget,
            active: true,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );

        if (msg) msg.textContent = `Saved player: ${displayName}`;
        btn.textContent = "Save player";
      } catch (err) {
        console.error("❌ Save player failed:", err);
        if (msg) msg.textContent = err?.message || "Failed to save player";
        btn.textContent = "Save player";
      } finally {
        btn.disabled = false;
      }
    });
  }

  window.setupAdminPlayerManager = setupAdminPlayerManager;
})();