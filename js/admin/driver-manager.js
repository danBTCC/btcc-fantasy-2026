(function () {
  // ============================================================
  // ADMIN: DRIVER MANAGER (Create / Update drivers)
  // ============================================================
  function slugifyDriverId(name) {
    return (name || "")
      .toString()
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function parseDriverCategories(raw) {
    return (raw || "")
      .split(",")
      .map((x) => x.trim().toUpperCase())
      .filter(Boolean)
      .filter((x, i, arr) => arr.indexOf(x) === i);
  }

  function formatMoney2(v) {
    const n = Number(v || 0);
    return `£${n.toFixed(2)}`;
  }

  async function loadAdminDriverList(root) {
    const mount = root.querySelector("#admin-driver-list");
    if (!mount) return;

    if (!window.btccDb) {
      mount.innerHTML = `<div class="tiny muted">Waiting for database…</div>`;
      return;
    }

    mount.innerHTML = `<div class="tiny muted">Loading drivers…</div>`;

    try {
      const snap = await window.btccDb.collection("drivers").orderBy("name").get();

      if (snap.empty) {
        mount.innerHTML = `<div class="tiny muted">No drivers yet.</div>`;
        return;
      }

      const rows = snap.docs.map((doc) => {
        const d = doc.data() || {};
        const cats = Array.isArray(d.categories)
          ? d.categories.join(", ")
          : (d.category || "—");
        const active = d.active === false ? "No" : "Yes";
        const price = Number(d.price ?? d.value ?? d.cost ?? 0);

        return `
          <tr>
            <td style="padding:8px; border-bottom:1px solid var(--border);">${d.name || doc.id}</td>
            <td style="padding:8px; border-bottom:1px solid var(--border); text-align:right;">${formatMoney2(price)}</td>
            <td style="padding:8px; border-bottom:1px solid var(--border);">${cats || "—"}</td>
            <td style="padding:8px; border-bottom:1px solid var(--border);">${active}</td>
            <td style="padding:8px; border-bottom:1px solid var(--border);" class="tiny muted">${doc.id}</td>
            <td style="padding:8px; border-bottom:1px solid var(--border); text-align:right; display:flex; gap:8px; justify-content:flex-end;">
              <button type="button" class="tile tinyBtn" data-edit-driver="${doc.id}" style="padding:6px 10px;">Edit</button>
              <button type="button" class="tile tinyBtn" data-delete-driver="${doc.id}" style="padding:6px 10px;">Delete</button>
            </td>
          </tr>
        `;
      });

      mount.innerHTML = `
        <div class="tiny muted" style="margin-bottom:8px;">${snap.size} driver(s)</div>
        <div style="overflow:auto; border:1px solid var(--border); border-radius:12px;">
          <table style="width:100%; border-collapse:collapse;">
            <thead>
              <tr>
                <th style="text-align:left; padding:8px;">Driver</th>
                <th style="text-align:right; padding:8px;">Value</th>
                <th style="text-align:left; padding:8px;">Category</th>
                <th style="text-align:left; padding:8px;">Active</th>
                <th style="text-align:left; padding:8px;">Doc ID</th>
                <th style="text-align:right; padding:8px;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${rows.join("")}
            </tbody>
          </table>
        </div>
      `;

      mount.querySelectorAll("[data-edit-driver]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const driverId = btn.getAttribute("data-edit-driver");
          if (!driverId || !window.btccDb) return;

          try {
            const snap = await window.btccDb.collection("drivers").doc(driverId).get();
            if (!snap.exists) {
              alert("Driver not found");
              return;
            }

            const d = snap.data() || {};
            const categories = Array.isArray(d.categories)
              ? d.categories.join(", ")
              : (d.category || "");
            const price = Number(d.price ?? d.value ?? d.cost ?? 0);

            const idInput = root.querySelector("#admin-driver-id");
            const nameInput = root.querySelector("#admin-driver-name");
            const valueInput = root.querySelector("#admin-driver-value");
            const catInput = root.querySelector("#admin-driver-category");
            const activeInput = root.querySelector("#admin-driver-active");
            const msg = root.querySelector("#admin-driver-msg");
            const saveBtn = root.querySelector("#admin-driver-save");

            if (idInput) idInput.value = driverId;
            if (nameInput) nameInput.value = d.name || "";
            if (valueInput) valueInput.value = price.toFixed(2);
            if (catInput) catInput.value = categories;
            if (activeInput) activeInput.checked = d.active !== false;
            if (saveBtn) saveBtn.textContent = "Update driver";
            if (msg) msg.textContent = `Editing driver: ${d.name || driverId}`;
          } catch (err) {
            console.error("❌ Load driver for edit failed:", err);
            alert(err?.message || "Failed to load driver for edit");
          }
        });
      });

      mount.querySelectorAll("[data-delete-driver]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const driverId = btn.getAttribute("data-delete-driver");
          if (!driverId || !window.btccDb) return;

          const ok = window.confirm(`Delete driver "${driverId}"? This cannot be undone.`);
          if (!ok) return;

          try {
            btn.disabled = true;
            btn.textContent = "Deleting…";

            await window.btccDb.collection("drivers").doc(driverId).delete();

            console.log("✅ Driver deleted:", driverId);
            await loadAdminDriverList(root);
            await loadAdminDrivers(root);
          } catch (err) {
            console.error("❌ Delete driver failed:", err);
            alert(err?.message || "Failed to delete driver");
            btn.disabled = false;
            btn.textContent = "Delete";
          }
        });
      });
    } catch (err) {
      console.error("❌ loadAdminDriverList failed:", err);
      mount.innerHTML = `<div class="tiny muted">Failed to load drivers: ${err?.message || err}</div>`;
    }
  }

  function setupAdminDriverManager(root) {
    const btn = root.querySelector("#admin-driver-save");
    if (!btn) return;

    const msg = root.querySelector("#admin-driver-msg");
    const reloadBtn = root.querySelector("#admin-driver-reload");

    const setMsg = (t) => {
      if (msg) msg.textContent = t;
    };

    btn.addEventListener("click", async () => {
      const idInput = root.querySelector("#admin-driver-id");
      const nameInput = root.querySelector("#admin-driver-name");
      const valueInput = root.querySelector("#admin-driver-value");
      const catInput = root.querySelector("#admin-driver-category");
      const activeInput = root.querySelector("#admin-driver-active");

      const name = nameInput?.value?.trim() || "";
      const driverId = (idInput?.value?.trim() || slugifyDriverId(name)).trim();
      const price = Number(valueInput?.value || 0);
      const categories = parseDriverCategories(catInput?.value || "");
      const active = !!activeInput?.checked;

      if (!driverId || !name) {
        setMsg("Driver name is required.");
        return;
      }

      if (!window.btccDb) {
        setMsg("Database not ready.");
        return;
      }

      try {
        btn.disabled = true;
        btn.textContent = "Saving…";
        setMsg("");

        await window.btccDb.collection("drivers").doc(driverId).set(
          {
            name,
            price,
            value: price,
            categories,
            active,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        if (idInput && !idInput.value.trim()) idInput.value = driverId;
        btn.textContent = "Update driver";
        setMsg(`Saved driver: ${name}`);
        await loadAdminDriverList(root);
        await loadAdminDrivers(root);
      } catch (err) {
        console.error("❌ Save driver failed:", err);
        setMsg(err?.message || "Failed to save driver");
        btn.textContent = root.querySelector("#admin-driver-id")?.value?.trim() ? "Update driver" : "Save driver";
      } finally {
        btn.disabled = false;
        const idInputNow = root.querySelector("#admin-driver-id");
        btn.textContent = idInputNow?.value?.trim() ? "Update driver" : "Save driver";
      }
    });

    reloadBtn?.addEventListener("click", async () => {
      reloadBtn.disabled = true;
      try {
        await loadAdminDriverList(root);
      } finally {
        reloadBtn.disabled = false;
      }
    });

    loadAdminDriverList(root);
  }

  window.loadAdminDriverList = loadAdminDriverList;
  window.setupAdminDriverManager = setupAdminDriverManager;
})();