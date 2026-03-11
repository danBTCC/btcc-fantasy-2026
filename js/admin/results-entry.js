(function () {
// ============================================================
  // SECTION 4A: QUALIFYING ENTRY UI
  // ============================================================
  function renderQualifyingForm(root) {
    const mount = root.querySelector("#admin-results-form");
    if (!mount) return;

    const eventId = root.__selectedEventId;
    const drivers = Array.isArray(root.__drivers) ? root.__drivers : [];

    if (!eventId) {
      mount.innerHTML = `
        <div class="note" style="margin-top:10px;">
          <strong>Qualifying</strong><br>
          <span class="tiny muted">Select an event above to start entering qualifying positions.</span>
        </div>
      `;
      return;
    }

    if (drivers.length === 0) {
      mount.innerHTML = `
        <div class="note warnNote" style="margin-top:10px;">
          Drivers not loaded yet.
        </div>
      `;
      return;
    }

    // For v1 UI, we enter positions for all drivers in the current test set.
    const N = drivers.length;

    const options = drivers
      .map((d) => `<option value="${d.id}">${d.name}</option>`)
      .join("");

    mount.innerHTML = `
      <div class="card" style="margin-top:10px;">
        <h2 style="margin:0 0 6px 0;">Qualifying</h2>
        <div class="tiny muted" style="margin-bottom:10px;">
          Event ID: <span class="tiny">${eventId}</span><br>
          Enter finishing order. No saving yet (next step).
        </div>

        <div id="admin-quali-validation" class="note warnNote" hidden></div>

        <div class="tiny muted" style="margin:10px 0 6px 0;">Classified qualifiers only. Leave remaining positions blank if there were non-classified drivers or exclusions.</div>
        <div id="admin-quali-grid" style="display:flex; flex-direction:column; gap:10px;">
          ${Array.from({ length: N }).map((_, i) => {
            const pos = i + 1;
            return `
              <div style="display:flex; gap:10px; align-items:center;">
                <div style="min-width:64px;"><strong>P${pos}</strong></div>
                <select data-quali-pos="${pos}" style="flex:1; padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);">
                  <option value="">—</option>
                  ${options}
                </select>
              </div>
            `;
          }).join("")}
        </div>

        <div class="note" style="margin-top:10px;">
          <strong>Non-classified / special statuses</strong>
          <div class="tiny muted" style="margin-top:6px;">Use Ctrl/Cmd-click to select multiple drivers where needed.</div>

          <label class="tiny muted" style="display:block; margin-top:10px;">DNF / No time</label>
          <select data-quali-dnf multiple size="6" style="width:100%; padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);">
            ${options}
          </select>

          <label class="tiny muted" style="display:block; margin-top:10px;">DNS</label>
          <select data-quali-dns multiple size="4" style="width:100%; padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);">
            ${options}
          </select>

          <label class="tiny muted" style="display:block; margin-top:10px;">DSQ / Excluded</label>
          <select data-quali-dsq multiple size="4" style="width:100%; padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);">
            ${options}
          </select>
        </div>

        <button type="button" id="admin-quali-preview" class="tile" style="margin-top:12px;" disabled>
          Save qualifying
        </button>
      </div>
    `;

    const validationEl = mount.querySelector("#admin-quali-validation");
    const previewBtn = mount.querySelector("#admin-quali-preview");
    const btn = previewBtn;

    const validate = () => {
      const selects = Array.from(mount.querySelectorAll("select[data-quali-pos]"));
      const dnfSel = mount.querySelector("select[data-quali-dnf]");
      const dnsSel = mount.querySelector("select[data-quali-dns]");
      const dsqSel = mount.querySelector("select[data-quali-dsq]");

      const positions = selects.map((s) => s.value || null);
      const classified = positions.filter(Boolean);
      const dnfIds = dnfSel ? Array.from(dnfSel.selectedOptions).map(o => o.value).filter(Boolean) : [];
      const dnsIds = dnsSel ? Array.from(dnsSel.selectedOptions).map(o => o.value).filter(Boolean) : [];
      const dsqIds = dsqSel ? Array.from(dsqSel.selectedOptions).map(o => o.value).filter(Boolean) : [];

      const issues = [];

      let seenBlank = false;
      positions.forEach((v, idx) => {
        if (!v) seenBlank = true;
        if (v && seenBlank) issues.push(`Classified qualifiers must be entered in order with no gaps before P${idx + 1}.`);
      });

      const allAssigned = [...classified, ...dnfIds, ...dnsIds, ...dsqIds];
      const dupes = allAssigned.filter((v, idx) => allAssigned.indexOf(v) !== idx);
      if (dupes.length > 0) issues.push("A driver can only appear once across classified / DNF / DNS / DSQ.");

      if (classified.length === 0) issues.push("Enter at least one classified qualifier.");

      const valid = issues.length === 0;

      if (validationEl) {
        if (valid) {
          validationEl.hidden = true;
        } else {
          validationEl.hidden = false;
          validationEl.innerHTML = `<strong>Fix this:</strong><br><span class="tiny muted">${issues.join("<br>")}</span>`;
        }
      }

      if (previewBtn) previewBtn.disabled = !valid;

      root.__draftQuali = {
        positions,
        classified,
        status: {
          FIN: classified,
          DNF: dnfIds,
          DNS: dnsIds,
          DSQ: dsqIds,
        },
      };
      renderResultsPreview(root);
    };

    mount.querySelectorAll("select[data-quali-pos], select[data-quali-dnf], select[data-quali-dns], select[data-quali-dsq]").forEach((sel) => {
      sel.addEventListener("change", validate);
    });

    // Initial validation state
    validate();

    // H7.3 — disable qualifying inputs if locked
if (root.__eventMeta?.resultsLocked === true) {
  mount.querySelectorAll("select").forEach(s => s.disabled = true);
  const saveBtn = mount.querySelector("#admin-quali-preview");
  if (saveBtn) saveBtn.disabled = true;
}

    btn?.addEventListener("click", async () => {
      // Guard
      if (!window.btccDb) {
        if (validationEl) {
          validationEl.hidden = false;
          validationEl.innerHTML = `<strong>Save failed.</strong><br><span class="tiny muted">Database not ready.</span>`;
        }
        return;
      }

      const eventId2 = root.__selectedEventId;
      if (!eventId2) return;

      // Ensure draft exists and is valid
      const draft = root.__draftQuali && typeof root.__draftQuali === "object"
        ? root.__draftQuali
        : { positions: [], classified: [], status: { FIN: [], DNF: [], DNS: [], DSQ: [] } };
      const classified = Array.isArray(draft.classified) ? draft.classified : [];
      const status = draft.status || { FIN: [], DNF: [], DNS: [], DSQ: [] };
      if (!classified.length) {
        if (validationEl) {
          validationEl.hidden = false;
          validationEl.innerHTML = `<strong>Fix this:</strong><br><span class="tiny muted">Please enter at least one classified qualifier and resolve any validation issues.</span>`;
        }
        return;
      }

      // Lock check (optional in UI; enforce later)
      if (root.__eventLocked === true) {
        if (validationEl) {
          validationEl.hidden = false;
          validationEl.innerHTML = `<strong>Locked:</strong><br><span class="tiny muted">Results are locked for this event.</span>`;
        }
        return;
      }

      try {
        btn.disabled = true;
        btn.textContent = "Saving…";

        const resultsRef = window.btccDb.collection("results").doc(eventId2);
        await resultsRef.set(
          {
            qualifying: classified,
            qualifyingPositions: Array.isArray(draft.positions) ? draft.positions : [],
            qualifyingStatus: status,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        const user = firebase.auth().currentUser;
        const who = user?.email || "admin";

        await window.btccDb.collection("events").doc(eventId2).set(
          {
            resultsUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            resultsUpdatedBy: who,
          },
          { merge: true }
        );

        btn.textContent = `Saved ${new Date().toLocaleString("en-GB")}`;
        console.log("✅ Qualifying saved:", eventId2, classified, status);
      } catch (err) {
        console.error("❌ Save qualifying failed:", err);
        if (validationEl) {
          validationEl.hidden = false;
          validationEl.innerHTML = `<strong>Save failed.</strong><br><span class="tiny muted">${err?.message || err}</span>`;
        }
        btn.textContent = "Save qualifying";
      } finally {
        btn.disabled = false;
      }
    });
  }

window.renderQualifyingForm = renderQualifyingForm;

})();