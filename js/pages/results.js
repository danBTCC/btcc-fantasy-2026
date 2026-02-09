// js/pages/results.js
// Exposes: window.loadResults()

(function () {
  async function loadResults() {
    const el = document.getElementById("events-list");
    if (!el) return;

    el.textContent = "Loading…";

    try {
      if (!window.btccDb) throw new Error("btccDb not available");

      const snap = await window.btccDb
        .collection("events")
        .orderBy("eventNo")
        .get();

      if (snap.empty) {
        el.textContent = "No data yet";
        return;
      }

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

      el.innerHTML = `
        <ul class="list">
          ${snap.docs
            .map((doc) => {
              const d = doc.data();
              const from = fmtDate(d.dateFrom);
              const to = fmtDate(d.dateTo);
              const dates =
                from !== "—" && to !== "—"
                  ? `${from}–${to}`
                  : from !== "—"
                  ? from
                  : "—";
              const status = (d.status || "upcoming").toString();
              const rounds =
                d.roundFrom && d.roundTo ? `R${d.roundFrom}–${d.roundTo}` : "";

              return `
                <li class="eventItem">
                  <div class="eventHeader" data-toggle="event-details">
                    <strong>Event ${d.eventNo ?? "—"}</strong> — ${
                d.venue ?? d.name ?? "Unnamed"
              }<br>
                    <span class="tiny muted">${rounds} • ${dates} • ${status}</span>
                    <div class="tiny muted">▾ Details</div>
                  </div>

                  <div class="eventDetails" hidden>
                    <ul class="list tiny">
                      <li>Qualifying: not available</li>
                      <li>Race 1: not available</li>
                      <li>Race 2: not available</li>
                      <li>Race 3: not available</li>
                    </ul>
                  </div>
                </li>
              `;
            })
            .join("")}
        </ul>
      `;

      // Toggle event details (UI-only)
      el.querySelectorAll("[data-toggle='event-details']").forEach((header) => {
        header.addEventListener("click", () => {
          const details = header.parentElement.querySelector(".eventDetails");
          if (details) details.hidden = !details.hidden;
        });
      });

      console.log("✅ Events loaded:", snap.size);
    } catch (err) {
      console.error("❌ loadResults failed:", err);
      el.innerHTML = `
        <div class="note warnNote">
          Failed to load events.<br>
          <span class="tiny muted">${err?.message || err}</span>
        </div>
      `;
    }
  }

  window.loadResults = loadResults;
})();