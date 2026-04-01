// js/pages/news.js
// Exposes: window.loadNews()

(function () {

  function renderNews(root) {
    root.innerHTML = `
      <div class="card">
        <h1>News</h1>

        <!-- HOW TO PLAY -->
        <div class="card" style="margin-top:10px;">
          <button class="collapseHeader" type="button" data-toggle="how-to-play-wrap" style="width:100%; text-align:left; background:transparent; border:0; padding:0;">
            <h2 style="margin:0; display:flex; justify-content:space-between;">
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

        <!-- FUTURE NEWS POSTS -->
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
  }

  window.loadNews = loadNews;

})();