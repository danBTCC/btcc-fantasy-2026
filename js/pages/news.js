// js/pages/news.js
// Exposes: window.loadNews()

(function () {
  const NEWS_REACTIONS = [
    { type: "like", emoji: "👍", label: "Like" },
    { type: "love", emoji: "❤️", label: "Love" },
    { type: "funny", emoji: "😂", label: "Funny" },
    { type: "wow", emoji: "😮", label: "Wow" },
  ];

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

  function renderReactionButtons(mount, counts, selectedType, currentUser) {
    if (!mount) return;

    const canReact = Boolean(currentUser);
    const buttons = NEWS_REACTIONS.map((reaction) => {
      const count = Number(counts?.[reaction.type] || 0);
      const selected = selectedType === reaction.type;
      const loginHint = canReact ? "" : ". Log in to react";

      return `
        <button
          class="newsReactionButton"
          type="button"
          data-reaction-type="${reaction.type}"
          aria-label="${reaction.label}: ${count} reaction${count === 1 ? "" : "s"}${loginHint}"
          aria-pressed="${selected ? "true" : "false"}"
          ${!canReact ? "disabled" : ""}
        >
          <span aria-hidden="true">${reaction.emoji}</span>
          <span>${count}</span>
        </button>
      `;
    }).join("");

    mount.innerHTML = `
      <div class="newsReactionsTitle">Reactions</div>
      <div class="newsReactionButtons">${buttons}</div>
      <div class="newsReactionStatus tiny muted" role="status" aria-live="polite">
        ${canReact ? "" : "Log in to add a reaction."}
      </div>
    `;
  }

  async function loadNewsReactions(newsId, mount, currentUser) {
    if (!newsId || !mount || !window.btccDb) return;

    const counts = Object.fromEntries(NEWS_REACTIONS.map((reaction) => [reaction.type, 0]));
    const validTypes = new Set(NEWS_REACTIONS.map((reaction) => reaction.type));

    try {
      mount.dataset.reactionsLoaded = "loading";
      mount.dataset.newsId = newsId;
      mount.innerHTML = `<div class="tiny muted">Loading reactions…</div>`;

      const snap = await window.btccDb
        .collection("news")
        .doc(newsId)
        .collection("reactions")
        .get();

      let selectedType = "";
      snap.forEach((doc) => {
        const type = String(doc.data()?.type || "").toLowerCase();
        if (!validTypes.has(type)) return;
        counts[type] += 1;
        if (currentUser && doc.id === currentUser.uid) selectedType = type;
      });

      mount.dataset.reactionsLoaded = "true";
      renderReactionButtons(mount, counts, selectedType, currentUser);

      mount.querySelectorAll("[data-reaction-type]").forEach((button) => {
        button.addEventListener("click", async () => {
          const user = firebase.auth().currentUser;
          const type = button.getAttribute("data-reaction-type");
          if (!user || !validTypes.has(type)) return;

          const reactionRef = window.btccDb
            .collection("news")
            .doc(newsId)
            .collection("reactions")
            .doc(user.uid);

          try {
            mount.querySelectorAll("[data-reaction-type]").forEach((reactionButton) => {
              reactionButton.disabled = true;
            });
            const status = mount.querySelector(".newsReactionStatus");
            if (status) status.textContent = "Updating reaction…";

            if (selectedType === type) {
              await reactionRef.delete();
            } else {
              await reactionRef.set({
                type,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              });
            }

            await loadNewsReactions(newsId, mount, user);
          } catch (err) {
            console.error("❌ Failed to update news reaction:", err);
            mount.querySelectorAll("[data-reaction-type]").forEach((reactionButton) => {
              reactionButton.disabled = false;
            });
            const errorStatus = mount.querySelector(".newsReactionStatus");
            if (errorStatus) errorStatus.textContent = `Reaction failed: ${err?.message || "Please try again."}`;
          }
        });
      });
    } catch (err) {
      console.error("❌ Failed to load news reactions:", err);
      delete mount.dataset.reactionsLoaded;
      mount.innerHTML = `<div class="tiny muted">Reactions unavailable.</div>`;
    }
  }

  function renderNews(root) {
    root.innerHTML = `
      <!-- HOW TO PLAY (separate card) -->
      <div class="card">
        <button class="collapseHeader" type="button" data-toggle="how-to-play-wrap" style="width:100%; text-align:left; background:transparent; border:0; padding:0; color:var(--text);">
          <h2 style="margin:0; display:flex; justify-content:space-between; color:var(--text);">
            <span>How to Play (click to expand)</span>
            <span class="tiny muted">▸</span>
          </h2>
        </button>

        <div id="how-to-play-wrap" hidden style="margin-top:10px;">
          <div class="tiny muted">

            <p><strong>🏁 BTCC Fantasy League – How to Play</strong></p>

            <p><strong>Budget</strong></p>
            <ul>
              <li>You start with a £10.00 budget</li>
              <li>You must stay within this when selecting your team</li>
              <li>Driver prices may change during the season</li>
            </ul>

            <p><strong>Picking Your Team</strong></p>
            <ul>
              <li>Select 3–6 drivers each event</li>
              <li>Event 1: Free choice</li>
              <li>From Event 2 onwards: Tier rules apply</li>
            </ul>

            <p><strong>Tier System (from Event 2)</strong></p>
            <ul>
              <li>Drivers split into High / Mid / Low tiers based on standings</li>
              <li>Pick at least 1 driver from each tier</li>
              <li>Maximum 2 drivers per tier</li>
            </ul>

            <p><strong>Repetition Rule</strong></p>
            <ul>
              <li>You cannot pick the same driver 3 events in a row</li>
            </ul>

            <p><strong>Star Drivers (from Event 2)</strong></p>
            <ul>
              <li>Underdog Driver → 20% cheaper (community vote)</li>
              <li>Form Driver → 5% more expensive (championship leader)</li>
              <li>Season Long Driver overrides both</li>
            </ul>

            <p><strong>Season Long Driver (SLD)</strong></p>
            <ul>
              <li>Optional, chosen before Event 1</li>
              <li>+10% cost, locked for the season</li>
              <li>Counts as a driver and ignores repetition rules</li>
            </ul>

            <p><strong>Lockout</strong></p>
            <ul>
              <li>Teams lock at 14:00 on race weekend (Saturday)</li>
            </ul>

            <p><strong>Submitting Your Team</strong></p>
            <ul>
              <li>You can edit your team until lockout</li>
              <li>Your last saved team counts</li>
            </ul>

            <p><strong>Scoring</strong></p>
            <ul>
              <li>Drivers score points based on race results</li>
              <li>Your team total is the sum of your selected drivers</li>
            </ul>

            <p><strong>Need Help?</strong><br>
            If you want a more detailed explanation, just ask 👍</p>

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
    let currentUser = typeof firebase !== "undefined" && firebase.auth
      ? firebase.auth().currentUser
      : null;

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
            const newsBodyId = `news-body-${doc.id}`;

            return `
              <div class="note" style="margin-top:10px;">
                <button class="collapseHeader" type="button" data-toggle="${newsBodyId}" style="width:100%; text-align:left; background:transparent; border:0; padding:0; color:var(--text);">
                  <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
                    <div>
                      <div style="font-weight:700; color:var(--text);">${escapeHtml(title)}</div>
                      <div class="tiny muted" style="margin-top:4px;">${escapeHtml(createdAt)} • ${escapeHtml(createdBy)}</div>
                    </div>
                    <span class="tiny muted">▸</span>
                  </div>
                </button>
                <div id="${newsBodyId}" hidden class="tiny muted" style="margin-top:8px;">
                  <div style="white-space:pre-line;">${escapeHtml(content)}</div>
                  <div class="newsReactions" data-news-reactions data-news-id="${escapeHtml(doc.id)}"></div>
                </div>
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

        if (!el.hidden) {
          const reactionsMount = el.querySelector("[data-news-reactions]");
          const newsId = reactionsMount?.getAttribute("data-news-id") || "";
          const reactionState = reactionsMount?.dataset?.reactionsLoaded || "";
          if (reactionsMount && reactionState !== "loading" && reactionState !== "true") {
            loadNewsReactions(newsId, reactionsMount, currentUser);
          }
        }

        const chevron = btn.querySelector(".tiny");
        if (chevron) {
          chevron.textContent = el.hidden ? "▸" : "▾";
        }
      });
    });

    if (typeof firebase !== "undefined" && firebase.auth) {
      firebase.auth().onAuthStateChanged((user) => {
        currentUser = user;
        root.querySelectorAll('[data-news-reactions][data-reactions-loaded="true"]').forEach((mount) => {
          loadNewsReactions(mount.getAttribute("data-news-id") || "", mount, currentUser);
        });
      });
    }
  }

  window.loadNews = loadNews;

})();
