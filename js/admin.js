/* ============================================================
   admin.js — admin panel behaviour
   ============================================================ */

(async function () {
  let db = null;
  const fixedServices = Array.isArray(window.CC_INITIAL_DATA?.services) ? window.CC_INITIAL_DATA.services : [];
  const fixedServiceIds = new Set(fixedServices.map(service => service.id));
  const fixedNews = Array.isArray(window.CC_INITIAL_DATA?.news) ? window.CC_INITIAL_DATA.news : [];

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
    db = await ccLoadDB({ news: false });
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
    const settings = window.CC_INITIAL_DATA?.settings || db.settings;
    document.getElementById("setSiteName").value = settings.siteName || "";
    document.getElementById("setTagline").value = settings.tagline || "";
    document.getElementById("setWhatsapp").value = settings.whatsappNumber || "";
    document.getElementById("setAddress").value = settings.address || "";
    document.getElementById("setHours").value = settings.hours || "";
    document.getElementById("setJobsUrl").value = settings.jobsUrl || "https://www.naukriexpress.space/";
    // All general settings except the ticker are intentionally read-only GitHub content.
    ["setSiteName", "setTagline", "setWhatsapp", "setAddress", "setHours", "setJobsUrl"].forEach(id => {
      document.getElementById(id).readOnly = true;
    });
    document.getElementById("saveSettingsBtn").disabled = true;
  }

  /* ---------- Ticker ---------- */
  function renderTickerForm() {
    document.getElementById("setTicker").value = db.settings.ticker;
  }

  document.getElementById("saveTickerBtn").addEventListener("click", async () => {
    const ticker = document.getElementById("setTicker").value.trim();
    try {
      await ccSaveTicker(ticker);
      db.settings.ticker = ticker;
      flash("tickerSaveMsg", "Saved to Supabase ✓");
    } catch (error) {
      flash("tickerSaveMsg", "Save failed: " + error.message, true);
    }
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
    syncDetailStateFromDOM();
    selectedDocs.add(val);
    detailState.documents = Array.from(selectedDocs);
    input.value = "";
    persist();
    renderDocPicker();
    renderAllDetailRows();
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
      quickLinks: [1,2,3,4].map(n => ({ name: document.getElementById("quickLinkName"+n).value.trim(), url: document.getElementById("quickLinkUrl"+n).value.trim(), color: document.getElementById("quickLinkColor"+n).value })).filter(link => link.name && link.url).slice(0,4),
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
    [1,2,3,4].forEach(n => { document.getElementById("quickLinkName"+n).value = ""; document.getElementById("quickLinkUrl"+n).value = ""; document.getElementById("quickLinkColor"+n).value = ["purple","blue","green","orange"][n-1]; });
    renderDocPicker();
    renderAllDetailRows();
  }

  document.getElementById("clearServiceBtn").addEventListener("click", clearEditor);

  function loadServiceIntoEditor(svc) {
    if (fixedServiceIds.has(svc.id)) {
      flash("serviceSaveMsg", "This existing service is fixed in GitHub. Use Clear form / add new for a Supabase service.", true);
      return;
    }
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
    [1,2,3,4].forEach(n => {
      const link = (Array.isArray(content.quickLinks) ? content.quickLinks : [])[n-1] || {};
      document.getElementById("quickLinkName"+n).value = link.name || "";
      document.getElementById("quickLinkUrl"+n).value = link.url || "";
      document.getElementById("quickLinkColor"+n).value = ["purple","blue","green","orange","red","pink","teal","gold"].includes(link.color) ? link.color : ["purple","blue","green","orange"][n-1];
    });
    // Existing service checkbox selections and detail buttons now use the same linked list.
    detailState.documents = [...new Set([...(Array.isArray(content.documents) ? content.documents : []), ...Array.from(selectedDocs)])];
    selectedDocs = new Set(detailState.documents.filter(name => typeof name === "string" && name.trim()).map(name => name.trim()));
    renderDocPicker();
    renderAllDetailRows();
    document.getElementById("serviceEditor").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  document.getElementById("saveServiceBtn").addEventListener("click", async () => {
    const title = editorFields.title.value.trim();
    if (!title) { flash("serviceSaveMsg", "Title is required", true); return; }
    for (let n=1;n<=4;n++) {
      const name = document.getElementById("quickLinkName"+n).value.trim();
      const url = document.getElementById("quickLinkUrl"+n).value.trim();
      if ((name && !url) || (!name && url)) { flash("serviceSaveMsg", "Quick button "+n+": enter both name and link", true); return; }
      if (url && !/^https:\/\/[^\s]+$/i.test(url)) { flash("serviceSaveMsg", "Quick button "+n+": enter a full HTTPS link", true); return; }
    }

    const requestedId = editorFields.id.value;
    if (requestedId && fixedServiceIds.has(requestedId)) {
      flash("serviceSaveMsg", "Existing GitHub-fixed services cannot be edited here. Clear the form to add a new Supabase service.", true);
      return;
    }
    const id = requestedId || ccUid("svc");
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
    const managedServices = db.services.filter(svc => !fixedServiceIds.has(svc.id));
    if (!fixedServices.length && !managedServices.length) {
      wrap.innerHTML = `<p class="panel-sub">No services yet — add your first one above.</p>`;
      return;
    }

    const fixedMarkup = fixedServices.map(svc => `
      <div class="admin-service-row">
        <div class="row-icon">${escapeHtml(svc.icon || "📄")}</div>
        <div class="row-info">
          <div class="row-title">${escapeHtml(svc.title)}</div>
          <div class="row-meta">GitHub snapshot · fixed content</div>
        </div>
        <div class="row-actions"><span class="row-meta">Read only</span></div>
      </div>
    `).join("");

    const managedMarkup = managedServices.map(svc => `
      <div class="admin-service-row">
        <div class="row-icon">${escapeHtml(svc.icon || "📄")}</div>
        <div class="row-info">
          <div class="row-title">${escapeHtml(svc.title)}</div>
          <div class="row-meta">${(svc.documents || []).length} document(s) ${svc.youtube ? "· has video" : ""} · Supabase</div>
        </div>
        <div class="row-actions">
          <button type="button" data-edit="${escapeAttr(svc.id)}">Edit</button>
          <button type="button" class="danger" data-delete="${escapeAttr(svc.id)}">Delete</button>
        </div>
      </div>
    `).join("");

    wrap.innerHTML = `
      <p class="panel-sub">GitHub-fixed services: ${fixedServices.length} · Supabase-managed services: ${managedServices.length}</p>
      ${fixedMarkup}
      ${managedMarkup}
    `;

    wrap.querySelectorAll("[data-edit]").forEach(btn => {
      btn.addEventListener("click", () => {
        const svc = db.services.find(s => s.id === btn.dataset.edit);
        if (svc) loadServiceIntoEditor(svc);
      });
    });
    wrap.querySelectorAll("[data-delete]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const svc = db.services.find(s => s.id === btn.dataset.delete);
        if (svc && !fixedServiceIds.has(svc.id) && confirm(`Delete "${svc.title}"? This cannot be undone.`)) {
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
    wrap.innerHTML = fixedNews.length ? fixedNews.map(item => `
      <div class="admin-service-row">
        <div class="row-info">
          <div class="row-title">${escapeHtml(item.title)}</div>
          <div class="row-meta">${item.published_at ? new Date(item.published_at).toLocaleDateString("en-IN") : "GitHub snapshot"} · GitHub fixed</div>
        </div>
        <div class="row-actions"><span class="row-meta">Read only</span></div>
      </div>
    `).join("") : "<p>No news items are saved in the GitHub snapshot.</p>";
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
