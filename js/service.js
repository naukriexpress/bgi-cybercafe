(async function () {
  const target = document.getElementById("detail");
  const id = new URLSearchParams(location.search).get("id");
  if (!id) { target.innerHTML = "<h1>Service not found</h1><p>Choose a service from the home page.</p>"; return; }
  const safe = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  try {
    const { settings, services } = await ccLoadDB();
    const service = services.find(item => item.id === id);
    if (!service) { target.innerHTML = "<h1>Service not found</h1><p>This service may have been removed. Please see the current services on our home page.</p>"; return; }
    document.title = service.title + " | BGI Cybercafe Akola";
    document.querySelector('meta[name="description"]').content = (service.description || service.title).slice(0, 155);
    const canonical = document.createElement("link");
    canonical.rel = "canonical";
    canonical.href = "https://www.bgicybercafe.world/service.html?id=" + encodeURIComponent(service.id);
    document.head.append(canonical);
    const docs = service.documents || [];
    const phone = (settings.whatsappNumber || "").replace(/[^0-9]/g, "");
    const message = encodeURIComponent("Hello " + settings.siteName + ", I need assistance with " + service.title + ". Please confirm the current requirements and charges.");
    const pageLink = new URL("service.html?id=" + encodeURIComponent(service.id), location.href).href;
    const shareText = service.title + " | BGI Cybercafe";
    const whatsappIcon = '<svg class="share-icon whatsapp-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.59 15.13L2 22l4.99-1.32A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.08-1.11l-.29-.17-2.96.79.79-2.88-.19-.3A8 8 0 1 1 12 20Zm4.39-5.93c-.24-.12-1.41-.69-1.63-.77-.22-.08-.38-.12-.54.12-.16.24-.61.77-.75.93-.14.16-.28.18-.52.06a6.55 6.55 0 0 1-1.92-1.18 7.15 7.15 0 0 1-1.33-1.66c-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.46-.4-.4-.54-.41H8.6c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.37.51.58.18 1.11.15 1.53.09.47-.07 1.41-.58 1.61-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z"/></svg>';
    const telegramIcon = '<svg class="share-icon telegram-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.5 3.2a1 1 0 0 0-1.06-.18L2.9 9.78a1 1 0 0 0 .06 1.89l4.75 1.58 1.83 5.48a1 1 0 0 0 1.67.39l2.76-2.78 4.44 3.29a1 1 0 0 0 1.58-.62l2.03-14.82a1 1 0 0 0-.52-.99ZM9.29 12.83l8.47-6.1-6.56 7.16-.34 2.27-1.57-3.33Z"/></svg>';
    const videoUrl = service.youtube || "";
    let guide = "";
    try {
      const url = new URL(videoUrl);
      if (["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"].includes(url.hostname)) {
        const videoId = url.hostname.includes("youtu.be") ? url.pathname.slice(1) : url.searchParams.get("v");
        if (videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId)) guide = '<h2 id="guide">Video guide</h2><div class="video-wrap"><iframe title="Video guide" loading="lazy" src="https://www.youtube-nocookie.com/embed/' + videoId + '" allowfullscreen></iframe></div>';
      }
    } catch (_) {}
    target.innerHTML = '<h1>' + safe(service.title) + '</h1>' +
      '<p><strong>' + safe(service.tagline) + '</strong></p>' +
      '<h2>About this service</h2><p>' + safe(service.description || "Contact us to discuss this service.") + '</p>' +
      (service.tags?.length ? '<p class="service-tags">' + service.tags.map(tag => '<span>' + safe(tag) + '</span>').join("") + '</p>' : '') +
      '<h2 id="documents">Documents listed for this service</h2>' +
      (docs.length ? '<ul class="doc-list">' + docs.map(d => '<li>' + safe(d) + '</li>').join("") + '</ul>' : '<p>No document list is available yet. Ask us for the current requirements.</p>') +
      '<p>Document requirements, eligibility, fees and deadlines can change. Confirm them on the relevant official website before submitting an application. BGI Cybercafe assistance charges, if applicable, are separate from official fees.</p>' +
      guide +
      '<div class="share-row"><strong>Share this page:</strong> ' +
      '<a class="btn btn-outline" href="https://api.whatsapp.com/send?text=' + encodeURIComponent(shareText + " " + pageLink) + '" target="_blank" rel="noopener noreferrer">' + whatsappIcon + ' WhatsApp</a>' +
      '<a class="btn btn-outline" href="https://t.me/share/url?url=' + encodeURIComponent(pageLink) + '&text=' + encodeURIComponent(shareText) + '" target="_blank" rel="noopener noreferrer">' + telegramIcon + ' Telegram</a>' +
      '<button class="btn btn-outline" type="button" id="copyServiceLink">Copy link</button></div>' +
      '<h2 id="apply">Apply with BGI Cybercafe</h2><p>Review the details above, then contact us to confirm the current documents, fees and next steps.</p>' +
      (phone ? '<p><a class="btn btn-primary" href="https://wa.me/' + phone + '?text=' + message + '" target="_blank" rel="noopener noreferrer">Continue on WhatsApp ↗</a></p>' : '<p><a class="btn btn-primary" href="contact.html">Contact Us</a></p>');
    document.getElementById("copyServiceLink").addEventListener("click", async event => {
      try { await navigator.clipboard.writeText(pageLink); event.currentTarget.textContent = "✓ Link copied"; }
      catch (_) { window.prompt("Copy this link:", pageLink); }
    });
    if (location.hash) setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView(), 0);
  } catch (error) {
    target.innerHTML = "<h1>Details unavailable</h1><p>Please try again later or contact us.</p>";
    console.error(error);
  }
})();
