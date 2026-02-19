// js/pages/results.js
// Exposes: window.loadResults()

// js/pages/results.js
// Exposes: window.loadResults()

(function () {
  // ---- helpers ----
  const escapeHtml = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const fmtDate = (v) => {
    // Firestore Timestamp
    if (v && typeof v.toDate === "function") {
      return v.toDate().toLocaleDateString("en-GB");
    }
    // ISO string (YYYY-MM-DD)
    if (typeof v === "string" && v.length >= 10) {
      const d = new Date(v);
      if (!isNaN(d)) return d.toLocaleDateString("en-GB");
      return v;
    }
    return "—";
  };

  const safeUrl = (url) => {
    if (!url) return null;
    try {
      const u = new URL(url);
      if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
      return null;
    } catch {
      return null;
    }
  };

  const renderDriverList = (label, arr) => {
    if (!Array.isArray(arr) || arr.length === 0) {
      return `<li>${escapeHtml(label)}: <span class="muted">not available</span></li>`;
    }
    // We store driverIds in results/*, so show ids for now. (Later we can map id->name.)
    return `<li>${escapeHtml(label)}: <span class="muted">${arr
      .map((x) => escapeHtml(x))
      .join(", ")}</span></li>`;
  };

  const renderPlayerScoresTable = (rows) => {
    if (!rows.length) {
      return `<div class="note">No event scores yet.</div>`;
    }

    const head = `
      <table class="table tiny" style="width:100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="text-align:left; padding:6px;">Player</th>
            <th style="text-align:right; padding:6px;">Q</th>
            <th style="text-align:right; padding:6px;">R1</th>
            <th style="text-align:right; padding:6px;">R2</th>
            <th style="text-align:right; padding:6px;">R3</th>
            <th style="text-align:right; padding:6px;">Total</th>
          </tr>
        </thead>
        <tbody>
    `;

    const body = rows
      .map((r) => {
        const q = r.breakdown?.q ?? r.breakdown?.qualifying;
        const r1 = r.breakdown?.r1 ?? r.breakdown?.race1;
        const r2 = r.breakdown?.r2 ?? r.breakdown?.race2;
        const r3 = r.breakdown?.r3 ?? r.breakdown?.race3;

        const n = (v) => (typeof v === "number" ? v : 0);

        const computedTotal = n(q) + n(r1) + n(r2) + n(r3);

        const total =
          typeof r.points === "number"
            ? r.points
            : typeof r.total === "number"
              ? r.total
              : typeof r.breakdown?.total === "number"
                ? r.breakdown.total
                : computedTotal;

        return `
          <tr>
            <td style="padding:6px;">${escapeHtml(r.displayName || r.playerName || r.uid || "Player")}</td>
            <td style="padding:6px; text-align:right;">${n(q)}</td>
            <td style="padding:6px; text-align:right;">${n(r1)}</td>
            <td style="padding:6px; text-align:right;">${n(r2)}</td>
            <td style="padding:6px; text-align:right;">${n(r3)}</td>
            <td style="padding:6px; text-align:right;"><strong>${n(total)}</strong></td>
          </tr>
        `;
      })
      .join("");

    const foot = `</tbody></table>`;
    return head + body + foot;
  };

  const renderDriverFantasyTable = (rows) => {
    // rows: [{driverId, name?, q?, r1?, r2?, r3?, total}]
    if (!rows.length) {
      return `<div class="note">No driver breakdown available yet.</div>`;
    }

    const head = `
      <table class="table tiny" style="width:100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="text-align:left; padding:6px;">Driver</th>
            <th style="text-align:right; padding:6px;">Q</th>
            <th style="text-align:right; padding:6px;">R1</th>
            <th style="text-align:right; padding:6px;">R2</th>
            <th style="text-align:right; padding:6px;">R3</th>
            <th style="text-align:right; padding:6px;">Total</th>
          </tr>
        </thead>
        <tbody>
    `;

    const n = (v) => (typeof v === "number" ? v : "—");

    const body = rows
      .map((r) => {
        return `
          <tr>
            <td style="padding:6px;">${escapeHtml(r.name || r.driverId)}</td>
            <td style="padding:6px; text-align:right;">${n(r.q)}</td>
            <td style="padding:6px; text-align:right;">${n(r.r1)}</td>
            <td style="padding:6px; text-align:right;">${n(r.r2)}</td>
            <td style="padding:6px; text-align:right;">${n(r.r3)}</td>
            <td style="padding:6px; text-align:right;"><strong>${escapeHtml(r.total ?? 0)}</strong></td>
          </tr>
        `;
      })
      .join("");

    const foot = `</tbody></table>`;
    return head + body + foot;
  };

  // ---- main ----
  async function loadResults() {
    const el = document.getElementById("events-list");
    if (!el) return;

    el.textContent = "Loading…";

    try {
      if (!window.btccDb) throw new Error("btccDb not available");

      // Load drivers for id->name mapping (best-effort)
      let driverNameById = {};
      try {
        const dsnap = await window.btccDb.collection("drivers").get();
        dsnap.forEach((d) => {
          const data = d.data() || {};
          if (data.name) driverNameById[d.id] = data.name;
        });
      } catch (e) {
        console.warn("⚠️ Could not preload drivers list for name mapping:", e);
      }

      const snap = await window.btccDb.collection("events").orderBy("eventNo").get();

      if (snap.empty) {
        el.textContent = "No data yet";
        return;
      }

      // Render shell first (fast), then progressively hydrate details.
      el.innerHTML = `
        <ul class="list">
          ${snap.docs
            .map((doc) => {
              const d = doc.data() || {};
              const from = fmtDate(d.dateFrom);
              const to = fmtDate(d.dateTo);
              const dates =
                from !== "—" && to !== "—" ? `${from}–${to}` : from !== "—" ? from : "—";
              const status = (d.status || "upcoming").toString();
              const rounds = d.roundFrom && d.roundTo ? `R${d.roundFrom}–${d.roundTo}` : "";

              const officialUrl = safeUrl(d.officialResultsUrl || d.tslUrl || d.resultsUrl);
              const officialLink = officialUrl
                ? `<a class="tiny" href="${escapeHtml(officialUrl)}" target="_blank" rel="noopener noreferrer">Official results link</a>`
                : `<span class="tiny muted">Official results link: —</span>`;

              return `
                <li class="eventItem" data-event-id="${escapeHtml(doc.id)}">
                  <div class="eventHeader" data-toggle="event-details">
                    <strong>Event ${d.eventNo ?? "—"}</strong> — ${escapeHtml(d.venue ?? d.name ?? "Unnamed")}<br>
                    <span class="tiny muted">${escapeHtml(rounds)} • ${escapeHtml(dates)} • ${escapeHtml(status)}</span>
                    <div class="tiny muted">▾ Details</div>
                  </div>

                  <div class="eventDetails" hidden>
                    <div class="tiny" style="margin: 6px 0;">${officialLink}</div>

                    <div class="note" data-slot="results">Loading results…</div>

                    <div style="margin-top:10px;">
                      <div class="tiny muted" style="margin-bottom:6px;">Player points (this event)</div>
                      <div data-slot="playerScores">Loading…</div>
                    </div>

                    <div style="margin-top:10px;">
                      <div class="tiny muted" style="margin-bottom:6px;">Driver points breakdown (from fantasy scoring data)</div>
                      <div data-slot="driverScores">Loading…</div>
                    </div>
                  </div>
                </li>
              `;
            })
            .join("")}
        </ul>
      `;

      // Toggle details
      el.querySelectorAll("[data-toggle='event-details']").forEach((header) => {
        header.addEventListener("click", () => {
          const details = header.parentElement.querySelector(".eventDetails");
          if (details) details.hidden = !details.hidden;
        });
      });

      // Hydrate each event details (results doc + event_scores)
      const items = Array.from(el.querySelectorAll("[data-event-id]"));
      await Promise.all(
        items.map(async (item) => {
          const eventId = item.getAttribute("data-event-id");
          if (!eventId) return;

          const resultsSlot = item.querySelector('[data-slot="results"]');
          const playerScoresSlot = item.querySelector('[data-slot="playerScores"]');
          const driverScoresSlot = item.querySelector('[data-slot="driverScores"]');

          // ---- results/{eventId} ----
          try {
            const rdoc = await window.btccDb.collection("results").doc(eventId).get();
            const rdata = rdoc.exists ? rdoc.data() || {} : null;

            if (!rdata) {
              if (resultsSlot) resultsSlot.innerHTML = `<div class="note">No results published yet.</div>`;
            } else {
              const q = rdata.qualifying;
              const r1 = rdata.race1;
              const r2 = rdata.race2;
              const r3 = rdata.race3;

              const mapName = (id) => driverNameById[id] || id;
              const listLine = (label, arr) => {
                if (!Array.isArray(arr) || arr.length === 0) {
                  return `<li>${escapeHtml(label)}: <span class="muted">not available</span></li>`;
                }
                return `<li>${escapeHtml(label)}: <span class="muted">${arr.map(mapName).map(escapeHtml).join(", ")}</span></li>`;
              };

              if (resultsSlot) {
                resultsSlot.innerHTML = `
                  <ul class="list tiny" style="margin:0;">
                    ${listLine("Qualifying", q)}
                    ${listLine("Race 1", r1)}
                    ${listLine("Race 2", r2)}
                    ${listLine("Race 3", r3)}
                  </ul>
                `;
              }
            }
          } catch (e) {
            console.warn("⚠️ Failed to read results doc for", eventId, e);
            if (resultsSlot) resultsSlot.innerHTML = `<div class="note warnNote">Failed to load results.</div>`;
          }

          // ---- event_scores/{eventId}/players ----
          let scoreDocs = [];
          try {
            const psnap = await window.btccDb
  .collection("event_scores")
  .doc(eventId)
  .collection("players")
  .get();

scoreDocs = psnap.docs.map((d) => ({ uid: d.id, ...(d.data() || {}) }));

// Sort locally (robust even if some docs have missing points)
scoreDocs.sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0));

            if (playerScoresSlot) {
              playerScoresSlot.innerHTML = renderPlayerScoresTable(scoreDocs);
            }
          } catch (e) {
            console.warn("⚠️ Failed to read event_scores for", eventId, e);
            if (playerScoresSlot) playerScoresSlot.innerHTML = `<div class="note warnNote">No event scores available.</div>`;
          }

          // ---- Driver breakdown table (best-effort) ----
          // We aggregate across all player score docs.
          // Supports either:
          //   - doc.perDriver: {driverId: totalPts}
          //   - doc.perDriverBreakdown: {driverId: {q,r1,r2,r3,total}}
          try {
            const agg = new Map();

            for (const sd of scoreDocs) {
              const perDriverBreakdown = sd.perDriverBreakdown;
              const perDriver = sd.perDriver;

              if (perDriverBreakdown && typeof perDriverBreakdown === "object") {
                Object.entries(perDriverBreakdown).forEach(([driverId, b]) => {
                  if (!driverId) return;
                  const cur = agg.get(driverId) || { driverId, q: 0, r1: 0, r2: 0, r3: 0, total: 0 };
                  const q = typeof b?.q === "number" ? b.q : typeof b?.qualifying === "number" ? b.qualifying : 0;
                  const r1 = typeof b?.r1 === "number" ? b.r1 : typeof b?.race1 === "number" ? b.race1 : 0;
                  const r2 = typeof b?.r2 === "number" ? b.r2 : typeof b?.race2 === "number" ? b.race2 : 0;
                  const r3 = typeof b?.r3 === "number" ? b.r3 : typeof b?.race3 === "number" ? b.race3 : 0;
                  const t = typeof b?.total === "number" ? b.total : typeof b === "number" ? b : q + r1 + r2 + r3;

                  cur.q += q;
                  cur.r1 += r1;
                  cur.r2 += r2;
                  cur.r3 += r3;
                  cur.total += t;
                  agg.set(driverId, cur);
                });
              } else if (perDriver && typeof perDriver === "object") {
                Object.entries(perDriver).forEach(([driverId, t]) => {
                  if (!driverId) return;
                  if (typeof t !== "number") return;
                  const cur = agg.get(driverId) || { driverId, q: undefined, r1: undefined, r2: undefined, r3: undefined, total: 0 };
                  cur.total += t;
                  agg.set(driverId, cur);
                });
              }
            }

            const rows = Array.from(agg.values())
              .map((r) => ({
                ...r,
                name: driverNameById[r.driverId] || r.driverId,
              }))
              .sort((a, b) => (b.total || 0) - (a.total || 0));

            if (driverScoresSlot) driverScoresSlot.innerHTML = renderDriverFantasyTable(rows);
          } catch (e) {
            console.warn("⚠️ Failed to build driver breakdown for", eventId, e);
            if (driverScoresSlot) driverScoresSlot.innerHTML = `<div class="note">No driver breakdown available yet.</div>`;
          }
        })
      );

      console.log("✅ Events loaded:", snap.size);
    } catch (err) {
      console.error("❌ loadResults failed:", err);
      el.innerHTML = `
        <div class="note warnNote">
          Failed to load events.<br>
          <span class="tiny muted">${escapeHtml(err?.message || err)}</span>
        </div>
      `;
    }
  }

  window.loadResults = loadResults;
})();