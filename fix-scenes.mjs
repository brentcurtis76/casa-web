import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = "https://mulsqxfhxxdsadxsljss.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11bHNxeGZoeHhkc2FkeHNsanNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzQ3MTY4MCwiZXhwIjoyMDU5MDQ3NjgwfQ.z_sq53i6qIRWN5pHw6RNwRkOnaVQkeqOT-dfgvYHAP0";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const BUCKET = "cuentacuentos-drafts";
const STORY_ID = "2faa5ded-62fb-4460-928a-0e139cd6f42c";
const DRAFT_ID = "7e5ac04f-4f35-4a34-9da0-516aa3902ad3";
const LOCAL_IMAGES = "/Users/brentcurtis76/Documents/CASA/Temp story images";

async function fixScenes() {
  console.log("=== 1. Verificando draft en BD ===\n");

  // Buscar el draft
  const { data: drafts, error: draftError } = await supabase
    .from('cuentacuentos_drafts')
    .select('*');

  if (draftError) {
    console.error("Error buscando drafts:", draftError.message);
    return;
  }

  console.log(`Encontrados ${drafts?.length || 0} drafts`);

  if (!drafts || drafts.length === 0) {
    console.log("No hay drafts. Las imágenes se cargan desde el story directamente.");
    return;
  }

  for (const draft of drafts) {
    console.log(`\nDraft: liturgia_id=${draft.liturgia_id}, step=${draft.current_step}`);
    console.log("image_paths:", JSON.stringify(draft.image_paths, null, 2));
  }

  // Tomar el primer draft (o el que corresponda)
  const draft = drafts[0];
  const userId = draft.user_id;
  const liturgyId = draft.liturgia_id;

  console.log(`\n=== 2. Limpiando carpeta scenes en Storage ===\n`);

  // Listar archivos actuales
  const storagePath = `${STORY_ID}/${DRAFT_ID}/scenes`;
  const { data: existingFiles } = await supabase.storage
    .from(BUCKET)
    .list(storagePath);

  if (existingFiles && existingFiles.length > 0) {
    const filesToDelete = existingFiles
      .filter(f => f.name !== '.emptyFolderPlaceholder')
      .map(f => `${storagePath}/${f.name}`);

    if (filesToDelete.length > 0) {
      console.log(`Eliminando ${filesToDelete.length} archivos...`);
      const { error: deleteError } = await supabase.storage
        .from(BUCKET)
        .remove(filesToDelete);

      if (deleteError) {
        console.error("Error eliminando:", deleteError.message);
      } else {
        console.log("Archivos eliminados");
      }
    }
  }

  console.log(`\n=== 3. Subiendo imágenes con formato correcto ===\n`);

  const sceneImagePaths = {};

  // Subir scene0_selected.jpg como scene1_0.jpg, etc.
  for (let i = 0; i < 15; i++) {
    const sourceFile = `scene${i}_selected.jpg`;
    const targetNum = i + 1; // 0->1, 1->2, ..., 14->15
    const targetFile = `scene${targetNum}_0.jpg`;
    const targetPath = `${storagePath}/${targetFile}`;

    const localPath = path.join(LOCAL_IMAGES, sourceFile);

    if (!fs.existsSync(localPath)) {
      console.log(`❌ No existe: ${sourceFile}`);
      continue;
    }

    const fileBuffer = fs.readFileSync(localPath);

    console.log(`Subiendo: ${sourceFile} -> ${targetPath}`);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(targetPath, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      console.error(`  ❌ Error: ${uploadError.message}`);
    } else {
      console.log(`  ✅ OK`);
      // Guardar el path para la BD (relativo al bucket)
      sceneImagePaths[targetNum] = [targetPath];
    }
  }

  console.log(`\n=== 4. Actualizando image_paths en BD ===\n`);

  // Construir el nuevo image_paths
  const newImagePaths = {
    ...draft.image_paths,
    sceneImagePaths: sceneImagePaths
  };

  // Construir selectedSceneImages (todas seleccionadas en índice 0)
  const selectedSceneImages = {};
  for (let i = 1; i <= 15; i++) {
    selectedSceneImages[i] = 0;
  }

  console.log("Nuevos sceneImagePaths:", JSON.stringify(sceneImagePaths, null, 2));

  const { error: updateError } = await supabase
    .from('cuentacuentos_drafts')
    .update({
      image_paths: newImagePaths,
      selected_scene_images: selectedSceneImages
    })
    .eq('id', draft.id);

  if (updateError) {
    console.error("Error actualizando BD:", updateError.message);
  } else {
    console.log("✅ BD actualizada correctamente");
  }

  console.log(`\n=== 5. Verificación final ===\n`);

  const { data: files } = await supabase.storage
    .from(BUCKET)
    .list(storagePath);

  console.log(`Archivos en Storage (${files?.length || 0}):`);
  files?.filter(f => f.name.endsWith('.jpg')).forEach(f => console.log(`  - ${f.name}`));

  console.log("\n✅ LISTO - Refresca la página del Constructor");
}

fixScenes().catch(console.error);
