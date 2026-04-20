/**
 * CASA Transcribe Meeting Edge Function
 *
 * Transcribes a leadership meeting audio recording using:
 * 1. OpenAI Whisper API for Spanish speech-to-text
 * 2. Anthropic Claude for summary + action item extraction
 *
 * Invoked by: transcriptionService.ts
 * Input: { recording_id: string }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ActionItem {
  title: string;
  description?: string;
  assignee_hint?: string;
  due_date_hint?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

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
  return (await response.text()).trim();
}

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
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Claude returned unparseable response');
    parsed = JSON.parse(jsonMatch[0]);
  }
  return {
    summary: parsed.summary ?? '',
    action_items: parsed.action_items ?? [],
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  if (!OPENAI_API_KEY || !ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'Missing API keys. Configure OPENAI_API_KEY and ANTHROPIC_API_KEY.' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

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

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Decode the JWT payload locally to get the user id. Platform-level
  // verify_jwt=true guarantees signature validity, so we don't need to
  // call /auth/v1/user — that path was returning HTML 502 from inside
  // the edge runtime in this project configuration.
  const token = authHeader.replace(/^Bearer\s+/i, '');
  let userId = '';
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('malformed JWT');
    // base64url -> base64 with padding
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const decoded = JSON.parse(atob(padded));
    userId = decoded.sub ?? '';
    if (!userId) throw new Error('missing sub claim');
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: 'Unauthorized',
        detail: `No se pudo leer el token: ${(err as Error).message}`,
      }),
      { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  // Use service role for the permission RPC so we can reuse the same
  // client for all subsequent DB operations (and avoid touching the auth
  // API from inside the edge runtime).
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: hasAccess, error: rpcError } = await supabaseAdmin.rpc('has_permission', {
    p_user_id: userId,
    p_resource: 'leadership',
    p_action: 'write',
  });

  if (!hasAccess) {
    return new Response(
      JSON.stringify({
        error: 'Insufficient permissions',
        detail: rpcError?.message ?? 'has_permission returned false',
      }),
      { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const supabase = supabaseAdmin;

  try {
    const { data: recording, error: fetchError } = await supabase
      .from('church_leadership_recordings')
      .select('*')
      .eq('id', recording_id)
      .single();

    if (fetchError || !recording) {
      throw new Error(`Recording not found: ${fetchError?.message ?? 'no data'}`);
    }

    await supabase
      .from('church_leadership_recordings')
      .update({ transcription_status: 'processing' })
      .eq('id', recording_id);

    const audioBlob = await downloadAudio(supabase, recording.storage_path as string);
    const transcriptText = await transcribeWithWhisper(audioBlob, recording.filename as string);
    const { summary, action_items } = await analyzeWithClaude(transcriptText);

    const { error: updateError } = await supabase
      .from('church_leadership_recordings')
      .update({
        transcription_status: 'completed',
        transcript_text: transcriptText,
        transcript_summary: summary,
        transcription_action_items: action_items,
        transcribed_at: new Date().toISOString(),
      })
      .eq('id', recording_id);

    if (updateError) throw new Error(`Failed to save results: ${updateError.message}`);

    return new Response(
      JSON.stringify({ success: true, recording_id, action_items_count: action_items.length }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = (err as Error).message;
    console.error('[transcribe-meeting] processing error:', message);
    await supabase
      .from('church_leadership_recordings')
      .update({ transcription_status: 'failed' })
      .eq('id', recording_id);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
