import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://civhmjsatmloowfvxsoy.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpdmhtanNhdG1sb293ZnZ4c295Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTkyOTc5NSwiZXhwIjoyMDk1NTA1Nzk1fQ.hH3GAhab8CH8uzGEUFKtVovLOlpNDWMSbosYKTgoOYc";

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL = "aashcraft@ctel.us";

const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
const user = list.users.find((u) => u.email === EMAIL);

if (!user) {
  console.error("User not found:", EMAIL);
  process.exit(1);
}

const { data, error } = await db.auth.admin.updateUserById(user.id, { email_confirm: true });
if (error) {
  console.error("Error:", error.message);
  process.exit(1);
}

console.log("Verified!", data.user.email, "confirmed at:", data.user.email_confirmed_at);
