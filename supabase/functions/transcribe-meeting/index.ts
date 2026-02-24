/**
 * CASA Transcribe Meeting Edge Function
 *
 * Transcribes a leadership meeting audio recording using:
 * 1. OpenAI Whisper API for Spanish speech-to-text
 * 2. Anthropic Claude for summary + action item extraction
 *
 * Invoked by: transcriptionService.ts
 * Input: { recording_id: string }
 * Side effects: Updates church_leadership_recordings row with transcription results
 *
 * Deno runtime — NOT Node.js
 * Secrets: OPENAI_API_KEY, ANTHROPIC_API_KEY (set via Supabase dashboard)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Config ─────────────────────────────────────────────────────────────────

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActionItem {
  title: string;
  description?: string;
  assignee_hint?: string;
  due_date_hint?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

interface TranscriptionResult {
  transcript_text: string;
  transcript_summary: string;
  transcription_action_items: ActionItem[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Download audio from Supabase Storage and return as a Blob.
 */
async function downloadAudio(
  supabase: ReturnType<typeof createClient>,
  storagePath: string,
): Promise<Blob> {
  const { data, error } = await supabase.storage
    .from('leadership-recordings')
    .download(storagePath);

  if (error || !data) {
    throw new Error(`Failed to download audio: ${error?.message ?? 'unknown error'}`);
  }

  return data;
}

/**
 * Transcribe audio using OpenAI Whisper (Spanish).
 */
async function transcribeWithWhisper(audioBlob: Blob, filename: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, filename);
  formData.append('model', 'whisper-1');
  formData.append('language', 'es');
  formData.append('response_format', 'text');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Whisper API error: ${response.status} ${errorText}`);
  }

  const text = await response.text();
  return text.trim();
}

/**
 * Use Claude to generate a summary and extract action items from transcript.
 * NOTE: We do NOT send any PII (member names) in prompts per CASA privacy rules.
 */
async function analyzeWithClaude(transcript: string): Promise<{
  summary: string;
  action_items: ActionItem[];
}> {
  const prompt = `Eres un asistente de gestión de reuniones eclesiales. Analiza la siguiente transcripción de una reunión de liderazgo de iglesia.

TRANSCRIPCIÓN:
${transcript}

Por favor genera:
1. Un resumen ejecutivo conciso (2-4 párrafos) en español de los temas principales tratados.
2. Una lista de compromisos/tareas accionables mencionados en la reunión.

Responde SOLO con un JSON con esta estructura exacta (sin markdown, sin explicaciones):
{
  "summary": "Resumen ejecutivo aquí...",
  "action_items": [
    {
      "title": "Título corto del compromiso",
      "description": "Descripción detallada opcional",
      "assignee_hint": "Nombre o rol de quien quedó a cargo (si se mencionó, sin apellidos completos)",
      "due_date_hint": "Fecha o plazo mencionado (si aplica)",
      "priority": "medium"
    }
  ]
}

Prioridades válidas: low, medium, high, urgent.
Si no hay compromisos claros, retorna action_items como array vacío [].`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text ?? '';

  let parsed: { summary: string; action_items: ActionItem[] };
  try {
    parsed = JSON.parse(content);
  } catch {
    // Fallback: extract JSON from the response if wrapped in markdown
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Claude returned unparseable response');
    }
    parsed = JSON.parse(jsonMatch[0]);
  }

  return {
    summary: parsed.summary ?? '',
    action_items: parsed.action_items ?? [],
  };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Validate secrets
  if (!OPENAI_API_KEY || !ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'Missing API keys. Configure OPENAI_API_KEY and ANTHROPIC_API_KEY.' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  // Parse request body
  let recording_id: string;
  try {
    const body = await req.json();
    recording_id = body.recording_id;
    if (!recording_id) throw new Error('recording_id is required');
  } catch (err) {
    return new Response(JSON.stringify({ error: `Invalid request: ${(err as Error).message}` }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Verify caller authentication and leadership write permission
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Verify leadership write permission via RPC
  const { data: hasAccess } = await userClient.rpc('has_permission', {
    p_user_id: user.id,
    p_resource: 'leadership',
    p_action: 'write',
  });

  if (!hasAccess) {
    return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
      status: 403,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Use service role for data operations (bypasses RLS for transcription updates)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // 1. Fetch recording from DB
    const { data: recording, error: fetchError } = await supabase
      .from('church_leadership_recordings')
      .select('*')
      .eq('id', recording_id)
      .single();

    if (fetchError || !recording) {
      throw new Error(`Recording not found: ${fetchError?.message ?? 'no data'}`);
    }

    // 2. Mark as processing
    await supabase
      .from('church_leadership_recordings')
      .update({ transcription_status: 'processing' })
      .eq('id', recording_id);

    // 3. Download audio
    const audioBlob = await downloadAudio(supabase, recording.storage_path as string);

    // 4. Transcribe with Whisper
    const transcriptText = await transcribeWithWhisper(
      audioBlob,
      recording.filename as string,
    );

    // 5. Analyze with Claude
    const { summary, action_items } = await analyzeWithClaude(transcriptText);

    // 6. Update recording with results
    const result: TranscriptionResult = {
      transcript_text: transcriptText,
      transcript_summary: summary,
      transcription_action_items: action_items,
    };

    const { error: updateError } = await supabase
      .from('church_leadership_recordings')
      .update({
        transcription_status: 'completed',
        transcript_text: result.transcript_text,
        transcript_summary: result.transcript_summary,
        transcription_action_items: result.transcription_action_items,
        transcribed_at: new Date().toISOString(),
      })
      .eq('id', recording_id);

    if (updateError) throw new Error(`Failed to save results: ${updateError.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        recording_id,
        action_items_count: action_items.length,
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    // Revert status to 'failed' on error
    await supabase
      .from('church_leadership_recordings')
      .update({ transcription_status: 'failed' })
      .eq('id', recording_id);

    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
