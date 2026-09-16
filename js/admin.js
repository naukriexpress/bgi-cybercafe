/* ============================================================
   admin.js — admin panel behaviour
   ============================================================ */

(async function () {
  let db = null;

  /* ---------- Login gate ---------- */
  const loginScreen = document.getElementById("loginScreen");
  const dashboard = document.getElementById("dashboard");
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");

  if (await ccSession()) {
    await showDashboard();
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.style.display = "none";
    const email = document.getElementById("loginEmail").value.trim();
    const entered = document.getElementById("loginPassword").value;
    const { error } = await ccLogin(email, entered);
    if (!error) {
      try { await showDashboard(); }
      catch (loadError) { loginError.textContent = loadError.message; loginError.style.display = "block"; }
    } else {
      loginError.textContent = error.message || "Login failed.";
      loginError.style.display = "block";
    }
  });

  async function showDashboard() {
    db = await ccLoadDB();
    loginScreen.style.display = "none";
    dashboard.style.display = "grid";
    renderAll();
  }

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await ccLogout();
    location.reload();
  });

  /* ---------- Sidebar navigation ---------- */
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach(btn => {
    btn.addEventListener("click", () => {
      navItems.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".panel").forEach(p => p.style.display = "none");
      document.getElementById(btn.dataset.panel).style.display = "block";
    });
  });

  /* ---------- Render everything from db ---------- */
  function renderAll() {
    renderSettingsForm();
    renderTickerForm();
    renderDocPicker();
    renderServiceList();
    renderMasterDocList();
  }

  /* ---------- General settings ---------- */
  function renderSettingsForm() {
    document.getElementById("setSiteName").value = db.settings.siteName;
    document.getElementById("setTagline").value = db.settings.tagline;
    document.getElementById("setWhatsapp").value = db.settings.whatsappNumber;
    document.getElementById("setAddress").value = db.settings.address;
    document.getElementById("setHours").value = db.settings.hours;
  }

  document.getElementById("saveSettingsBtn").addEventListener("click", () => {
    db.settings.siteName = document.getElementById("setSiteName").value.trim() || db.settings.siteName;
    db.settings.tagline = document.getElementById("setTagline").value.trim();
    db.settings.whatsappNumber = document.getElementById("setWhatsapp").value.replace(/[^0-9]/g, "");
    db.settings.address = document.getElementById("setAddress").value.trim();
    db.settings.hours = document.getElementById("setHours").value.trim();
    persist();
    flash("settingsSaveMsg", "Saved ✓");
  });

  /* ---------- Ticker ---------- */
  function renderTickerForm() {
    document.getElementById("setTicker").value = db.settings.ticker;
  }

  document.getElementById("saveTickerBtn").addEventListener("click", () => {
    db.settings.ticker = document.getElementById("setTicker").value.trim();
    persist();
    flash("tickerSaveMsg", "Saved ✓");
  });

  /* ---------- Services: document picker inside editor ---------- */
  let selectedDocs = new Set();

  function renderDocPicker() {
    const wrap = document.getElementById("docPicker");
    wrap.innerHTML = db.masterDocuments.map(doc => `
      <label>
        <input type="checkbox" value="${escapeAttr(doc)}" ${selectedDocs.has(doc) ? "checked" : ""} />
        ${escapeHtml(doc)}
      </label>
    `).join("");
    wrap.querySelectorAll("input[type=checkbox]").forEach(cb => {
      cb.addEventListener("change", () => {
        if (cb.checked) selectedDocs.add(cb.value); else selectedDocs.delete(cb.value);
      });
    });
  }

  document.getElementById("addCustomDocBtn").addEventListener("click", () => {
    const input = document.getElementById("customDocInput");
    const val = input.value.trim();
    if (!val) return;
    if (!db.masterDocuments.includes(val)) db.masterDocuments.push(val);
    selectedDocs.add(val);
    input.value = "";
    persist();
    renderDocPicker();
    renderMasterDocList();
  });

  /* ---------- Services: editor form ---------- */
  const editorFields = {
    id: document.getElementById("editServiceId"),
    icon: document.getElementById("svcIcon"),
    title: document.getElementById("svcTitle"),
    tagline: document.getElementById("svcTagline"),
    desc: document.getElementById("svcDesc"),
    youtube: document.getElementById("svcYoutube")
  };

  function clearEditor() {
    editorFields.id.value = "";
    editorFields.icon.value = "";
    editorFields.title.value = "";
    editorFields.tagline.value = "";
    editorFields.desc.value = "";
    editorFields.youtube.value = "";
    selectedDocs = new Set();
    renderDocPicker();
  }

  document.getElementById("clearServiceBtn").addEventListener("click", clearEditor);

  function loadServiceIntoEditor(svc) {
    editorFields.id.value = svc.id;
    editorFields.icon.value = svc.icon || "";
    editorFields.title.value = svc.title || "";
    editorFields.tagline.value = svc.tagline || "";
    editorFields.desc.value = svc.description || "";
    editorFields.youtube.value = svc.youtube || "";
    selectedDocs = new Set(svc.documents || []);
    renderDocPicker();
    document.getElementById("serviceEditor").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  document.getElementById("saveServiceBtn").addEventListener("click", () => {
    const title = editorFields.title.value.trim();
    if (!title) { flash("serviceSaveMsg", "Title is required", true); return; }

    const id = editorFields.id.value || ccUid("svc");
    const record = {
      id,
      icon: editorFields.icon.value.trim() || "📄",
      title,
      tagline: editorFields.tagline.value.trim(),
      description: editorFields.desc.value.trim(),
      youtube: editorFields.youtube.value.trim(),
      documents: Array.from(selectedDocs)
    };

    const idx = db.services.findIndex(s => s.id === id);
    if (idx >= 0) db.services[idx] = record; else db.services.push(record);

    persist();
    flash("serviceSaveMsg", "Service saved ✓");
    clearEditor();
    renderServiceList();
  });

  function renderServiceList() {
    const wrap = document.getElementById("adminServiceList");
    if (db.services.length === 0) {
      wrap.innerHTML = `<p class="panel-sub">No services yet — add your first one above.</p>`;
      return;
    }
    wrap.innerHTML = db.services.map(svc => `
      <div class="admin-service-row">
        <div class="row-icon">${escapeHtml(svc.icon || "📄")}</div>
        <div class="row-info">
          <div class="row-title">${escapeHtml(svc.title)}</div>
          <div class="row-meta">${(svc.documents || []).length} document(s) ${svc.youtube ? "· has video" : ""}</div>
        </div>
        <div class="row-actions">
          <button type="button" data-edit="${svc.id}">Edit</button>
          <button type="button" class="danger" data-delete="${svc.id}">Delete</button>
        </div>
      </div>
    `).join("");

    wrap.querySelectorAll("[data-edit]").forEach(btn => {
      btn.addEventListener("click", () => {
        const svc = db.services.find(s => s.id === btn.dataset.edit);
        if (svc) loadServiceIntoEditor(svc);
      });
    });
    wrap.querySelectorAll("[data-delete]").forEach(btn => {
      btn.addEventListener("click", () => {
        const svc = db.services.find(s => s.id === btn.dataset.delete);
        if (svc && confirm(`Delete "${svc.title}"? This cannot be undone.`)) {
          db.services = db.services.filter(s => s.id !== btn.dataset.delete);
          persist();
          renderServiceList();
        }
      });
    });
  }

  /* ---------- Master documents panel ---------- */
  function renderMasterDocList() {
    const wrap = document.getElementById("masterDocList");
    wrap.innerHTML = db.masterDocuments.map(doc => `
      <div class="master-doc-chip">
        ${escapeHtml(doc)}
        <button type="button" data-remove="${escapeAttr(doc)}" title="Remove">✕</button>
      </div>
    `).join("");
    wrap.querySelectorAll("[data-remove]").forEach(btn => {
      btn.addEventListener("click", () => {
        const doc = btn.dataset.remove;
        db.masterDocuments = db.masterDocuments.filter(d => d !== doc);
        persist();
        renderMasterDocList();
        renderDocPicker();
      });
    });
  }

  document.getElementById("addMasterDocBtn").addEventListener("click", () => {
    const input = document.getElementById("newMasterDoc");
    const val = input.value.trim();
    if (!val || db.masterDocuments.includes(val)) return;
    db.masterDocuments.push(val);
    input.value = "";
    persist();
    renderMasterDocList();
    renderDocPicker();
  });

  /* ---------- Security ---------- */
  document.getElementById("changePasswordBtn").addEventListener("click", async () => {
    const next = document.getElementById("newPassword").value;
    if (!next || next.length < 8) {
      flash("passwordSaveMsg", "Password must be at least 8 characters", true);
      return;
    }
    const { error } = await ccChangePassword(next);
    if (error) { flash("passwordSaveMsg", error.message, true); return; }
    document.getElementById("newPassword").value = "";
    flash("passwordSaveMsg", "Password updated ✓");
  });

  document.getElementById("resetAllBtn").addEventListener("click", () => {
    if (confirm("This will erase all your changes and restore defaults. Continue?")) {
      alert("Defaults can be restored by running supabase/setup.sql again in the Supabase SQL Editor.");
    }
  });

  /* ---------- Helpers ---------- */
  async function persist() {
    try { await ccSaveDB(db); }
    catch (error) { alert("Save failed: " + error.message); }
  }

  function flash(id, msg, isError) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.style.color = isError ? "#B3261E" : "#1A7A3E";
    setTimeout(() => { el.textContent = ""; }, 2500);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) { return escapeHtml(str); }
})();
