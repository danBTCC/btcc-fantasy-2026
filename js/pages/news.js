// js/pages/news.js
// Exposes: window.loadNews()

(function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatNewsAuthor(value) {
    const raw = String(value ?? "").replace(/^"+|"+$/g, "").trim();
    if (!raw) return "Dan";
    if (raw.includes("@")) return "Dan";
    return raw;
  }

  function renderNews(root) {
    root.innerHTML = `
      <!-- HOW TO PLAY (separate card) -->
      <div class="card">
        <button class="collapseHeader" type="button" data-toggle="how-to-play-wrap" style="width:100%; text-align:left; background:transparent; border:0; padding:0; color:var(--text);">
          <h2 style="margin:0; display:flex; justify-content:space-between; color:var(--text);">
            <span>How to Play</span>
            <span class="tiny muted">▸</span>
          </h2>
        </button>

        <div id="how-to-play-wrap" hidden style="margin-top:10px;">
          <div class="tiny muted">

            <p><strong>Build your team</strong></p>
            <ul>
              <li>Select 3–6 drivers</li>
              <li>Stay within your budget</li>
              <li>Optional SLD (+10%)</li>
            </ul>

            <p><strong>Scoring</strong></p>
            <ul>
              <li>Points based on race results</li>
              <li>Driver values change after each event</li>
            </ul>

            <p><strong>Tips</strong></p>
            <ul>
              <li>Expected Points is a guide, not a guarantee</li>
              <li>Track form matters</li>
            </ul>

          </div>
        </div>
      </div>

      <!-- NEWS -->
      <div class="card" style="margin-top:10px;">
        <h1>News</h1>

        <div id="news-list" style="margin-top:12px;">
          <div class="note">No news yet.</div>
        </div>
      </div>
    `;
  }

  async function loadNews() {
    const root = document.getElementById("news-root");
    if (!root) return;

    renderNews(root);

    const list = root.querySelector("#news-list");

    if (list && window.btccDb) {
      try {
        const snap = await window.btccDb
          .collection("news")
          .orderBy("createdAt", "desc")
          .get();

        if (snap.empty) {
          list.innerHTML = `<div class="note">No news yet.</div>`;
        } else {
          list.innerHTML = snap.docs.map((doc) => {
            const d = doc.data() || {};
            const title = String(d.title || "Untitled").replace(/^"+|"+$/g, "").trim();
            const content = String(d.content || "").replace(/^"+|"+$/g, "").trim();
            const createdBy = formatNewsAuthor(d.createdBy || "Dan");
            const createdAt = d.createdAt && typeof d.createdAt.toDate === "function"
              ? d.createdAt.toDate().toLocaleString("en-GB")
              : "—";

            return `
              <div class="note" style="margin-top:10px;">
                <div style="font-weight:700; color:var(--text);">${escapeHtml(title)}</div>
                <div class="tiny muted" style="margin-top:4px;">${escapeHtml(createdAt)} • ${escapeHtml(createdBy)}</div>
                <div class="tiny muted" style="margin-top:8px; white-space:pre-line;">${escapeHtml(content)}</div>
              </div>
            `;
          }).join("");
        }
      } catch (err) {
        console.error("❌ Failed to load news:", err);
        list.innerHTML = `<div class="note warnNote">Failed to load news.</div>`;
      }
    }

    // Collapse toggle logic
    root.querySelectorAll("[data-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-toggle");
        const el = root.querySelector(`#${targetId}`);
        if (!el) return;

        el.hidden = !el.hidden;

        const chevron = btn.querySelector(".tiny");
        if (chevron) {
          chevron.textContent = el.hidden ? "▸" : "▾";
        }
      });
    });
  }

  window.loadNews = loadNews;

})();