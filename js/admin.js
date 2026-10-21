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
    try {
      await showDashboard();
    } catch (_) {
      await ccLogout();
      loginError.textContent = "This account is not authorized for the admin panel. Sign in with the admin account.";
      loginError.style.display = "block";
    }
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.style.display = "none";
    const email = document.getElementById("loginEmail").value.trim();
    const entered = document.getElementById("loginPassword").value;
    try {
      const { error } = await ccLogin(email, entered);
      if (error) throw error;
      await showDashboard();
    } catch (_) {
      document.getElementById("loginPassword").value = "";
      loginError.textContent = "Unable to sign in. Check your email and password, then try again.";
      loginError.style.display = "block";
    }
  });

  async function showDashboard() {
    if (!await ccIsAdmin()) {
      await ccLogout();
      throw new Error("Admin access required");
    }
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
    renderNewsList();
    renderMasterDocList();
  }

  /* ---------- General settings ---------- */
  function renderSettingsForm() {
    document.getElementById("setSiteName").value = db.settings.siteName;
    document.getElementById("setTagline").value = db.settings.tagline;
    document.getElementById("setWhatsapp").value = db.settings.whatsappNumber;
    document.getElementById("setAddress").value = db.settings.address;
    document.getElementById("setHours").value = db.settings.hours;
    document.getElementById("setJobsUrl").value = db.settings.jobsUrl || "https://www.naukriexpress.space/";
  }

  document.getElementById("saveSettingsBtn").addEventListener("click", async () => {
    const jobsUrl = document.getElementById("setJobsUrl").value.trim();
    if (!/^https:\/\/[^\s]+$/i.test(jobsUrl)) { flash("settingsSaveMsg", "Enter a full HTTPS jobs link", true); return; }
    db.settings.siteName = document.getElementById("setSiteName").value.trim() || db.settings.siteName;
    db.settings.tagline = document.getElementById("setTagline").value.trim();
    db.settings.whatsappNumber = document.getElementById("setWhatsapp").value.replace(/[^0-9]/g, "");
    db.settings.address = document.getElementById("setAddress").value.trim();
    db.settings.hours = document.getElementById("setHours").value.trim();
    db.settings.jobsUrl = jobsUrl;
    if (await persist()) flash("settingsSaveMsg", "Saved ✓");
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
    // Show all master documents plus names currently typed in the linked detail-button list.
    const allDocs = [...new Set([...(db.masterDocuments || []), ...Array.from(selectedDocs), ...((detailState && detailState.documents) || []).filter(Boolean)])];
    wrap.innerHTML = allDocs.map(doc => `
      <label>
        <input type="checkbox" value="${escapeAttr(doc)}" ${selectedDocs.has(doc) ? "checked" : ""} />
        ${escapeHtml(doc)}
      </label>
    `).join("");
    wrap.querySelectorAll("input[type=checkbox]").forEach(cb => {
      cb.addEventListener("change", () => {
        syncDetailStateFromDOM();
        if (cb.checked) selectedDocs.add(cb.value); else selectedDocs.delete(cb.value);
        detailState.documents = Array.from(selectedDocs);
        renderAllDetailRows();
        renderDocPicker();
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

  /* ---------- Dynamic service detail content editor ---------- */
  let detailState = { documents: [], requiredDocuments: [], guidelines: [], points: [], notes: "", extraTitle: "", extraSections: [] };
  const detailDefaults = () => ({ documents: [], requiredDocuments: [], guidelines: [], points: [], notes: "", extraTitle: "", extraSections: [] });
  const rowInput = (value, placeholder, attr, multiline = false) => multiline
    ? '<textarea rows="2" data-detail-field="' + attr + '" placeholder="' + placeholder + '">' + escapeHtml(value || "") + '</textarea>'
    : '<input type="text" data-detail-field="' + attr + '" value="' + escapeAttr(value || "") + '" placeholder="' + placeholder + '" />';
  function renderDetailRows(containerId, items, kind) {
    const wrap = document.getElementById(containerId);
    if (!wrap) return;
    if (!items.length) { wrap.innerHTML = '<p class="panel-sub">No items added yet.</p>'; return; }
    wrap.innerHTML = items.map((item, index) => {
      const objectItem = item && typeof item === "object";
      const title = objectItem ? item.title : item;
      const description = objectItem ? item.description : "";
      return '<div class="detail-edit-row detail-edit-row-' + kind + '" data-detail-row="' + kind + '">' +
        (kind === "documents" || kind === "guidelines"
          ? rowInput(title, kind === "documents" ? "Button label, e.g. Aadhaar Card" : "Guideline text", kind + "-title-" + index)
          : rowInput(title, "Title", kind + "-title-" + index)) +
        ((kind === "requiredDocuments" || kind === "points" || kind === "extraSections")
          ? rowInput(description, "Short description", kind + "-description-" + index, true) : "") +
        '<button type="button" class="btn btn-outline detail-remove" data-detail-remove="' + kind + '" data-index="' + index + '">Remove</button></div>';
    }).join("");
    wrap.querySelectorAll("[data-detail-remove]").forEach(button => button.addEventListener("click", () => {
      const kindName = button.dataset.detailRemove;
      const idx = Number(button.dataset.index);
      syncDetailStateFromDOM();
      const key = kindName === "requiredDocuments" ? "requiredDocuments" : kindName;
      detailState[key].splice(idx, 1);
      renderAllDetailRows();
    }));
  }
  function renderAllDetailRows() {
    renderDetailRows("detailDocRows", detailState.documents, "documents");
    renderDetailRows("detailRequiredRows", detailState.requiredDocuments, "requiredDocuments");
    renderDetailRows("detailGuidelineRows", detailState.guidelines, "guidelines");
    renderDetailRows("detailPointRows", detailState.points, "points");
    renderDetailRows("detailExtraRows", detailState.extraSections, "extraSections");
    const notes = document.getElementById("detailNotes");
    const extraTitle = document.getElementById("detailExtraTitle");
    if (notes) notes.value = detailState.notes || "";
    if (extraTitle) extraTitle.value = detailState.extraTitle || "";
  }
  function collectDetailRows(containerId, kind) {
    const wrap = document.getElementById(containerId);
    const rows = [...(wrap?.querySelectorAll("[data-detail-row]") || [])];
    return rows.map(row => {
      const inputs = [...row.querySelectorAll("[data-detail-field]")];
      const title = inputs[0]?.value.trim() || "";
      const description = inputs[1]?.value.trim() || "";
      return kind === "documents" || kind === "guidelines" ? title : { title, description };
    }).filter(item => typeof item === "string" ? item : (item.title || item.description));
  }
  function syncDetailStateFromDOM() {
    detailState.documents = collectDetailRows("detailDocRows", "documents");
    detailState.requiredDocuments = collectDetailRows("detailRequiredRows", "requiredDocuments");
    detailState.guidelines = collectDetailRows("detailGuidelineRows", "guidelines");
    detailState.points = collectDetailRows("detailPointRows", "points");
    detailState.extraSections = collectDetailRows("detailExtraRows", "extraSections");
    detailState.notes = document.getElementById("detailNotes").value.trim();
    detailState.extraTitle = document.getElementById("detailExtraTitle").value.trim();
  }
  // Keep the in-progress editor state synchronized on every keystroke so Add/Remove never clears typed text.
  ["detailDocRows", "detailRequiredRows", "detailGuidelineRows", "detailPointRows", "detailExtraRows"].forEach(id => {
    const container = document.getElementById(id);
    if (container) container.addEventListener("input", () => {
      syncDetailStateFromDOM();
      if (id === "detailDocRows") {
        selectedDocs = new Set(detailState.documents.filter(name => typeof name === "string" && name.trim()).map(name => name.trim()));
        renderDocPicker();
      }
    });
    if (container && id === "detailDocRows") container.addEventListener("click", event => {
      if (event.target.closest("[data-detail-remove]")) {
        setTimeout(() => { syncDetailStateFromDOM(); selectedDocs = new Set(detailState.documents.filter(name => typeof name === "string" && name.trim()).map(name => name.trim())); renderDocPicker(); }, 0);
      }
    });
  });
  document.getElementById("detailNotes").addEventListener("input", () => { detailState.notes = document.getElementById("detailNotes").value; });
  document.getElementById("detailExtraTitle").addEventListener("input", () => { detailState.extraTitle = document.getElementById("detailExtraTitle").value; });

  function readDetailContent() {
    return {
      documents: collectDetailRows("detailDocRows", "documents"),
      requiredDocuments: collectDetailRows("detailRequiredRows", "requiredDocuments"),
      guidelines: collectDetailRows("detailGuidelineRows", "guidelines"),
      points: collectDetailRows("detailPointRows", "points"),
      notes: document.getElementById("detailNotes").value.trim(),
      extraTitle: document.getElementById("detailExtraTitle").value.trim(),
      extraSections: collectDetailRows("detailExtraRows", "extraSections")
    };
  }
  document.getElementById("addDetailDocBtn").addEventListener("click", () => { syncDetailStateFromDOM(); detailState.documents.push(""); renderAllDetailRows(); });
  document.getElementById("addRequiredDocBtn").addEventListener("click", () => { syncDetailStateFromDOM(); detailState.requiredDocuments.push({title:"",description:""}); renderAllDetailRows(); });
  document.getElementById("addGuidelineBtn").addEventListener("click", () => { syncDetailStateFromDOM(); detailState.guidelines.push(""); renderAllDetailRows(); });
  document.getElementById("addPointBtn").addEventListener("click", () => { syncDetailStateFromDOM(); detailState.points.push({title:"",description:""}); renderAllDetailRows(); });
  document.getElementById("addExtraBtn").addEventListener("click", () => { syncDetailStateFromDOM(); detailState.extraSections.push({title:"",description:""}); renderAllDetailRows(); });

  /* ---------- Services: editor form ---------- */
  const editorFields = {
    id: document.getElementById("editServiceId"),
    icon: document.getElementById("svcIcon"),
    title: document.getElementById("svcTitle"),
    tagline: document.getElementById("svcTagline"),
    desc: document.getElementById("svcDesc"),
    youtube: document.getElementById("svcYoutube"),
    tags: document.getElementById("svcTags")
  };

  function clearEditor() {
    editorFields.id.value = "";
    editorFields.icon.value = "";
    editorFields.title.value = "";
    editorFields.tagline.value = "";
    editorFields.desc.value = "";
    editorFields.youtube.value = "";
    editorFields.tags.value = "";
    selectedDocs = new Set();
    detailState = detailDefaults();
    renderDocPicker();
    renderAllDetailRows();
  }

  document.getElementById("clearServiceBtn").addEventListener("click", clearEditor);

  function loadServiceIntoEditor(svc) {
    editorFields.id.value = svc.id;
    editorFields.icon.value = svc.icon || "";
    editorFields.title.value = svc.title || "";
    editorFields.tagline.value = svc.tagline || "";
    editorFields.desc.value = svc.description || "";
    editorFields.youtube.value = svc.youtube || "";
    editorFields.tags.value = (svc.tags || []).join(", ");
    selectedDocs = new Set(svc.documents || []);
    const content = svc.detailContent || {};
    detailState = { ...detailDefaults(), ...content, requiredDocuments: content.requiredDocuments || content.documentDetails || [] };
    renderDocPicker();
    renderAllDetailRows();
    document.getElementById("serviceEditor").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  document.getElementById("saveServiceBtn").addEventListener("click", async () => {
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
      documents: Array.from(new Set([...selectedDocs, ...readDetailContent().documents.filter(Boolean)])),
      detailContent: readDetailContent(),
      tags: [...new Set(editorFields.tags.value.split(",").map(x => x.trim()).filter(Boolean))].slice(0, 20)
    };

    // Promote every document button into the shared master list so it remains available in the checkbox picker.
    record.documents.forEach(name => { if (name && !db.masterDocuments.includes(name)) db.masterDocuments.push(name); });
    const idx = db.services.findIndex(s => s.id === id);
    const previous = idx >= 0 ? db.services[idx] : null;
    if (idx >= 0) db.services[idx] = record; else db.services.push(record);

    if (!await persist()) { if (idx >= 0) db.services[idx] = previous; else db.services.pop(); flash("serviceSaveMsg", "Save failed; check migration", true); return; }
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
      btn.addEventListener("click", async () => {
        const svc = db.services.find(s => s.id === btn.dataset.delete);
        if (svc && confirm(`Delete "${svc.title}"? This cannot be undone.`)) {
          try { await ccDeleteService(svc.id); } catch (error) { alert("Delete failed: " + error.message); return; }
          db.services = db.services.filter(s => s.id !== btn.dataset.delete);
          renderServiceList();
        }
      });
    });
  }

  /* ---------- News editor ---------- */
  function clearNews() {
    for (const id of ["editNewsId", "newsTitle", "newsSummary", "newsBody", "newsLink"]) document.getElementById(id).value = "";
  }
  document.getElementById("clearNewsBtn").addEventListener("click", clearNews);
  document.getElementById("saveNewsBtn").addEventListener("click", async () => {
    const title = document.getElementById("newsTitle").value.trim();
    const summary = document.getElementById("newsSummary").value.trim();
    const body = document.getElementById("newsBody").value.trim();
    const source_url = document.getElementById("newsLink").value.trim();
    if (!title || !body) { flash("newsSaveMsg", "Headline and full details are required", true); return; }
    if (source_url && !/^https:\/\/[^\s]+$/i.test(source_url)) { flash("newsSaveMsg", "Enter a full HTTPS source link", true); return; }
    const id = document.getElementById("editNewsId").value || ccUid("news");
    const existing = db.news.find(item => item.id === id);
    const item = { id, title, summary, body, source_url, published_at: existing?.published_at || new Date().toISOString() };
    try {
      await ccSaveNews(item);
      db.news = [item, ...db.news.filter(n => n.id !== id)].sort((a,b) => b.published_at.localeCompare(a.published_at));
      clearNews(); renderNewsList(); flash("newsSaveMsg", "News saved ✓");
    } catch (error) { flash("newsSaveMsg", "Save failed: " + error.message, true); }
  });
  function renderNewsList() {
    const wrap = document.getElementById("adminNewsList");
    wrap.innerHTML = db.news.length ? db.news.map(n => `
      <div class="admin-service-row"><div class="row-info"><div class="row-title">${escapeHtml(n.title)}</div><div class="row-meta">${new Date(n.published_at).toLocaleDateString("en-IN")}</div></div>
      <div class="row-actions"><button type="button" data-news-edit="${escapeAttr(n.id)}">Edit</button><button type="button" class="danger" data-news-delete="${escapeAttr(n.id)}">Delete</button></div></div>`).join("") : "<p>No news published yet.</p>";
    wrap.querySelectorAll("[data-news-edit]").forEach(btn => btn.addEventListener("click", () => {
      const n = db.news.find(x => x.id === btn.dataset.newsEdit);
      if (!n) return;
      for (const [field, value] of Object.entries({editNewsId:n.id,newsTitle:n.title,newsSummary:n.summary,newsBody:n.body,newsLink:n.source_url}))
        document.getElementById(field).value = value || "";
      document.getElementById("newsEditor").scrollIntoView({behavior:"smooth"});
    }));
    wrap.querySelectorAll("[data-news-delete]").forEach(btn => btn.addEventListener("click", async () => {
      const n = db.news.find(x => x.id === btn.dataset.newsDelete);
      if (!n || !confirm('Delete "' + n.title + '"?')) return;
      try { await ccDeleteNews(n.id); db.news = db.news.filter(x => x.id !== n.id); renderNewsList(); }
      catch (error) { alert("Delete failed: " + error.message); }
    }));
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
      btn.addEventListener("click", async () => {
        const doc = btn.dataset.remove;
        try { await ccDeleteMasterDocument(doc); } catch (error) { alert("Delete failed: " + error.message); return; }
        db.masterDocuments = db.masterDocuments.filter(d => d !== doc);
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
    const currentInput = document.getElementById("currentPassword");
    const nextInput = document.getElementById("newPassword");
    const current = currentInput.value;
    const next = nextInput.value;
    const strongEnough = next.length >= 12
      && /[a-z]/.test(next)
      && /[A-Z]/.test(next)
      && /[0-9]/.test(next)
      && /[^A-Za-z0-9]/.test(next);
    if (!current) {
      flash("passwordSaveMsg", "Enter your current password to confirm this change.", true);
      return;
    }
    if (!strongEnough) {
      flash("passwordSaveMsg", "Use 12+ characters with uppercase, lowercase, a number, and a symbol.", true);
      return;
    }
    try {
      const { error } = await ccChangePassword(next, current);
      if (error) throw error;
      currentInput.value = "";
      nextInput.value = "";
      flash("passwordSaveMsg", "Password updated ✓");
    } catch (_) {
      currentInput.value = "";
      flash("passwordSaveMsg", "Password could not be updated. Check the current password and try again.", true);
    }
  });

  document.getElementById("resetAllBtn").addEventListener("click", () => {
    if (confirm("This will erase all your changes and restore defaults. Continue?")) {
      alert("Defaults can be restored by running supabase/setup.sql again in the Supabase SQL Editor.");
    }
  });

  /* ---------- Helpers ---------- */
  async function persist() {
    try { await ccSaveDB(db); return true; }
    catch (error) { alert("Save failed: " + error.message); return false; }
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
