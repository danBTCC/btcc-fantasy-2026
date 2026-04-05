(function () {
  // ============================================================
  // ADMIN: HOME PAGE NEWS (Editable text boxes)
  // Stores data at meta/homeNews
  // Fields: latestEvent, previousEvent, updatedAt, updatedBy
  // ============================================================
  async function loadAdminHomeNews(root) {
    const msg = root.querySelector("#admin-home-news-msg");
    const latest = root.querySelector("#admin-home-news-latest");
    const prev = root.querySelector("#admin-home-news-prev");

    if (!latest || !prev) return;

    if (!window.btccDb) {
      if (msg) msg.textContent = "Database not ready.";
      return;
    }

    try {
      if (msg) msg.textContent = "Loading…";
      const snap = await window.btccDb.collection("meta").doc("homeNews").get();
      const d = snap.exists ? (snap.data() || {}) : {};

      latest.value = (d.latestEvent || "").toString();
      prev.value = (d.previousEvent || "").toString();

      if (msg) msg.textContent = snap.exists ? "Loaded." : "No saved Home news yet (fill in and Save).";
    } catch (err) {
      console.error("❌ loadAdminHomeNews failed:", err);
      if (msg) msg.textContent = err?.message || "Failed to load";
    }
  }

  function setupAdminHomeNews(root) {
    const saveBtn = root.querySelector("#admin-home-news-save");
    if (!saveBtn) return;

    const msg = root.querySelector("#admin-home-news-msg");
    const latest = root.querySelector("#admin-home-news-latest");
    const prev = root.querySelector("#admin-home-news-prev");

    const setMsg = (t) => {
      if (msg) msg.textContent = t;
    };

    saveBtn.addEventListener("click", async () => {
      if (!window.btccDb) {
        setMsg("Database not ready.");
        return;
      }

      const latestEvent = (latest?.value || "").trim();
      const previousEvent = (prev?.value || "").trim();

      try {
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving…";
        setMsg("");

        const user = firebase.auth().currentUser;
        const who = user?.email || "admin";

        await window.btccDb.collection("meta").doc("homeNews").set(
          {
            latestEvent,
            previousEvent,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: who,
          },
          { merge: true }
        );

        setMsg("Saved.");
      } catch (err) {
        console.error("❌ Save home news failed:", err);
        setMsg(err?.message || "Failed to save");
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Home news";
      }
    });

    loadAdminHomeNews(root);

    const reloadBtn = root.querySelector("#admin-home-news-reload");
    if (reloadBtn) {
      reloadBtn.addEventListener("click", async () => {
        reloadBtn.disabled = true;
        try {
          await loadAdminHomeNews(root);
        } finally {
          reloadBtn.disabled = false;
        }
      });
    }
  }

  window.loadAdminHomeNews = loadAdminHomeNews;
  window.setupAdminHomeNews = setupAdminHomeNews;
})();