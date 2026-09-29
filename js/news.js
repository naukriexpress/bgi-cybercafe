(async function () {
  const safe = value => String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const targetList = document.getElementById("newsList");
  const targetDetail = document.getElementById("newsDetail");
  try {
    const { news } = await ccLoadDB();
    if (targetList) targetList.innerHTML = news.length ? news.map(n =>
      '<article class="service-card news-card"><h2><a href="news-detail.html?id=' + encodeURIComponent(n.id) + '">' + safe(n.title) + '</a></h2><p>' + safe(n.summary || n.body.slice(0, 180)) + '</p><a href="news-detail.html?id=' + encodeURIComponent(n.id) + '">Read full details →</a></article>'
    ).join("") : "<p>No news published yet.</p>";
    if (targetDetail) {
      const id = new URLSearchParams(location.search).get("id");
      const item = news.find(n => n.id === id);
      if (!item) { targetDetail.innerHTML = "<h1>News not found</h1><p>This update may have been removed.</p>"; return; }
      document.title = item.title + " | BGI Cybercafe";
      document.querySelector('meta[name="description"]').content = (item.summary || item.body).slice(0,155);
      const canonical = document.createElement("link");
      canonical.rel = "canonical";
      canonical.href = "https://www.bgicybercafe.world/news-detail.html?id=" + encodeURIComponent(item.id);
      document.head.append(canonical);
      let source = "";
      try {
        const link = new URL(item.source_url);
        if (link.protocol === "https:" || link.protocol === "http:") source = '<p><a class="btn btn-outline" href="' + safe(link.href) + '" target="_blank" rel="noopener noreferrer">Open source / full notice ↗</a></p>';
      } catch (_) {}
      targetDetail.innerHTML = '<h1>' + safe(item.title) + '</h1><p>' + new Date(item.published_at).toLocaleDateString("en-IN") + '</p>' +
        (item.summary ? '<p><strong>' + safe(item.summary) + '</strong></p>' : '') +
        '<div class="news-body">' + safe(item.body) + '</div>' + source +
        '<p>Check the original source for current dates, eligibility and fees.</p>';
    }
  } catch (error) {
    const target = targetList || targetDetail;
    target.innerHTML = "<p>News could not load. Please try again later.</p>";
    console.error(error);
  }
})();
