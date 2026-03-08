(function () {

async function loadAdminEventPicker(root) {
    const wrap = root.querySelector("#admin-results-entry");
    if (!wrap) return;

    // Ensure Firestore is ready
    if (!window.btccDb) {
      wrap.innerHTML = `<div class="tiny muted">Waiting for database…</div>`;
      setTimeout(() => loadAdminEventPicker(root), 300);
      return;
    }

    wrap.innerHTML = `<div class="tiny muted">Loading events…</div>`;

    try {
      const snap = await window.btccDb.collection("events").orderBy("eventNo").get();

      if (snap.empty) {
        wrap.innerHTML = `<div class="note warnNote">No events found.</div>`;
        return;
      }

      const fmtDate = (v) => {
        if (v && typeof v.toDate === "function") return v.toDate().toLocaleDateString("en-GB");
        if (typeof v === "string" && v.length >= 10) {
          const d = new Date(v);
          if (!isNaN(d)) return d.toLocaleDateString("en-GB");
          return v;
        }
        return "—";
      };

      const rows = snap.docs.map((doc) => {
        const d = doc.data() || {};
        const from = fmtDate(d.dateFrom);
        const to = fmtDate(d.dateTo);
        const dates = from !== "—" && to !== "—" ? `${from}–${to}` : from;
        const rounds = d.roundFrom && d.roundTo ? `R${d.roundFrom}–${d.roundTo}` : "";
        const status = (d.status || "upcoming").toString();
        return {
          id: doc.id,
          eventNo: d.eventNo ?? "—",
          title: d.venue ?? d.name ?? "Unnamed",
          dates,
          rounds,
          status,
        };
      });

      wrap.innerHTML = `
        <div class="note" style="margin-top:10px;">
          <strong>Select event</strong>
          <div class="tiny muted" style="margin-top:6px;">Pick an event to start entering Qualifying and Race results (next steps).</div>
        </div>

        <ul class="list" id="admin-events-list" style="margin-top:10px;">
          ${rows
            .map(
              (e) => `
              <li class="eventItem" data-event-id="${e.id}">
                <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
                  <div>
                    <strong>Event ${e.eventNo}</strong> — ${e.title}<br>
                    <span class="tiny muted">${e.rounds} • ${e.dates} • ${e.status}</span>
                  </div>
                  <button type="button" class="tile tinyBtn" data-action="select-event">Select</button>
                </div>
              </li>
            `
            )
            .join("")}
        </ul>

        <div id="admin-selected-event" class="note" style="margin-top:10px;" hidden>
          <strong>Selected:</strong> <span id="admin-selected-event-label" class="tiny muted"></span>
        </div>
      `;

      const selectedBox = wrap.querySelector("#admin-selected-event");
      const selectedLabel = wrap.querySelector("#admin-selected-event-label");

      wrap.querySelectorAll("[data-action='select-event']").forEach((btn) => {
        btn.addEventListener("click", () => {
          const li = btn.closest("[data-event-id]");
          const eventId = li?.getAttribute("data-event-id");
          if (!eventId) return;

          const match = rows.find((r) => r.id === eventId);
          root.__selectedEventId = eventId;
          root.__draftQuali = null;
          root.__eventLocked = false;
          renderQualifyingForm(root);
          renderRaceForms(root);
          loadSelectedEventMetaAndResults(root);

          // Visual highlight
          wrap.querySelectorAll("[data-event-id]").forEach((x) => {
            x.style.outline = "none";
          });
          li.style.outline = "2px solid rgba(250, 204, 21, 0.45)";

          if (selectedBox && selectedLabel && match) {
            selectedBox.hidden = false;
            selectedLabel.textContent = `Event ${match.eventNo} — ${match.title}`;
          }

          console.log("✅ Admin selected event:", eventId);
        });
      });

      console.log("✅ Admin events loaded:", snap.size);
    } catch (err) {
      console.error("❌ loadAdminEventPicker failed:", err);
      wrap.innerHTML = `
        <div class="note warnNote">
          Failed to load events.<br>
          <span class="tiny muted">${err?.message || err}</span>
        </div>
      `;
    }
  }

  async function loadAdminDrivers(root) {
    const el = root.querySelector("#admin-drivers-status");
    if (!el) return;

    // Ensure Firestore is ready
    if (!window.btccDb) {
      el.textContent = "Drivers: Waiting for database…";
      setTimeout(() => loadAdminDrivers(root), 300);
      return;
    }

    el.textContent = "Drivers: Loading…";

    try {
      const snap = await window.btccDb.collection("drivers").orderBy("name").get();

      if (snap.empty) {
        el.textContent = "Drivers: none found";
        root.__drivers = [];
        return;
      }

      const list = snap.docs.map((doc) => {
        const d = doc.data() || {};
        return {
          id: doc.id,
          name: d.name ?? "Unnamed",
          price: Number(d.price ?? d.cost ?? 0),
        };
      });

      root.__drivers = list;
      // Re-render preview now that we can map driverIds -> names
      renderResultsPreview(root);
      el.textContent = `Drivers loaded: ${list.length}`;
      console.log("✅ Admin drivers loaded:", list.length);
    } catch (err) {
      console.error("❌ loadAdminDrivers failed:", err);
      el.textContent = `Drivers: failed to load (${err?.message || err})`;
      root.__drivers = [];
    }
  }

  window.loadAdminEventPicker = loadAdminEventPicker;
  window.loadAdminDrivers = loadAdminDrivers;
})();