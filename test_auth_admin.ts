import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log("Testing auth.admin.listUsers()...");
const { data, error } = await supabase.auth.admin.listUsers();

if (error) {
  console.error("Error:", error);
} else {
  console.log("Success! Found", data.users.length, "users");
  console.log("First user:", data.users[0]?.email);
}
