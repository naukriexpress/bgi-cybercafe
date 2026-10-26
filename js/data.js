/* Supabase data layer. Fill js/config.js after creating the project. */
const DEFAULT_SETTINGS = { siteName: "Cyber Cafe Services", tagline: "Aapke sarkari documents, ek hi jagah", ticker: "New services are available. Contact us on WhatsApp for details.", whatsappNumber: "91XXXXXXXXXX", address: "Your Cyber Cafe, Main Road, Your City", hours: "Mon – Sat, 9:00 AM – 8:00 PM", jobsUrl: "https://www.naukriexpress.space/" };

const ccIsAdminPage = window.location.pathname.toLowerCase().endsWith("/admin.html");
const ccSupabase = window.supabase.createClient(
  window.CC_CONFIG.SUPABASE_URL,
  window.CC_CONFIG.SUPABASE_ANON_KEY,
  ccIsAdminPage
    ? { auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false } }
    : undefined
);

function mapSettings(row) {
  if (!row) return { ...DEFAULT_SETTINGS };
  return { siteName: row.site_name, tagline: row.tagline, ticker: row.ticker, whatsappNumber: row.whatsapp_number, address: row.address, hours: row.hours, jobsUrl: row.jobs_url || DEFAULT_SETTINGS.jobsUrl };
}

async function ccLoadDB(options = {}) {
  const includeSettings = options.settings !== false;
  const includeServices = options.services !== false;
  const includeMasterDocuments = options.masterDocuments ?? ccIsAdminPage;
  const includeNews = options.news !== false;
  const skip = { data: null, error: null };
  const [settingsResult, servicesResult, documentsResult, newsResult] = await Promise.all([
    includeSettings ? ccSupabase.from("settings").select("*").eq("id", 1).maybeSingle() : Promise.resolve(skip),
    includeServices ? ccSupabase.from("services").select("*").order("sort_order", { ascending: true }) : Promise.resolve(skip),
    includeMasterDocuments ? ccSupabase.from("master_documents").select("name").order("sort_order", { ascending: true }) : Promise.resolve(skip),
    includeNews ? ccSupabase.from("news").select("*").order("published_at", { ascending: false }) : Promise.resolve(skip)
  ]);
  const error = settingsResult.error || servicesResult.error || documentsResult.error || newsResult.error;
  if (error) throw error;
  return {
    settings: mapSettings(settingsResult.data),
    services: (servicesResult.data || []).map(row => ({ id: row.id, icon: row.icon, title: row.title, tagline: row.tagline, description: row.description, youtube: row.youtube || "", documents: row.documents || [], tags: row.tags || [], detailContent: row.detail_content || { documents: [], guidelines: [], points: [], notes: "", extraSections: [] } })),
    news: newsResult.data || [],
    masterDocuments: (documentsResult.data || []).map(row => row.name)
  };
}

async function ccSaveDB(db) {
  const settings = { id: 1, site_name: db.settings.siteName, tagline: db.settings.tagline, ticker: db.settings.ticker, whatsapp_number: db.settings.whatsappNumber, address: db.settings.address, hours: db.settings.hours, jobs_url: db.settings.jobsUrl || DEFAULT_SETTINGS.jobsUrl, updated_at: new Date().toISOString() };
  const services = db.services.map((s, index) => ({ id: s.id, icon: s.icon, title: s.title, tagline: s.tagline, description: s.description, youtube: s.youtube || "", documents: s.documents || [], tags: s.tags || [], detail_content: s.detailContent || { documents: [], guidelines: [], points: [], notes: "", extraSections: [] }, sort_order: index }));
  const docs = db.masterDocuments.map((name, index) => ({ name, sort_order: index }));
  const a = await ccSupabase.from("settings").upsert(settings); if (a.error) throw a.error;
  if (services.length) { const c = await ccSupabase.from("services").upsert(services); if (c.error) throw c.error; }
  if (docs.length) { const e = await ccSupabase.from("master_documents").upsert(docs, { onConflict: "name" }); if (e.error) throw e.error; }
}
async function ccDeleteService(id) {
  const { error } = await ccSupabase.from("services").delete().eq("id", id);
  if (error) throw error;
}
async function ccDeleteMasterDocument(name) {
  const { error } = await ccSupabase.from("master_documents").delete().eq("name", name);
  if (error) throw error;
}

async function ccSaveNews(item) {
  const { error } = await ccSupabase.from("news").upsert(item);
  if (error) throw error;
}
async function ccDeleteNews(id) {
  const { error } = await ccSupabase.from("news").delete().eq("id", id);
  if (error) throw error;
}

async function ccLogin(email, password) { return ccSupabase.auth.signInWithPassword({ email, password }); }
async function ccLogout() { return ccSupabase.auth.signOut(); }
async function ccSession() { return (await ccSupabase.auth.getSession()).data.session; }
async function ccIsAdmin() {
  const { data, error } = await ccSupabase.rpc("is_app_admin");
  if (error) throw error;
  return data === true;
}
async function ccChangePassword(password, currentPassword) { return ccSupabase.auth.updateUser({ password, current_password: currentPassword }); }
function ccUid(prefix) { return prefix + "-" + crypto.randomUUID(); }

// Notify pages that wait for Supabase until their static snapshot has rendered.
window.dispatchEvent(new Event("cc:data-ready"));
