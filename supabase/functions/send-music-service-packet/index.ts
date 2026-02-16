// Send Music Service Packet to Assigned Musicians
// Sends email with packet PDF link to musicians assigned to a service date
// Uses Resend API (follows pattern from send-mesa-notifications)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "onboarding@resend.dev";
const FROM_NAME = Deno.env.get("FROM_NAME") || "CASA - Programacion Musical";

interface PacketRequest {
  publicationId: string;
}

interface SendResult {
  success: boolean;
  sent: number;
  failed: number;
  errors: string[];
}

serve(async (req) => {
  try {
    // CORS headers
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers":
            "authorization, x-client-info, apikey, content-type",
        },
      });
    }

    // Validate Resend is configured
    if (!RESEND_API_KEY) {
      throw new Error("Resend API key not configured");
    }

    // Parse request
    const { publicationId }: PacketRequest = await req.json();

    if (!publicationId) {
      return new Response(
        JSON.stringify({ success: false, error: "publicationId is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate caller JWT and role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authorization header required" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check user role (Worship Coordinator or General Admin)
    const { data: roles, error: rolesError } = await supabase.rpc(
      "get_user_roles",
      { p_user_id: user.id }
    );

    if (rolesError) {
      throw new Error(`Failed to fetch user roles: ${rolesError.message}`);
    }

    const allowedRoles = ["general_admin", "worship_coordinator"];
    const userRoles = (roles as string[]) || [];
    const hasAccess = userRoles.some((r: string) => allowedRoles.includes(r));

    if (!hasAccess) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Acceso denegado. Se requiere rol de Coordinador de Alabanza o Administrador.",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch publication state
    const { data: publication, error: pubError } = await supabase
      .from("music_publication_state")
      .select("*")
      .eq("id", publicationId)
      .single();

    if (pubError || !publication) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Publicacion no encontrada",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch service date
    const { data: serviceDate, error: sdError } = await supabase
      .from("music_service_dates")
      .select("*")
      .eq("id", publication.service_date_id)
      .single();

    if (sdError || !serviceDate) {
      throw new Error("Fecha de servicio no encontrada");
    }

    // Fetch setlist with items (include song id for audio reference lookups)
    const { data: setlist, error: slError } = await supabase
      .from("music_setlists")
      .select("*, music_setlist_items(*, music_songs(id, title))")
      .eq("id", publication.setlist_id)
      .single();

    if (slError || !setlist) {
      throw new Error("Setlist no encontrada");
    }

    // Fetch audio/video references for all songs in the setlist
    const songIds = [
      ...new Set(
        (setlist.music_setlist_items || []).map(
          (item: { music_songs: { id: string } }) => item.music_songs.id
        )
      ),
    ];

    const audioRefsBySong: Record<
      string,
      { url: string; source_type: string | null; description: string | null }[]
    > = {};

    if (songIds.length > 0) {
      const { data: audioRefs } = await supabase
        .from("music_audio_references")
        .select("song_id, url, source_type, description")
        .in("song_id", songIds);

      for (const ref of audioRefs || []) {
        if (!audioRefsBySong[ref.song_id]) {
          audioRefsBySong[ref.song_id] = [];
        }
        audioRefsBySong[ref.song_id].push({
          url: ref.url,
          source_type: ref.source_type,
          description: ref.description,
        });
      }
    }

    // Check stem availability per song (via arrangements)
    const stemsBySong: Record<string, boolean> = {};
    if (songIds.length > 0) {
      const { data: arrangements } = await supabase
        .from("music_arrangements")
        .select("song_id, id")
        .in("song_id", songIds);

      if (arrangements && arrangements.length > 0) {
        const arrangementIds = arrangements.map((a: { id: string }) => a.id);
        const { data: stems } = await supabase
          .from("music_stems")
          .select("arrangement_id")
          .in("arrangement_id", arrangementIds);

        const arrangementIdsWithStems = new Set(
          (stems || []).map((s: { arrangement_id: string }) => s.arrangement_id)
        );

        for (const arr of arrangements) {
          if (arrangementIdsWithStems.has(arr.id)) {
            stemsBySong[arr.song_id] = true;
          }
        }
      }
    }

    // Fetch assigned musicians for this service date
    const { data: assignments, error: assignError } = await supabase
      .from("music_service_assignments")
      .select("*, music_musicians(id, display_name, email)")
      .eq("service_date_id", publication.service_date_id);

    if (assignError) {
      throw new Error(
        `Error obteniendo asignaciones: ${assignError.message}`
      );
    }

    // Filter musicians with valid email
    const musiciansToNotify: {
      musicianId: string;
      displayName: string;
      email: string;
    }[] = [];

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    for (const assignment of assignments || []) {
      const musician = assignment.music_musicians;
      if (musician?.email && emailRegex.test(musician.email)) {
        // Deduplicate by email
        if (!musiciansToNotify.some((m) => m.email === musician.email)) {
          musiciansToNotify.push({
            musicianId: musician.id,
            displayName: musician.display_name,
            email: musician.email,
          });
        }
      }
    }

    if (musiciansToNotify.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "No hay musicos asignados con correo electronico valido para esta fecha",
          sent: 0,
          failed: 0,
          errors: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate signed URL for packet PDF (if exists)
    let packetUrl = "";
    if (publication.last_packet_path) {
      const { data: signedUrlData } = await supabase.storage
        .from("music-packets")
        .createSignedUrl(publication.last_packet_path, 86400); // 24 hours

      if (signedUrlData?.signedUrl) {
        packetUrl = signedUrlData.signedUrl;
      }
    }

    // Build song list for email (with audio/video references and stem availability)
    const sortedItems = [...(setlist.music_setlist_items || [])].sort(
      (a: { sort_order: number }, b: { sort_order: number }) =>
        a.sort_order - b.sort_order
    );

    const sourceTypeLabels: Record<string, string> = {
      youtube: "YouTube",
      spotify: "Spotify",
      upload: "Audio",
      other: "Enlace",
    };

    const songListHtml = sortedItems
      .map(
        (
          item: {
            music_songs: { id: string; title: string };
            liturgical_moment: string | null;
          },
          idx: number
        ) => {
          const moment = item.liturgical_moment
            ? ` <span style="color:#888;">(${item.liturgical_moment})</span>`
            : "";

          const hasStemsLabel = stemsBySong[item.music_songs.id]
            ? ' <span style="color:#16a34a;font-size:11px;">&#9835; Stems disponibles</span>'
            : "";

          // Build reference links for this song
          const refs = audioRefsBySong[item.music_songs.id] || [];
          let refsHtml = "";
          if (refs.length > 0) {
            const refLinks = refs.map((r) => {
              const label = r.description || sourceTypeLabels[r.source_type || "other"] || "Referencia";
              return `<a href="${r.url}" style="color:#D4A843;text-decoration:underline;font-size:12px;">${label}</a>`;
            });
            refsHtml = `<br><span style="padding-left:16px;">${refLinks.join(" &middot; ")}</span>`;
          }

          return `${idx + 1}. <strong>${item.music_songs.title}</strong>${moment}${hasStemsLabel}${refsHtml}`;
        }
      )
      .join("<br>");

    // Format service date for email
    const dateObj = new Date(serviceDate.date + "T12:00:00");
    const months = [
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
    ];
    const days = [
      "domingo",
      "lunes",
      "martes",
      "miercoles",
      "jueves",
      "viernes",
      "sabado",
    ];
    const formattedDate = `${days[dateObj.getDay()]} ${dateObj.getDate()} de ${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;

    const serviceTypeLabels: Record<string, string> = {
      domingo_principal: "Domingo Principal",
      especial: "Servicio Especial",
      ensayo: "Ensayo",
    };
    const serviceTypeLabel =
      serviceTypeLabels[serviceDate.service_type] || serviceDate.service_type;

    // Build version info
    const versionLabel =
      publication.publish_version > 1
        ? ` (Actualizacion v${publication.publish_version})`
        : "";

    const emailSubject =
      publication.publish_version > 1
        ? `Actualizacion v${publication.publish_version} - Paquete Musical - ${serviceTypeLabel} ${dateObj.getDate()} de ${months[dateObj.getMonth()]}`
        : `Paquete Musical - ${serviceTypeLabel} ${dateObj.getDate()} de ${months[dateObj.getMonth()]}`;

    // Send emails with rate limiting
    const result: SendResult = {
      success: true,
      sent: 0,
      failed: 0,
      errors: [],
    };

    for (const musician of musiciansToNotify) {
      // Create delivery record
      const { data: delivery } = await supabase
        .from("music_packet_deliveries")
        .insert({
          publication_id: publicationId,
          musician_id: musician.musicianId,
          email: musician.email,
          status: "pending",
        })
        .select("id")
        .single();

      const deliveryId = delivery?.id;

      try {
        // Build email HTML
        const packetSection = packetUrl
          ? `<p><a href="${packetUrl}" style="display:inline-block;padding:12px 24px;background-color:#D4A843;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Descargar Paquete Musical (PDF)</a></p>
            <p style="font-size:12px;color:#888;">Enlace valido por 24 horas</p>`
          : `<p style="color:#888;"><em>El paquete PDF aun no esta disponible. Se generara antes del servicio.</em></p>`;

        const emailHtml = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <div style="text-align:center;padding:20px 0;border-bottom:2px solid #D4A843;">
              <h2 style="color:#1a1a1a;margin:0;">CASA</h2>
              <p style="color:#888;margin:4px 0 0;">Comunidad Anglicana San Andres</p>
            </div>

            <div style="padding:24px 0;">
              <p>Hola <strong>${musician.displayName}</strong>,</p>

              <p>Te compartimos el paquete musical para el servicio del <strong>${formattedDate}</strong>${versionLabel}.</p>

              <h3 style="color:#333;margin-top:24px;">Canciones:</h3>
              <div style="padding:12px 16px;background:#f8f8f8;border-radius:8px;line-height:1.8;">
                ${songListHtml}
              </div>

              <div style="margin-top:24px;text-align:center;">
                ${packetSection}
              </div>

              <p style="margin-top:24px;">Por favor, revisa las partituras y confirma tu asistencia.</p>

              <p>Gracias por tu servicio!</p>
            </div>

            <div style="border-top:1px solid #eee;padding-top:16px;text-align:center;">
              <p style="font-size:12px;color:#888;">
                CASA - Comunidad Anglicana San Andres<br>
                Santiago, Chile
              </p>
            </div>
          </div>
        `;

        // Send via Resend
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${FROM_NAME} <${FROM_EMAIL}>`,
            to: [musician.email],
            subject: emailSubject,
            html: emailHtml,
          }),
        });

        const resendData = await resendResponse.json();

        if (resendResponse.ok && resendData.id) {
          result.sent++;

          // Update delivery status
          if (deliveryId) {
            await supabase
              .from("music_packet_deliveries")
              .update({
                status: "sent",
                external_id: resendData.id,
                sent_at: new Date().toISOString(),
              })
              .eq("id", deliveryId);
          }

          // Also log to notification_logs for consistency
          await supabase.from("music_notification_logs").insert({
            recipient_id: musician.musicianId,
            notification_type: "schedule_published",
            channel: "email",
            subject: emailSubject,
            message_content: `Paquete musical enviado a ${musician.email}`,
            external_id: resendData.id,
            status: "sent",
            sent_at: new Date().toISOString(),
          });
        } else {
          result.failed++;
          const errorMsg = resendData.message || "Error desconocido de Resend";
          result.errors.push(`${musician.email}: ${errorMsg}`);

          // Update delivery status
          if (deliveryId) {
            await supabase
              .from("music_packet_deliveries")
              .update({
                status: "failed",
                error_message: errorMsg,
              })
              .eq("id", deliveryId);
          }
        }
      } catch (error) {
        result.failed++;
        const errorMsg =
          error instanceof Error ? error.message : "Error desconocido";
        result.errors.push(`${musician.email}: ${errorMsg}`);

        if (deliveryId) {
          await supabase
            .from("music_packet_deliveries")
            .update({
              status: "failed",
              error_message: errorMsg,
            })
            .eq("id", deliveryId);
        }
      }

      // Rate limiting: 500ms between emails
      if (musiciansToNotify.indexOf(musician) < musiciansToNotify.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error interno del servidor";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
