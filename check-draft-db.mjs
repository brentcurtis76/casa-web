import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://mulsqxfhxxdsadxsljss.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11bHNxeGZoeHhkc2FkeHNsanNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM0NzE2ODAsImV4cCI6MjA1OTA0NzY4MH0.K4KKonF8Sd_PbFZtunMTuAAf2rFCGjvuecW3Hn46Cb8";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STORY_ID = "2faa5ded-62fb-4460-928a-0e139cd6f42c";
const DRAFT_ID = "7e5ac04f-4f35-4a34-9da0-516aa3902ad3";

async function checkDraft() {
  // Listar todos los drafts primero
  const { data: allDrafts } = await supabase
    .from('cuentacuentos_drafts')
    .select('liturgia_id, user_id, current_step');

  console.log("=== Todos los drafts ===");
  for (const d of allDrafts || []) {
    console.log(`  liturgia_id: ${d.liturgia_id}, step: ${d.current_step}`);
  }

  // Buscar el draft específico
  const { data, error } = await supabase
    .from('cuentacuentos_drafts')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    console.error("Error:", error.message);

    // Intentar con story_id
    const { data: data2, error: error2 } = await supabase
      .from('cuentacuentos_drafts')
      .select('*')
      .limit(5);

    if (data2) {
      console.log("\nDrafts encontrados:");
      for (const d of data2) {
        console.log(`  - liturgia_id: ${d.liturgia_id}, user_id: ${d.user_id}`);
      }
    }
    return;
  }

  console.log("=== Draft encontrado ===\n");
  console.log("liturgia_id:", data.liturgia_id);
  console.log("current_step:", data.current_step);

  console.log("\n=== image_paths ===");
  const imagePaths = data.image_paths;
  console.log(JSON.stringify(imagePaths, null, 2));

  console.log("\n=== selected_scene_images ===");
  console.log(JSON.stringify(data.selected_scene_images, null, 2));

  console.log("\n=== Story scenes (numbers) ===");
  if (data.story?.scenes) {
    for (const scene of data.story.scenes) {
      console.log(`  Scene number: ${scene.number}, title: ${scene.title?.slice(0, 30)}...`);
    }
  }
}

checkDraft().catch(console.error);
