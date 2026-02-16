/**
 * Send Children's Service Packet to Assigned Volunteers
 * Sends email with children's activity details to volunteers assigned to sessions
 * Uses Resend API (follows pattern from send-music-service-packet)
 *
 * Multi-group aggregation: when a volunteer is assigned to multiple age groups
 * for the same liturgy, they receive ONE consolidated email with all group details.
 *
 * Pattern: supabase/functions/send-music-service-packet/index.ts
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev';
const FROM_NAME = Deno.env.get('FROM_NAME') || 'CASA - Actividades Infantiles';

/**
 * HTML entity escape for email template safety
 * Prevents XSS attacks from malicious content in DB fields
 */
function escapeHtml(text: string): string {
  if (!text) return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

interface PacketRequest {
  publicationId?: string;
  publicationIds?: string[];
  liturgyId?: string;
}

interface SendResult {
  success: boolean;
  sent: number;
  failed: number;
  errors: string[];
}

/** Data for a single age group activity section within an email */
interface GroupActivityData {
  publicationId: string;
  volunteerId: string;
  volunteerRole: string;
  lessonTitle: string;
  activityDate: string;
  activityTime: string;
  ageGroupName: string;
  phaseHtml: string;
  materials: string[];
}

/** Aggregated per-recipient data */
interface RecipientData {
  displayName: string;
  email: string;
  groups: GroupActivityData[];
}

/**
 * Build a single activity section HTML block (used within a consolidated email)
 */
function buildGroupSectionHtml(group: GroupActivityData): string {
  return `
    <table width="100%" style="background:#f0f0f0;border-radius:6px;margin:16px 0;border-left:4px solid #D4A843;">
      <tr>
        <td style="padding:16px;">
          <p style="margin:0 0 8px 0;font-weight:bold;color:#1F2937;">Grupo: ${escapeHtml(group.ageGroupName)}</p>
          <p style="margin:0 0 8px 0;font-weight:bold;color:#1F2937;">Actividad</p>
          <p style="margin:0 0 12px 0;color:#555;font-size:14px;">${escapeHtml(group.lessonTitle)}</p>
          <p style="margin:0 0 8px 0;font-weight:bold;color:#1F2937;">Fecha</p>
          <p style="margin:0 0 12px 0;color:#555;font-size:14px;">${escapeHtml(group.activityDate)}</p>
          <p style="margin:0 0 8px 0;font-weight:bold;color:#1F2937;">Horario</p>
          <p style="margin:0 0 12px 0;color:#555;font-size:14px;">${escapeHtml(group.activityTime)}</p>
          <p style="margin:0 0 8px 0;font-weight:bold;color:#1F2937;">Tu Rol</p>
          <p style="margin:0;color:#555;font-size:14px;">Voluntario de ${escapeHtml(group.volunteerRole)}</p>
        </td>
      </tr>
    </table>
    ${group.phaseHtml ? `
      <p style="margin:16px 0 8px 0;font-weight:bold;color:#1F2937;">Estructura de la Actividad — ${escapeHtml(group.ageGroupName)}</p>
      <table width="100%" style="border-collapse:collapse;">
        ${group.phaseHtml}
      </table>
    ` : ''}
    ${group.materials.length > 0 ? `
      <p style="margin:16px 0 8px 0;font-weight:bold;color:#1F2937;">Materiales Necesarios — ${escapeHtml(group.ageGroupName)}</p>
      <ul style="margin:0;padding-left:16px;color:#555;font-size:14px;">
        ${group.materials.map((m) => `<li>${escapeHtml(m.trim())}</li>`).join('')}
      </ul>
    ` : ''}`;
}

/**
 * Build consolidated HTML email for a volunteer with one or more group assignments
 */
function buildConsolidatedEmailHtml(recipient: RecipientData): string {
  const groupCount = recipient.groups.length;
  const introText = groupCount > 1
    ? `Te compartimos los detalles de las actividades infantiles para <strong>${groupCount} grupos</strong> asignados:`
    : `Te compartimos los detalles de la actividad infantil para el grupo de <strong>${escapeHtml(recipient.groups[0].ageGroupName)}</strong>:`;

  const groupSections = recipient.groups.map(buildGroupSectionHtml).join(`
    <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;">
  `);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family:Arial,sans-serif;color:#333;background:#f8f8f8;margin:0;padding:0;">
  <table width="100%" style="background:#f8f8f8;padding:24px 0;">
    <tr>
      <td style="padding:0;">
        <table width="100%" style="max-width:600px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr style="background:#1F2937;">
            <td style="padding:24px 16px;color:white;text-align:center;">
              <h1 style="margin:0;font-size:24px;color:white;">CASA - Actividad de Ninos</h1>
              <p style="margin:8px 0 0 0;font-size:13px;color:#ccc;">Comunidad Anglicana San Andres</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 16px;">
              <p>Estimado/a <strong>${escapeHtml(recipient.displayName)}</strong>,</p>
              <p style="color:#555;font-size:14px;">${introText}</p>
              ${groupSections}
              <p style="margin:16px 0 0 0;color:#888;font-size:12px;">
                Esta actividad fue generada automaticamente por CASA. Si tienes preguntas, contacta a tu coordinador.
              </p>
            </td>
          </tr>
          <tr style="background:#f8f8f8;">
            <td style="padding:16px;text-align:center;color:#888;font-size:11px;border-top:1px solid #eee;">
              <p style="margin:0;">Comunidad Anglicana San Andres</p>
              <p style="margin:4px 0 0 0;">Santiago, Chile</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  try {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    // Validate Resend is configured
    if (!RESEND_API_KEY) {
      throw new Error('Resend API key not configured');
    }

    // Parse request — accepts publicationId (single), publicationIds (array), or liturgyId
    const requestBody: PacketRequest = await req.json();
    const { publicationId, publicationIds, liturgyId } = requestBody;

    if (!publicationId && (!publicationIds || publicationIds.length === 0) && !liturgyId) {
      return new Response(
        JSON.stringify({ success: false, error: 'publicationId, publicationIds, or liturgyId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate caller JWT and role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization header required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check user role (Liturgist, Children Ministry Coordinator, or General Admin)
    const { data: roles, error: rolesError } = await supabase.rpc('get_user_roles', {
      p_user_id: user.id,
    });

    if (rolesError) {
      throw new Error(`Failed to fetch user roles: ${rolesError.message}`);
    }

    const allowedRoles = ['general_admin', 'liturgist', 'children_ministry_coordinator'];
    const userRoles = (roles as string[]) || [];
    const hasAccess = userRoles.some((r: string) => allowedRoles.includes(r));

    if (!hasAccess) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Acceso denegado. Se requiere rol de Liturgista, Coordinador de Ninos o Administrador.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Resolve publication IDs — supports single, array, or liturgy-based lookup
    let resolvedPublicationIds: string[] = [];

    if (publicationIds && publicationIds.length > 0) {
      resolvedPublicationIds = publicationIds;
    } else if (publicationId) {
      resolvedPublicationIds = [publicationId];
    } else if (liturgyId) {
      const { data: pubs, error: pubsError } = await supabase
        .from('church_children_publication_state')
        .select('id')
        .eq('liturgy_id', liturgyId);
      if (pubsError) throw new Error(`Error resolving publications: ${pubsError.message}`);
      resolvedPublicationIds = (pubs || []).map((p: { id: string }) => p.id);
    }

    if (resolvedPublicationIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No se encontraron publicaciones', sent: 0, failed: 0, errors: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ─── Pass 1: Collect all group activity data per recipient email ───────
    const recipientMap = new Map<string, RecipientData>();
    const failedPublications: string[] = [];

    for (const pubId of resolvedPublicationIds) {
      // Fetch publication state
      const { data: publication, error: pubError } = await supabase
        .from('church_children_publication_state')
        .select('*')
        .eq('id', pubId)
        .single();

      if (pubError || !publication) {
        failedPublications.push(`Publication ${pubId}: not found`);
        continue;
      }

      // Fetch calendar session
      const { data: calendar, error: calError } = await supabase
        .from('church_children_calendar')
        .select('*, church_children_age_groups(*)')
        .eq('id', publication.calendar_id)
        .single();

      if (calError || !calendar) {
        failedPublications.push(`Publication ${pubId}: calendar session not found`);
        continue;
      }

      // Fetch lesson with content
      const { data: lesson, error: lessonError } = await supabase
        .from('church_children_lessons')
        .select('*')
        .eq('id', publication.lesson_id)
        .single();

      if (lessonError || !lesson) {
        failedPublications.push(`Publication ${pubId}: lesson not found`);
        continue;
      }

      // Fetch assigned volunteers for this session
      const { data: assignments, error: assignError } = await supabase
        .from('church_children_session_assignments')
        .select('*, church_children_volunteers(*)')
        .eq('calendar_id', publication.calendar_id);

      if (assignError) {
        failedPublications.push(`Publication ${pubId}: ${assignError.message}`);
        continue;
      }

      // Parse lesson sequence (3 phases)
      let phaseHtml = '';
      try {
        const sequence = JSON.parse(lesson.content || '[]');
        if (Array.isArray(sequence) && sequence.length === 3) {
          phaseHtml = sequence
            .map(
              (phase: { phase: string; title: string; description: string; minutes: number }) => `
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid #eee;font-weight:bold;color:#D4A843;">
                ${escapeHtml(phase.title)} (${phase.minutes} min)
              </td>
            </tr>
            <tr>
              <td style="padding:8px 16px;border-bottom:1px solid #eee;color:#555;font-size:13px;">
                ${escapeHtml(phase.description)}
              </td>
            </tr>
          `
            )
            .join('');
        }
      } catch {
        // If parsing fails, skip phase display
      }

      const activityDate = calendar.date;
      const activityTime = `${calendar.start_time} - ${calendar.end_time}`;
      const ageGroupName = (calendar.church_children_age_groups as { name: string })?.name || 'Grupo';
      const materials = lesson.materials_needed ? lesson.materials_needed.split(', ') : [];

      // Collect unique volunteers for this group
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const seenEmails = new Set<string>();

      for (const assignment of assignments || []) {
        const volunteer = assignment.church_children_volunteers;
        if (!volunteer?.email || !emailRegex.test(volunteer.email)) continue;
        if (seenEmails.has(volunteer.email)) continue;
        seenEmails.add(volunteer.email);

        const groupData: GroupActivityData = {
          publicationId: pubId,
          volunteerId: volunteer.id,
          volunteerRole: assignment.role === 'lead' ? 'Lider' : 'Apoyo',
          lessonTitle: lesson.title,
          activityDate,
          activityTime,
          ageGroupName,
          phaseHtml,
          materials,
        };

        const existing = recipientMap.get(volunteer.email);
        if (existing) {
          existing.groups.push(groupData);
        } else {
          recipientMap.set(volunteer.email, {
            displayName: volunteer.display_name,
            email: volunteer.email,
            groups: [groupData],
          });
        }
      }
    }

    // ─── Pass 2: Send one consolidated email per recipient ────────────────
    const sent: string[] = [];
    const failed: string[] = [...failedPublications];

    for (const [email, recipient] of recipientMap) {
      const emailHtml = buildConsolidatedEmailHtml(recipient);

      // Build subject: list all group names
      const groupNames = recipient.groups.map((g) => g.ageGroupName);
      const uniqueGroupNames = [...new Set(groupNames)];
      const firstLesson = recipient.groups[0].lessonTitle;
      const subject = uniqueGroupNames.length > 1
        ? `Actividad Infantil: ${firstLesson} - ${uniqueGroupNames.join(', ')}`
        : `Actividad Infantil: ${firstLesson} - ${uniqueGroupNames[0]}`;

      try {
        // Rate limiting: wait 500ms between sends
        await new Promise((resolve) => setTimeout(resolve, 500));

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${FROM_NAME} <${FROM_EMAIL}>`,
            to: email,
            subject,
            html: emailHtml,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          sent.push(email);

          // Log delivery per publication/group for accurate tracking
          for (const group of recipient.groups) {
            await supabase.from('church_children_packet_deliveries').insert({
              publication_id: group.publicationId,
              volunteer_id: group.volunteerId,
              email,
              status: 'sent',
              external_id: data.id,
              sent_at: new Date().toISOString(),
            });
          }
        } else {
          const errorText = await response.text();
          failed.push(`${email}: ${errorText}`);

          for (const group of recipient.groups) {
            await supabase.from('church_children_packet_deliveries').insert({
              publication_id: group.publicationId,
              volunteer_id: group.volunteerId,
              email,
              status: 'failed',
              error_message: errorText,
            });
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        failed.push(`${email}: ${errorMsg}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: sent.length > 0,
        sent: sent.length,
        failed: failed.length,
        errors: failed,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[send-children-service-packet] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Error enviando paquetes',
        sent: 0,
        failed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
