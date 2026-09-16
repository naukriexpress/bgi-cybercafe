/* ============================================================
   app.js — public site behaviour
   ============================================================ */

(async function () {
  let db;
  try {
    db = await ccLoadDB();
  } catch (error) {
    console.error(error);
    document.getElementById("servicesGrid").innerHTML = `<p>Website data could not load. Please check Supabase configuration.</p>`;
    return;
  }
  const { settings, services } = db;

  /* ---------- Header / hero / footer text ---------- */
  document.title = settings.siteName;
  setText("siteNameLbl", settings.siteName);
  setText("siteTaglineLbl", settings.tagline);
  setText("footerName", settings.siteName);
  setText("statCount", services.length + "+");
  document.getElementById("yearLbl").textContent = new Date().getFullYear();

  /* ---------- Ticker ---------- */
  const t1 = document.getElementById("tickerText1");
  const t2 = document.getElementById("tickerText2");
  t1.textContent = settings.ticker;
  t2.textContent = settings.ticker;

  /* ---------- Contact section ---------- */
  setText("contactAddress", "📍 " + settings.address);
  setText("contactHours", "🕒 " + settings.hours);
  setText("contactPhone", "📱 " + formatPhoneDisplay(settings.whatsappNumber));
  document.getElementById("contactWhatsapp").href = buildWhatsAppLink(
    settings.whatsappNumber,
    `Hello ${settings.siteName}, I need help figuring out which service and documents I need.`
  );

  /* ---------- Render service cards ---------- */
  const grid = document.getElementById("servicesGrid");
  grid.innerHTML = services.map(svc => renderCard(svc)).join("");

  function renderCard(svc) {
    const hasVideo = svc.youtube && svc.youtube.trim().length > 0;
    return `
      <article class="service-card">
        <div class="service-top">
          <div class="service-icon">${escapeHtml(svc.icon || "📄")}</div>
          <div>
            <h3 class="service-title">${escapeHtml(svc.title)}</h3>
            <div class="service-tagline">${escapeHtml(svc.tagline || "")}</div>
          </div>
        </div>
        <p class="service-desc">${escapeHtml(svc.description || "")}</p>
        <div class="service-links">
          <button type="button" data-doc="${svc.id}">📋 Documents required</button>
          ${hasVideo ? `<button type="button" data-video="${svc.id}">▶ Watch guide</button>` : ``}
        </div>
        <div class="service-actions">
          <button type="button" class="btn btn-outline" data-doc="${svc.id}">Document list</button>
          <button type="button" class="btn btn-primary" data-apply="${svc.id}">Apply Now</button>
        </div>
      </article>
    `;
  }

  /* ---------- Modals: document list ---------- */
  const docOverlay = document.getElementById("docModalOverlay");
  const docTitle = document.getElementById("docModalTitle");
  const docSub = document.getElementById("docModalSub");
  const docList = document.getElementById("docModalList");
  const docApplyBtn = document.getElementById("docModalApply");
  let activeServiceId = null;

  function openDocModal(svcId) {
    const svc = services.find(s => s.id === svcId);
    if (!svc) return;
    activeServiceId = svcId;
    docTitle.textContent = svc.title;
    docSub.textContent = "Bring these along to complete your application.";
    docList.innerHTML = (svc.documents || []).map(d => `<li>${escapeHtml(d)}</li>`).join("") || "<li>No documents listed yet — ask us on WhatsApp.</li>";
    docOverlay.classList.add("open");
  }

  docApplyBtn.addEventListener("click", () => {
    if (activeServiceId) applyForService(activeServiceId);
  });

  /* ---------- Modals: video ---------- */
  const videoOverlay = document.getElementById("videoModalOverlay");
  const videoTitle = document.getElementById("videoModalTitle");
  const videoFrame = document.getElementById("videoFrame");

  function openVideoModal(svcId) {
    const svc = services.find(s => s.id === svcId);
    if (!svc || !svc.youtube) return;
    videoTitle.textContent = svc.title + " — guide";
    videoFrame.src = toYouTubeEmbed(svc.youtube);
    videoOverlay.classList.add("open");
  }

  function closeAllModals() {
    docOverlay.classList.remove("open");
    videoOverlay.classList.remove("open");
    videoFrame.src = "";
  }

  document.getElementById("docModalClose").addEventListener("click", closeAllModals);
  document.getElementById("videoModalClose").addEventListener("click", closeAllModals);
  [docOverlay, videoOverlay].forEach(ov => {
    ov.addEventListener("click", (e) => { if (e.target === ov) closeAllModals(); });
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAllModals(); });

  /* ---------- Click delegation for cards ---------- */
  grid.addEventListener("click", (e) => {
    const docBtn = e.target.closest("[data-doc]");
    const videoBtn = e.target.closest("[data-video]");
    const applyBtn = e.target.closest("[data-apply]");
    if (docBtn) openDocModal(docBtn.getAttribute("data-doc"));
    if (videoBtn) openVideoModal(videoBtn.getAttribute("data-video"));
    if (applyBtn) applyForService(applyBtn.getAttribute("data-apply"));
  });

  /* ---------- WhatsApp apply ---------- */
  function applyForService(svcId) {
    const svc = services.find(s => s.id === svcId);
    if (!svc) return;
    const message = `Hello ${settings.siteName}, I want to apply for *${svc.title}*. Please guide me on the next steps.`;
    window.open(buildWhatsAppLink(settings.whatsappNumber, message), "_blank");
  }

  /* ---------- Helpers ---------- */
  function buildWhatsAppLink(number, message) {
    const clean = (number || "").replace(/[^0-9]/g, "");
    return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
  }

  function formatPhoneDisplay(number) {
    return "+" + (number || "").replace(/[^0-9]/g, "");
  }

  function toYouTubeEmbed(url) {
    try {
      const u = new URL(url);
      let id = "";
      if (u.hostname.includes("youtu.be")) id = u.pathname.slice(1);
      else if (u.searchParams.get("v")) id = u.searchParams.get("v");
      else if (u.pathname.includes("/embed/")) return url;
      return id ? `https://www.youtube.com/embed/${id}` : url;
    } catch (e) {
      return url;
    }
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
