// My Market — server connection (Supabase, Mumbai, free plan).
// Both values are PUBLIC by design: the database's privacy rules (supabase/schema.sql)
// decide what each user can read or write. Never put the secret / service_role key here.
window.MM_CONFIG = {
  supabaseUrl: "https://dhcpzdwzbndntnekuiud.supabase.co",
  supabaseKey: "sb_publishable_XnlhmSrXLLoHCcZjLdMatQ_uMOH3LdM",
  // Shop plan payments: 2 months free, then ₹150/month or ₹1,500/year, paid by UPI to this ID.
  // While it is empty the plan page only shows the free trial and nothing is ever locked.
  payUpi: "8923060977@ibl",
  payName: "My Market",
  // Item and shop photos: the Cloudflare photo service (cloudflare/photos-worker.js). Empty = Supabase storage.
  photosUrl: "https://mymarket-photos.aman101bhandari.workers.dev",
  // The customer site Google reads (cloudflare/site-worker.js), e.g. "https://mymarket.example.in".
  // Empty = shop links stay on the app's own #/shop/<id> address.
  siteUrl: "https://mymarket.aman101bhandari.workers.dev",
  // Order alerts (Web Push): My Market's public VAPID key. The private half lives only in the site worker.
  vapidPublic: "BLNqmF-Oof4lsDm1lJRCzT9fOjdGAuZqicajNBYcom01ZbXKbgl9lcvdqI4iaMHW0aYlEo8mOjuAuwQ3OVWb64c",
};
// Local design checks: http://127.0.0.1:8897/business.html?demo runs without the server (data stays in this browser).
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]demo\b/.test(location.search)) window.MM_CONFIG.supabaseUrl = "";
