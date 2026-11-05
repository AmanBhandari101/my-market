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
  photosUrl: "",
};
