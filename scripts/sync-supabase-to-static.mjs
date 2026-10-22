import fs from "node:fs/promises";
const CONFIG_PATH = "js/config.js";
const SUPABASE_CONFIG = await fs.readFile(CONFIG_PATH, "utf8");
const URL = SUPABASE_CONFIG.match(/SUPABASE_URL:\s*"([^"]+)"/)?.[1];
const KEY = SUPABASE_CONFIG.match(/SUPABASE_ANON_KEY:\s*"([^"]+)"/)?.[1];

if (!URL || !KEY) throw new Error("Could not read Supabase URL/public key from js/config.js");

async function readTable(table, query) {
  const url = new URLSearchParams(query);
  const endpoint = `${URL}/rest/v1/${table}?${url.toString()}`;
  const response = await fetch(endpoint, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: "application/json" }
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase read failed for ${table}: HTTP ${response.status} ${detail}`);
  }
  return response.json();
}

const [settingsRows, serviceRows, newsRows, documentRows] = await Promise.all([
  readTable("settings", "select=*&id=eq.1"),
  readTable("services", "select=*&order=sort_order.asc"),
  readTable("news", "select=*&order=published_at.desc"),
  readTable("master_documents", "select=name&order=sort_order.asc")
]);

if (!settingsRows.length) throw new Error("Supabase returned no site settings; refusing to overwrite snapshots.");
if (!serviceRows.length) throw new Error("Supabase returned no services; refusing to overwrite snapshots.");

const row = settingsRows[0];
const settings = {
  siteName: row.site_name,
  tagline: row.tagline,
  ticker: row.ticker,
  whatsappNumber: row.whatsapp_number,
  address: row.address,
  hours: row.hours,
  jobsUrl: row.jobs_url || "https://www.naukriexpress.space/"
};

const services = serviceRows.map(s => ({
  id: s.id,
  icon: s.icon || "📄",
  title: s.title,
  tagline: s.tagline || "",
  description: s.description || "",
  youtube: s.youtube || "",
  documents: s.documents || [],
  tags: s.tags || [],
  detailContent: s.detail_content || { documents: [], guidelines: [], points: [], notes: "", extraSections: [] }
}));
const news = newsRows.map(n => ({
  id: n.id,
  title: n.title,
  summary: n.summary || "",
  body: n.body || "",
  source_url: n.source_url || "",
  published_at: n.published_at
}));
const masterDocuments = documentRows.map(d => d.name);

const homepage = {
  news,
  services: services.map(({ detailContent, ...service }) => service),
  settings
};
const details = { settings, services };

const files = new Map([
  ["js/site-data.js", "/* Automatically generated from Supabase public site data. */\nwindow.CC_INITIAL_DATA = " + JSON.stringify(homepage, null, 2) + ";\n"],
  ["js/service-data.js", "/* Automatically generated from Supabase public site data. */\nwindow.CC_SERVICE_DATA = " + JSON.stringify(details, null, 2) + ";\n"],
  ["data/master-documents.json", JSON.stringify({ masterDocuments }, null, 2) + "\n"]
]);

let changed = 0;
for (const [path, content] of files) {
  let existing = "";
  try { existing = await fs.readFile(path, "utf8"); } catch {}
  if (existing !== content) {
    await fs.writeFile(path, content);
    console.log(`Updated ${path}`);
    changed++;
  } else {
    console.log(`Unchanged ${path}`);
  }
}
console.log(`Snapshot sync finished. Services: ${services.length}; news: ${news.length}; master documents: ${masterDocuments.length}; files changed: ${changed}.`);
