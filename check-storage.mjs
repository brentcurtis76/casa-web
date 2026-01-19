import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://mulsqxfhxxdsadxsljss.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11bHNxeGZoeHhkc2FkeHNsanNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM0NzE2ODAsImV4cCI6MjA1OTA0NzY4MH0.K4KKonF8Sd_PbFZtunMTuAAf2rFCGjvuecW3Hn46Cb8";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STORY_ID = "2faa5ded-62fb-4460-928a-0e139cd6f42c";
const DRAFT_ID = "7e5ac04f-4f35-4a34-9da0-516aa3902ad3";
const BUCKET = "cuentacuentos-drafts";

async function checkStorage() {
  console.log("=== Verificando estructura de Storage ===\n");

  // Listar todo en el bucket para esta historia
  const basePath = `${STORY_ID}/${DRAFT_ID}`;

  // Listar carpetas
  const { data: folders, error: foldersError } = await supabase.storage
    .from(BUCKET)
    .list(basePath);

  if (foldersError) {
    console.error("Error listando carpetas:", foldersError.message);
    return;
  }

  console.log(`Carpetas en ${basePath}:`);
  for (const folder of folders || []) {
    console.log(`\n📁 ${folder.name}/`);

    // Listar archivos en cada carpeta
    const { data: files } = await supabase.storage
      .from(BUCKET)
      .list(`${basePath}/${folder.name}`);

    if (files && files.length > 0) {
      for (const file of files) {
        if (file.name !== '.emptyFolderPlaceholder') {
          console.log(`   - ${file.name}`);
        }
      }
    } else {
      console.log(`   (vacía)`);
    }
  }

  // También verificar con el userId (estructura alternativa)
  console.log("\n\n=== Verificando también estructura por userId ===\n");

  // Listar todos los usuarios que tienen datos
  const { data: userFolders } = await supabase.storage
    .from(BUCKET)
    .list('');

  console.log("Carpetas raíz en el bucket:");
  for (const folder of userFolders || []) {
    console.log(`📁 ${folder.name}`);
  }
}

checkStorage().catch(console.error);
