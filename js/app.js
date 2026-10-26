/* ============================================================
   app.js — public site behaviour
   ============================================================ */

(async function () {
  let db = window.CC_INITIAL_DATA ? JSON.parse(JSON.stringify(window.CC_INITIAL_DATA)) : null;
  const frozenServices = Array.isArray(window.CC_INITIAL_DATA?.services) ? window.CC_INITIAL_DATA.services : [];
  const frozenServiceIds = new Set(frozenServices.map(service => service.id));
  if (!db) {
    try {
      db = await ccLoadDB();
    } catch (error) {
      console.error(error);
      document.getElementById("servicesGrid").innerHTML = `<p>Website data could not load. Please check Supabase configuration.</p>`;
      return;
    }
  }
  let { settings, services, news } = db;
  try {
    const jobsUrl = new URL(settings.jobsUrl || "https://www.naukriexpress.space/");
    if (jobsUrl.protocol === "https:") document.getElementById("jobsPromo").href = jobsUrl.href;
  } catch (_) {}
  // Short, plain-language headlines and summaries for the current notices.
  // The full original notice remains available on each detail page.
  const simpleNewsCopy = {
    "news-44687762-0c2e-4511-9ed1-5e9b3fc3bcdb": {
      title: "Aaple Sarkar Portal: Service Update",
      summary: "The portal was reported to be unavailable from 16–21 October for a software upgrade. Check the official portal to confirm services are working again."
    },
    "news-6f676ed7-c79b-4167-9c3e-f1afcd0af89b": {
      title: "Government Hostel Admission 2026–27",
      summary: "The professional-course deadline was extended to 10 October 2026. Other listed deadlines were 30 September. Check the official portal for a newer notice."
    },
    "news-258f69ce-5187-4662-a726-2a9997a5ed0e": {
      title: "Akola: Aaple Sarkar Seva Kendra",
      summary: "The notice gave 6 October 2026, 5 PM as the extended deadline for new centre applications. Check the official site for a newer notice."
    },
    "news-aa6cd69f-a0be-4d87-bd6e-e6d15a1f104b": {
      title: "DMER Round 3: Tutor & Junior Resident",
      summary: "The notice extended applications and preference filling to 30 September 2026, 2 PM. Check the DMER site for a newer schedule."
    },
    "news-113d0142-1cb8-4442-a637-fb9df5ecec27": {
      title: "YCMOU Backlog/ATKT Exam Form",
      summary: "The no-late-fee deadline was 2 October 2026. Late-fee windows were listed through 14 October. Check the university portal for any new dates."
    }
  };

  const newsCard = item => {
    const detailUrl = "news-detail.html?id=" + encodeURIComponent(item.id);
    const copy = simpleNewsCopy[item.id] || {};
    const title = copy.title || item.title;
    const rawSummary = copy.summary || item.summary || (item.body || "").slice(0, 180);
    const summary = rawSummary.length > 220 ? rawSummary.slice(0, 217).replace(/\\s+\\S*$/, "") + "…" : rawSummary;
    let dateText = "";
    try {
      if (item.published_at) dateText = new Date(item.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    } catch (_) {}
    const dateAttr = item.published_at ? ' datetime="' + escapeHtml(item.published_at) + '"' : "";
    const date = dateText ? '<time class="news-card-date"' + dateAttr + '>' + escapeHtml(dateText) + '</time>' : "";
    let sourceLink = "";
    try {
      const source = new URL(item.source_url);
      if (source.protocol === "https:" || source.protocol === "http:") {
        sourceLink = '<a class="news-card-link news-card-source" href="' + escapeHtml(source.href) + '" target="_blank" rel="noopener noreferrer">Official link <span aria-hidden="true">↗</span></a>';
      }
    } catch (_) {}
    return '<article class="service-card news-card">' +
      '<div class="news-card-topline"><span class="news-card-label"><span class="news-card-label-dot" aria-hidden="true"></span> Public notice</span>' + date + '</div>' +
      '<h3 class="news-card-title"><a href="' + detailUrl + '" aria-label="Read details: ' + escapeHtml(title) + '">' + escapeHtml(title) + '</a></h3>' +
      '<p class="news-card-summary">' + escapeHtml(summary) + '</p>' +
      '<div class="news-card-actions"><a class="news-card-link news-card-details" href="' + detailUrl + '">Read details <span aria-hidden="true">→</span></a>' + sourceLink + '</div>' +
      '</article>';
  };
  document.getElementById("newsModalList").innerHTML = news.length ? news.map(newsCard).join("") : "<p>No news published yet.</p>";

  /* ---------- Header / hero / footer text ---------- */
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
  const pauseServices = startServicesAutoscroll(grid);
  const servicesSearch = document.getElementById("servicesSearch");
  servicesSearch.addEventListener("focus", pauseServices, { once: true });
  servicesSearch.addEventListener("input", () => {
    const query = servicesSearch.value.trim().toLocaleLowerCase();
    Array.from(grid.children).forEach(card => {
      card.hidden = query !== "" && !card.textContent.toLocaleLowerCase().includes(query);
    });
    grid.scrollLeft = grid.scrollWidth - grid.clientWidth;
  });

  function startServicesAutoscroll(scroller) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || matchMedia("(max-width: 640px)").matches) return () => {};
    let direction = -1, paused = false, frame;
    const tick = () => {
      if (!paused && scroller.scrollWidth > scroller.clientWidth + 2) {
        const max = scroller.scrollWidth - scroller.clientWidth;
        if (scroller.scrollLeft <= 1) direction = 1;
        else if (scroller.scrollLeft >= max - 1) direction = -1;
        scroller.scrollLeft += direction * 0.45;
      }
      frame = requestAnimationFrame(tick);
    };
    scroller.scrollLeft = scroller.scrollWidth - scroller.clientWidth;
    frame = requestAnimationFrame(tick);
    const stop = () => { paused = true; cancelAnimationFrame(frame); };
    ["pointerdown", "click", "focusin", "keydown", "touchstart"].forEach(type => scroller.addEventListener(type, stop, { once: true }));
    return stop;
  }

  function renderCard(svc) {
    const hasVideo = svc.youtube && svc.youtube.trim().length > 0;
    return `
      <article class="service-card">
        <div class="service-top">
          <div class="service-icon">${escapeHtml(svc.icon || "📄")}</div>
          <h3 class="service-title"><a href="service.html?id=${encodeURIComponent(svc.id)}">${escapeHtml(svc.title)}</a></h3>
        </div>
        <div class="service-actions">
          <a class="btn btn-outline" href="service.html?id=${encodeURIComponent(svc.id)}#documents">View details</a>
          <a class="btn btn-primary" href="service.html?id=${encodeURIComponent(svc.id)}#apply">Apply Now</a>
          ${hasVideo ? `<button type="button" class="btn btn-youtube" data-video="${escapeHtml(svc.id)}" aria-label="Watch ${escapeHtml(svc.title)} YouTube guide">▶ YouTube</button>` : ``}
        </div>
      </article>
    `;
  }

  /* ---------- News popup ---------- */
  const newsOverlay = document.getElementById("newsModalOverlay");
  document.getElementById("openNewsModal").addEventListener("click", () => newsOverlay.classList.add("open"));
  document.getElementById("newsModalClose").addEventListener("click", closeAllModals);

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
    newsOverlay.classList.remove("open");
    videoFrame.src = "";
  }

  document.getElementById("docModalClose").addEventListener("click", closeAllModals);
  document.getElementById("videoModalClose").addEventListener("click", closeAllModals);
  [docOverlay, videoOverlay, newsOverlay].forEach(ov => {
    ov.addEventListener("click", (e) => { if (e.target === ov) closeAllModals(); });
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAllModals(); });

  /* ---------- Click delegation for cards ---------- */
  grid.addEventListener("click", (e) => {
    const docBtn = e.target.closest("[data-doc]");
    const videoBtn = e.target.closest("[data-video]");
    const applyBtn = e.target.closest("[data-apply]");
    const copyBtn = e.target.closest("[data-copy-id]");
    if (videoBtn) openVideoModal(videoBtn.getAttribute("data-video"));
    if (copyBtn) {
      const link = new URL("service.html?id=" + encodeURIComponent(copyBtn.dataset.copyId), location.href).href;
      (navigator.clipboard?.writeText(link) || Promise.reject()).then(() => {
        copyBtn.textContent = "✓ Link copied";
        setTimeout(() => { copyBtn.textContent = "🔗 Copy page link"; }, 2200);
      }).catch(() => { window.prompt("Copy this link:", link); });
    }
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

  // GitHub is the source of truth for existing public content. Render it immediately,
  // without waiting for the Supabase SDK; refresh the live ticker/new services once data.js is ready.
  function refreshLiveTickerAndServices() {
    if (typeof ccLoadDB !== "function") return;
    ccLoadDB({ settings: true, services: true, masterDocuments: false, news: false })
      .then(fresh => {
        const dynamicServices = (fresh.services || []).filter(service => !frozenServiceIds.has(service.id));
        services = [...frozenServices, ...dynamicServices];
        settings = { ...settings, ticker: typeof fresh.settings?.ticker === "string" ? fresh.settings.ticker : settings.ticker };
        db = { settings, services, news };

        // Do not overwrite the GitHub-fixed title, contact information, address or news.
        t1.textContent = settings.ticker;
        t2.textContent = settings.ticker;
        setText("statCount", services.length + "+");
        grid.innerHTML = services.map(svc => renderCard(svc)).join("");
        const query = servicesSearch.value.trim().toLocaleLowerCase();
        Array.from(grid.children).forEach(card => {
          card.hidden = query !== "" && !card.textContent.toLocaleLowerCase().includes(query);
        });
      })
      .catch(error => console.warn("Live ticker/services refresh unavailable; showing the saved GitHub snapshot.", error));
  }

  if (window.CC_INITIAL_DATA) {
    if (typeof ccLoadDB === "function") refreshLiveTickerAndServices();
    else window.addEventListener("cc:data-ready", refreshLiveTickerAndServices, { once: true });
  }
})();
