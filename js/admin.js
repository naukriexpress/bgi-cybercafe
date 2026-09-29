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
    editorFields.tags.value = (svc.tags || []).join(", ");
    selectedDocs = new Set(svc.documents || []);
    renderDocPicker();
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
      documents: Array.from(selectedDocs),
      tags: [...new Set(editorFields.tags.value.split(",").map(x => x.trim()).filter(Boolean))].slice(0, 20)
    };

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
