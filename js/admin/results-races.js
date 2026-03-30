 (function () {

 // ============================================================
  // SECTION 4B: RACE ENTRY UI (Race 1–3)
  // ============================================================
  function renderRaceForms(root) {
  const mount = root.querySelector("#admin-races-form");
  if (!mount) return;

  const eventId = root.__selectedEventId;
  const drivers = Array.isArray(root.__drivers) ? root.__drivers : [];

  if (!eventId) {
    mount.innerHTML = "";
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

  const N = drivers.length;
  const options = drivers.map(d => `<option value="${d.id}">${d.name}</option>`).join("");

  const raceCard = (raceKey, title) => `
    <div class="card" style="margin-top:10px;">
      <h2 style="margin:0 0 6px 0;">${title} (UI only)</h2>
      <div class="tiny muted" style="margin-bottom:10px;">
        Event ID: <span class="tiny">${eventId}</span><br>
        Enter finishing order. Saving comes next.
      </div>

      <div id="admin-${raceKey}-validation" class="note warnNote" hidden></div>

      <div class="tiny muted" style="margin:10px 0 6px 0;">Classified finishers only. Leave remaining positions blank if there were DNFs / DNS / DSQs.</div>
      <div id="admin-${raceKey}-grid" style="display:flex; flex-direction:column; gap:10px;">
        ${Array.from({ length: N }).map((_, i) => {
          const pos = i + 1;
          return `
            <div style="display:flex; gap:10px; align-items:center;">
              <div style="min-width:64px;"><strong>P${pos}</strong></div>
              <select data-${raceKey}-pos="${pos}" style="flex:1; padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);">
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

        <label class="tiny muted" style="display:block; margin-top:10px;">DNF</label>
        <select data-${raceKey}-dnf multiple size="6" style="width:100%; padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);">
          ${options}
        </select>

        <label class="tiny muted" style="display:block; margin-top:10px;">DNS</label>
        <select data-${raceKey}-dns multiple size="4" style="width:100%; padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);">
          ${options}
        </select>

        <label class="tiny muted" style="display:block; margin-top:10px;">DSQ</label>
        <select data-${raceKey}-dsq multiple size="4" style="width:100%; padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);">
          ${options}
        </select>
        <label class="tiny muted" style="display:block; margin-top:10px;">Fastest Lap awards (up to 3)</label>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <select data-${raceKey}-fl1 style="width:100%; padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);">
            <option value="">—</option>
            ${options}
          </select>
          <select data-${raceKey}-fl2 style="width:100%; padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);">
            <option value="">—</option>
            ${options}
          </select>
          <select data-${raceKey}-fl3 style="width:100%; padding:10px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.03); color:var(--text);">
            <option value="">—</option>
            ${options}
          </select>
        </div>
        <div class="tiny muted" style="margin-top:6px;">Use up to 3 fastest-lap awards. The same driver may be selected more than once if they qualify in multiple categories. Fastest Lap may be awarded to a classified finisher or a DNF, but not DNS / DSQ.</div>
      </div>

      <button type="button" id="admin-${raceKey}-save" class="tile" style="margin-top:12px;" disabled>
        ${(raceKey === "race1" || raceKey === "race2" || raceKey === "race3") ? `Save ${title}` : `Save ${title} (next step)`}
      </button>
    </div>
  `;

  mount.innerHTML = `
    ${raceCard("race1", "Race 1")}
    ${raceCard("race2", "Race 2")}
    ${raceCard("race3", "Race 3")}
  `;

  const wireValidation = (raceKey) => {
    const validationEl = mount.querySelector(`#admin-${raceKey}-validation`);
    const saveBtn = mount.querySelector(`#admin-${raceKey}-save`);

    const validate = () => {
      const finishSelects = Array.from(mount.querySelectorAll(`select[data-${raceKey}-pos]`));
      const dnfSel = mount.querySelector(`select[data-${raceKey}-dnf]`);
      const dnsSel = mount.querySelector(`select[data-${raceKey}-dns]`);
      const dsqSel = mount.querySelector(`select[data-${raceKey}-dsq]`);
      const fl1Sel = mount.querySelector(`select[data-${raceKey}-fl1]`);
      const fl2Sel = mount.querySelector(`select[data-${raceKey}-fl2]`);
      const fl3Sel = mount.querySelector(`select[data-${raceKey}-fl3]`);

      const finishers = finishSelects.map(s => s.value || null);
      const classified = finishers.filter(Boolean);
      const dnfIds = dnfSel ? Array.from(dnfSel.selectedOptions).map(o => o.value).filter(Boolean) : [];
      const dnsIds = dnsSel ? Array.from(dnsSel.selectedOptions).map(o => o.value).filter(Boolean) : [];
      const dsqIds = dsqSel ? Array.from(dsqSel.selectedOptions).map(o => o.value).filter(Boolean) : [];
      const fastestLapDriverIds = [
        fl1Sel?.value || "",
        fl2Sel?.value || "",
        fl3Sel?.value || "",
      ].filter(Boolean);

      const issues = [];

      // Classified order must be contiguous from the top with no gaps.
      let seenBlank = false;
      finishers.forEach((v, idx) => {
        if (!v) seenBlank = true;
        if (v && seenBlank) issues.push(`Classified finishers must be entered in order with no gaps before P${idx + 1}.`);
      });

      const allAssigned = [...classified, ...dnfIds, ...dnsIds, ...dsqIds];
      const dupes = allAssigned.filter((v, idx) => allAssigned.indexOf(v) !== idx);
      if (dupes.length > 0) issues.push("A driver can only appear once across classified / DNF / DNS / DSQ.");

      if (classified.length === 0) issues.push("Enter at least one classified finisher.");

      if (fastestLapDriverIds.length > 3) issues.push("Fastest Lap can have a maximum of 3 awards.");
      fastestLapDriverIds.forEach((driverId) => {
        const flAllowed = classified.includes(driverId) || dnfIds.includes(driverId);
        if (!flAllowed) issues.push("Fastest Lap must belong to a classified finisher or a DNF (not DNS / DSQ).");
      });

      const valid = issues.length === 0;

      if (validationEl) {
        if (valid) validationEl.hidden = true;
        else {
          validationEl.hidden = false;
          validationEl.innerHTML = `<strong>Fix this:</strong><br><span class="tiny muted">${issues.join("<br>")}</span>`;
        }
      }

      if (saveBtn) saveBtn.disabled = !valid;

      const draft = {
        positions: finishers,
        classified,
        status: {
          FIN: classified,
          DNF: dnfIds,
          DNS: dnsIds,
          DSQ: dsqIds,
        },
        fastestLapDriverIds,
      };

      if (raceKey === "race1") root.__draftRace1 = draft;
      if (raceKey === "race2") root.__draftRace2 = draft;
      if (raceKey === "race3") root.__draftRace3 = draft;
      renderResultsPreview(root);
    };

    mount.querySelectorAll(`select[data-${raceKey}-pos], select[data-${raceKey}-dnf], select[data-${raceKey}-dns], select[data-${raceKey}-dsq], select[data-${raceKey}-fl1], select[data-${raceKey}-fl2], select[data-${raceKey}-fl3]`).forEach(sel => {
      sel.addEventListener("change", validate);
    });

    validate();

    // H6.2: Save Race 1 only (Race 2/3 remain UI-only)
    if (raceKey === "race1" && saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const validationEl2 = mount.querySelector(`#admin-${raceKey}-validation`);

        // Guards
        if (!window.btccDb) {
          if (validationEl2) {
            validationEl2.hidden = false;
            validationEl2.innerHTML = `<strong>Save failed.</strong><br><span class="tiny muted">Database not ready.</span>`;
          }
          return;
        }

        const eid = root.__selectedEventId;
        if (!eid) return;

        // Enforce lock
        if (root.__eventMeta?.resultsLocked === true) {
          if (validationEl2) {
            validationEl2.hidden = false;
            validationEl2.innerHTML = `<strong>Locked:</strong><br><span class="tiny muted">Results are locked for this event.</span>`;
          }
          return;
        }

        // Read draft
        const draft = root.__draftRace1 && typeof root.__draftRace1 === "object"
          ? root.__draftRace1
          : { positions: [], classified: [], status: { FIN: [], DNF: [], DNS: [], DSQ: [] }, fastestLapDriverIds: [] };

        const classified = Array.isArray(draft.classified) ? draft.classified : [];
        const status = draft.status || { FIN: [], DNF: [], DNS: [], DSQ: [] };
        const fastestLapDriverIds = Array.isArray(draft.fastestLapDriverIds) ? draft.fastestLapDriverIds : [];

        if (!classified.length) {
          if (validationEl2) {
            validationEl2.hidden = false;
            validationEl2.innerHTML = `<strong>Fix this:</strong><br><span class="tiny muted">Please enter at least one classified finisher and resolve any validation issues.</span>`;
          }
          return;
        }

        try {
          saveBtn.disabled = true;
          saveBtn.textContent = "Saving…";

          const resultsRef = window.btccDb.collection("results").doc(eid);
          await resultsRef.set(
            {
              race1: classified,
              race1Positions: Array.isArray(draft.positions) ? draft.positions : [],
              race1Status: status,
              race1FastestLapDriverIds: fastestLapDriverIds,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          const user = firebase.auth().currentUser;
          const who = user?.email || "admin";

          await window.btccDb.collection("events").doc(eid).set(
            {
              resultsUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              resultsUpdatedBy: who,
            },
            { merge: true }
          );

          // Refresh saved results for preview panel
          await loadSelectedEventMetaAndResults(root);

          saveBtn.textContent = `Saved ${new Date().toLocaleString("en-GB")}`;
          console.log("✅ Race 1 saved:", eid, classified, status, fastestLapDriverIds);
        } catch (err) {
          console.error("❌ Save Race 1 failed:", err);
          if (validationEl2) {
            validationEl2.hidden = false;
            validationEl2.innerHTML = `<strong>Save failed.</strong><br><span class="tiny muted">${err?.message || err}</span>`;
          }
          saveBtn.textContent = "Save Race 1";
        } finally {
          saveBtn.disabled = false;
        }
      });
    }

    // H6.3: Save Race 2 (Race 3 remains UI-only)
    if (raceKey === "race2" && saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const validationEl2 = mount.querySelector(`#admin-${raceKey}-validation`);

        // Guards
        if (!window.btccDb) {
          if (validationEl2) {
            validationEl2.hidden = false;
            validationEl2.innerHTML = `<strong>Save failed.</strong><br><span class="tiny muted">Database not ready.</span>`;
          }
          return;
        }

        const eid = root.__selectedEventId;
        if (!eid) return;

        // Enforce lock
        if (root.__eventMeta?.resultsLocked === true) {
          if (validationEl2) {
            validationEl2.hidden = false;
            validationEl2.innerHTML = `<strong>Locked:</strong><br><span class="tiny muted">Results are locked for this event.</span>`;
          }
          return;
        }

        // Read draft
        const draft = root.__draftRace2 && typeof root.__draftRace2 === "object"
          ? root.__draftRace2
          : { positions: [], classified: [], status: { FIN: [], DNF: [], DNS: [], DSQ: [] }, fastestLapDriverIds: [] };

        const classified = Array.isArray(draft.classified) ? draft.classified : [];
        const status = draft.status || { FIN: [], DNF: [], DNS: [], DSQ: [] };
        const fastestLapDriverIds = Array.isArray(draft.fastestLapDriverIds) ? draft.fastestLapDriverIds : [];

        if (!classified.length) {
          if (validationEl2) {
            validationEl2.hidden = false;
            validationEl2.innerHTML = `<strong>Fix this:</strong><br><span class="tiny muted">Please enter at least one classified finisher and resolve any validation issues.</span>`;
          }
          return;
        }

        try {
          saveBtn.disabled = true;
          saveBtn.textContent = "Saving…";

          const resultsRef = window.btccDb.collection("results").doc(eid);
          await resultsRef.set(
            {
              race2: classified,
              race2Positions: Array.isArray(draft.positions) ? draft.positions : [],
              race2Status: status,
              race2FastestLapDriverIds: fastestLapDriverIds,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          const user = firebase.auth().currentUser;
          const who = user?.email || "admin";

          await window.btccDb.collection("events").doc(eid).set(
            {
              resultsUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              resultsUpdatedBy: who,
            },
            { merge: true }
          );

          // Refresh saved results for preview panel
          await loadSelectedEventMetaAndResults(root);

          saveBtn.textContent = `Saved ${new Date().toLocaleString("en-GB")}`;
          console.log("✅ Race 2 saved:", eid, classified, status, fastestLapDriverIds);
        } catch (err) {
          console.error("❌ Save Race 2 failed:", err);
          if (validationEl2) {
            validationEl2.hidden = false;
            validationEl2.innerHTML = `<strong>Save failed.</strong><br><span class="tiny muted">${err?.message || err}</span>`;
          }
          saveBtn.textContent = "Save Race 2";
        } finally {
          saveBtn.disabled = false;
        }
      });
    }
    // H6.4: Save Race 3
    if (raceKey === "race3" && saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const validationEl2 = mount.querySelector(`#admin-${raceKey}-validation`);

        // Guards
        if (!window.btccDb) {
          if (validationEl2) {
            validationEl2.hidden = false;
            validationEl2.innerHTML = `<strong>Save failed.</strong><br><span class="tiny muted">Database not ready.</span>`;
          }
          return;
        }

        const eid = root.__selectedEventId;
        if (!eid) return;

        // Enforce lock
        if (root.__eventMeta?.resultsLocked === true) {
          if (validationEl2) {
            validationEl2.hidden = false;
            validationEl2.innerHTML = `<strong>Locked:</strong><br><span class="tiny muted">Results are locked for this event.</span>`;
          }
          return;
        }

        // Read draft
        const draft = root.__draftRace3 && typeof root.__draftRace3 === "object"
          ? root.__draftRace3
          : { positions: [], classified: [], status: { FIN: [], DNF: [], DNS: [], DSQ: [] }, fastestLapDriverIds: [] };

        const classified = Array.isArray(draft.classified) ? draft.classified : [];
        const status = draft.status || { FIN: [], DNF: [], DNS: [], DSQ: [] };
        const fastestLapDriverIds = Array.isArray(draft.fastestLapDriverIds) ? draft.fastestLapDriverIds : [];

        if (!classified.length) {
          if (validationEl2) {
            validationEl2.hidden = false;
            validationEl2.innerHTML = `<strong>Fix this:</strong><br><span class="tiny muted">Please enter at least one classified finisher and resolve any validation issues.</span>`;
          }
          return;
        }

        try {
          saveBtn.disabled = true;
          saveBtn.textContent = "Saving…";

          const resultsRef = window.btccDb.collection("results").doc(eid);
          await resultsRef.set(
            {
              race3: classified,
              race3Positions: Array.isArray(draft.positions) ? draft.positions : [],
              race3Status: status,
              race3FastestLapDriverIds: fastestLapDriverIds,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          const user = firebase.auth().currentUser;
          const who = user?.email || "admin";

          await window.btccDb.collection("events").doc(eid).set(
            {
              resultsUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              resultsUpdatedBy: who,
            },
            { merge: true }
          );

          // Refresh saved results for preview panel
          await loadSelectedEventMetaAndResults(root);

          saveBtn.textContent = `Saved ${new Date().toLocaleString("en-GB")}`;
          console.log("✅ Race 3 saved:", eid, classified, status, fastestLapDriverIds);
        } catch (err) {
          console.error("❌ Save Race 3 failed:", err);
          if (validationEl2) {
            validationEl2.hidden = false;
            validationEl2.innerHTML = `<strong>Save failed.</strong><br><span class="tiny muted">${err?.message || err}</span>`;
          }
          saveBtn.textContent = "Save Race 3";
        } finally {
          saveBtn.disabled = false;
        }
      });
    }
  };

  wireValidation("race1");
  wireValidation("race2");
  wireValidation("race3");

  // H7.3 — disable race inputs if locked
  if (root.__eventMeta?.resultsLocked === true) {
    mount.querySelectorAll("select").forEach(s => s.disabled = true);
    mount.querySelectorAll("button[id$='-save']").forEach(b => b.disabled = true);
  }
}

window.renderRaceForms = renderRaceForms;

})();