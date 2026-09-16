/* Supabase data layer. Fill js/config.js after creating the project. */
const DEFAULT_SETTINGS = { siteName: "Cyber Cafe Services", tagline: "Aapke sarkari documents, ek hi jagah", ticker: "New services are available. Contact us on WhatsApp for details.", whatsappNumber: "91XXXXXXXXXX", address: "Your Cyber Cafe, Main Road, Your City", hours: "Mon – Sat, 9:00 AM – 8:00 PM" };

const ccSupabase = window.supabase.createClient(window.CC_CONFIG.SUPABASE_URL, window.CC_CONFIG.SUPABASE_ANON_KEY);

function mapSettings(row) {
  if (!row) return { ...DEFAULT_SETTINGS };
  return { siteName: row.site_name, tagline: row.tagline, ticker: row.ticker, whatsappNumber: row.whatsapp_number, address: row.address, hours: row.hours };
}

async function ccLoadDB() {
  const [settingsResult, servicesResult, documentsResult] = await Promise.all([
    ccSupabase.from("settings").select("*").eq("id", 1).maybeSingle(),
    ccSupabase.from("services").select("*").order("sort_order", { ascending: true }),
    ccSupabase.from("master_documents").select("name").order("sort_order", { ascending: true })
  ]);
  const error = settingsResult.error || servicesResult.error || documentsResult.error;
  if (error) throw error;
  return {
    settings: mapSettings(settingsResult.data),
    services: (servicesResult.data || []).map(row => ({ id: row.id, icon: row.icon, title: row.title, tagline: row.tagline, description: row.description, youtube: row.youtube || "", documents: row.documents || [] })),
    masterDocuments: (documentsResult.data || []).map(row => row.name)
  };
}

async function ccSaveDB(db) {
  const settings = { id: 1, site_name: db.settings.siteName, tagline: db.settings.tagline, ticker: db.settings.ticker, whatsapp_number: db.settings.whatsappNumber, address: db.settings.address, hours: db.settings.hours, updated_at: new Date().toISOString() };
  const services = db.services.map((s, index) => ({ id: s.id, icon: s.icon, title: s.title, tagline: s.tagline, description: s.description, youtube: s.youtube || "", documents: s.documents || [], sort_order: index }));
  const docs = db.masterDocuments.map((name, index) => ({ name, sort_order: index }));
  const a = await ccSupabase.from("settings").upsert(settings); if (a.error) throw a.error;
  const b = await ccSupabase.from("services").delete().not("id", "is", null); if (b.error) throw b.error;
  if (services.length) { const c = await ccSupabase.from("services").insert(services); if (c.error) throw c.error; }
  const d = await ccSupabase.from("master_documents").delete().not("id", "is", null); if (d.error) throw d.error;
  if (docs.length) { const e = await ccSupabase.from("master_documents").insert(docs); if (e.error) throw e.error; }
}

async function ccLogin(email, password) { return ccSupabase.auth.signInWithPassword({ email, password }); }
async function ccLogout() { return ccSupabase.auth.signOut(); }
async function ccSession() { return (await ccSupabase.auth.getSession()).data.session; }
async function ccChangePassword(password) { return ccSupabase.auth.updateUser({ password }); }
function ccUid(prefix) { return prefix + "-" + crypto.randomUUID(); }
