// Send Email Notifications for La Mesa Abierta
// Sends assignment emails to hosts and guests after matching
// Uses Resend API (3,000 emails/month free)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "onboarding@resend.dev";
const FROM_NAME = Deno.env.get("FROM_NAME") || "CASA - La Mesa Abierta";

interface NotificationRequest {
  monthId: string;
}

serve(async (req) => {
  try {
    // CORS headers
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        },
      });
    }

    // Validate Resend is configured
    if (!RESEND_API_KEY) {
      throw new Error("Resend API key not configured");
    }

    // Parse request
    const { monthId }: NotificationRequest = await req.json();

    if (!monthId) {
      return new Response(
        JSON.stringify({ success: false, error: "monthId is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get month details
    const { data: month, error: monthError } = await supabase
      .from("mesa_abierta_months")
      .select("*")
      .eq("id", monthId)
      .single();

    if (monthError || !month) {
      throw new Error("Month not found");
    }

    if (month.status !== "matched") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Month must be in 'matched' status to send notifications",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get all matches for this month (simple query first)
    const { data: matches, error: matchesError } = await supabase
      .from("mesa_abierta_matches")
      .select("*")
      .eq("month_id", monthId);

    if (matchesError) {
      throw new Error(`Failed to fetch matches: ${matchesError.message}`);
    }

    console.log(`Found ${matches?.length || 0} matches`);

    // Get all participants (hosts and guests)
    const { data: participants, error: participantsError } = await supabase
      .from("mesa_abierta_participants")
      .select("*")
      .eq("month_id", monthId);

    if (participantsError) {
      throw new Error(`Failed to fetch participants: ${participantsError.message}`);
    }

    console.log(`Found ${participants?.length || 0} participants`);

    // Create a map of participant_id => participant
    const participantMap = new Map();
    for (const participant of participants || []) {
      participantMap.set(participant.id, participant);
    }

    // Get all assignments for these matches
    const matchIds = (matches || []).map(m => m.id);
    const { data: assignments, error: assignmentsError } = await supabase
      .from("mesa_abierta_assignments")
      .select("*")
      .in("match_id", matchIds);

    if (assignmentsError) {
      throw new Error(`Failed to fetch assignments: ${assignmentsError.message}`);
    }

    console.log(`Found ${assignments?.length || 0} assignments`);

    // Group assignments by match_id
    const assignmentsByMatch = new Map();
    for (const assignment of assignments || []) {
      if (!assignmentsByMatch.has(assignment.match_id)) {
        assignmentsByMatch.set(assignment.match_id, []);
      }
      assignmentsByMatch.get(assignment.match_id).push(assignment);
    }

    // Get all user IDs we need to fetch from participants
    const userIds = new Set<string>();
    for (const participant of participants || []) {
      if (participant.user_id) {
        userIds.add(participant.user_id);
      }
    }

    console.log(`Need to fetch ${userIds.size} users`);

    // Fetch users using RPC to database function
    // This is a workaround since auth.admin API doesn't work properly in Edge Functions
    const userIdsArray = Array.from(userIds);
    console.log(`Fetching users via RPC:`, userIdsArray);

    const { data: users, error: usersError } = await supabase
      .rpc('get_users_by_ids', { user_ids: userIdsArray });

    console.log(`RPC result - users:`, users, `error:`, usersError);

    if (usersError) {
      // If the function doesn't exist, create a helpful error
      if (usersError.message?.includes('function') || usersError.message?.includes('does not exist')) {
        throw new Error('Database function get_users_by_ids not found. Please run the migration: supabase/migrations/20250111_get_users_by_ids_function.sql');
      }
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    // Create user map from results
    const userMap = new Map();
    for (const user of users || []) {
      userMap.set(user.id, user);
    }

    console.log(`Successfully fetched ${userMap.size} users`);

    let emailsSent = 0;
    let emailsFailed = 0;
    const emailLogs: any[] = [];

    console.log(`Processing ${matches?.length || 0} matches`);

    // Send emails to each match
    for (const match of matches || []) {
      console.log(`Processing match ${match.id}`);

      // Get host participant from the map
      const hostParticipant = participantMap.get(match.host_participant_id);
      console.log(`Host participant:`, hostParticipant);

      if (!hostParticipant) {
        console.error(`Host participant not found for match ${match.id}`);
        emailsFailed++;
        continue;
      }

      const hostUser = userMap.get(hostParticipant.user_id);
      console.log(`Host user from map:`, hostUser);

      const hostEmail = hostUser?.email;
      const hostName = hostUser?.raw_user_meta_data?.full_name || "Anfitrión";

      if (!hostEmail) {
        console.error(`Host email not found for match ${match.id}`);
        emailsFailed++;
        continue;
      }

      console.log(`Sending email to host: ${hostEmail}`);

      // Get assignments for this match
      const matchAssignments = assignmentsByMatch.get(match.id) || [];

      // Prepare guest list for host email (NO NAMES - keep anonymous!)
      const guestList = matchAssignments.map((assignment: any, index: number) => {
        const guestParticipant = participantMap.get(assignment.guest_participant_id);
        const plusOne = guestParticipant?.has_plus_one ? " (+1 acompañante)" : "";
        const food = assignment.food_assignment !== "none" ? `${translateFoodAssignment(assignment.food_assignment)}` : "Sin asignación";
        return `Invitado ${index + 1}${plusOne}: ${food}`;
      });

      // Send email to host
      const hostEmailResult = await sendHostEmail({
        to: hostEmail,
        hostName,
        dinnerDate: match.dinner_date,
        dinnerTime: match.dinner_time,
        guestList,
        guestCount: matchAssignments.length,
        hostFoodAssignment: match.host_food_assignment,
      });

      if (hostEmailResult.success) {
        emailsSent++;
        // Log email
        await supabase.from("mesa_abierta_email_logs").insert({
          month_id: monthId,
          participant_id: hostParticipant.id,
          email_type: "assignment",
          recipient_email: hostEmail,
          subject: "Tu asignación para La Mesa Abierta",
          status: "sent",
          sendgrid_message_id: hostEmailResult.messageId, // Using same field for Resend ID
        });
      } else {
        emailsFailed++;
        console.error(`Failed to send email to host ${hostEmail}:`, hostEmailResult.error);
      }

      // Rate limit: Resend allows 2 requests/second, so wait 500ms between emails
      await new Promise(resolve => setTimeout(resolve, 500));

      // Calculate total people at dinner (host + guests + plus ones)
      let totalPeopleAtDinner = 1; // Start with host
      for (const assignment of matchAssignments) {
        const guestParticipant = participantMap.get(assignment.guest_participant_id);
        if (guestParticipant) {
          totalPeopleAtDinner += 1; // The guest
          if (guestParticipant.has_plus_one) {
            totalPeopleAtDinner += 1; // Their plus one
          }
        }
      }

      // Send emails to each guest
      for (const assignment of matchAssignments) {
        const guestParticipant = participantMap.get(assignment.guest_participant_id);

        if (!guestParticipant) {
          console.error(`Guest participant not found for assignment ${assignment.id}`);
          emailsFailed++;
          continue;
        }

        const guestUser = userMap.get(guestParticipant.user_id);
        const guestEmail = guestUser?.email;
        const guestName = guestUser?.raw_user_meta_data?.full_name || "Invitado";

        if (!guestEmail) {
          console.error(`Guest email not found for assignment ${assignment.id}`);
          emailsFailed++;
          continue;
        }

        const guestEmailResult = await sendGuestEmail({
          to: guestEmail,
          guestName,
          hostName,
          hostAddress: hostParticipant.host_address || "Por confirmar",
          hostPhone: hostParticipant.phone_number || "Por confirmar",
          dinnerDate: match.dinner_date,
          dinnerTime: match.dinner_time,
          foodAssignment: assignment.food_assignment,
          totalPeople: totalPeopleAtDinner,
        });

        if (guestEmailResult.success) {
          emailsSent++;
          // Log email and mark notification as sent
          await supabase.from("mesa_abierta_email_logs").insert({
            month_id: monthId,
            participant_id: guestParticipant.id,
            email_type: "assignment",
            recipient_email: guestEmail,
            subject: "Tu asignación para La Mesa Abierta",
            status: "sent",
            sendgrid_message_id: guestEmailResult.messageId,
          });

          await supabase
            .from("mesa_abierta_assignments")
            .update({
              notification_sent: true,
              notification_sent_at: new Date().toISOString(),
            })
            .eq("id", assignment.id);
        } else {
          emailsFailed++;
          console.error(`Failed to send email to guest ${guestEmail}:`, guestEmailResult.error);
        }

        // Rate limit: Resend allows 2 requests/second, so wait 500ms between emails
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notifications sent successfully`,
        results: {
          emailsSent,
          emailsFailed,
          totalMatches: matches?.length || 0,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

// Helper function to send email via Resend
async function sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [to],
        subject,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || JSON.stringify(data) };
    }

    return { success: true, messageId: data.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Send email to host
async function sendHostEmail(data: {
  to: string;
  hostName: string;
  dinnerDate: string;
  dinnerTime: string;
  guestList: string[];
  guestCount: number;
  hostFoodAssignment?: string;
}) {
  const subject = "Tu asignación como Anfitrión - La Mesa Abierta";

  // Host food assignment text
  const hostFoodText = data.hostFoodAssignment
    ? `<p><strong>Tu contribución:</strong> ${translateFoodAssignment(data.hostFoodAssignment)}</p>`
    : "";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #000000; background-color: #ffffff; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ffffff; color: #000000; padding: 30px 20px; text-align: center; border-bottom: 2px solid #000000; }
        .header img { max-width: 100px; margin-bottom: 15px; }
        .header h1 { margin: 0; font-size: 28px; color: #000000; }
        .header p { margin: 5px 0 0 0; font-size: 14px; color: #000000; }
        .content { padding: 30px 20px; background: #ffffff; }
        .content h2 { color: #000000; margin-top: 0; }
        .guest-list { background: #f5f5f5; padding: 20px; margin: 20px 0; border: 1px solid #000000; }
        .guest-list h3 { margin-top: 0; color: #000000; }
        .guest-list ul { list-style: none; padding: 0; margin: 0; }
        .guest-list li { padding: 10px 0; border-bottom: 1px solid #cccccc; }
        .guest-list li:last-child { border-bottom: none; }
        .content ul { padding-left: 20px; }
        .content ul li { margin: 8px 0; }
        .footer { text-align: center; padding: 20px; color: #666666; font-size: 12px; border-top: 1px solid #cccccc; }
        .host-contribution { background: #e8f5e9; padding: 15px; margin: 15px 0; border: 1px solid #4caf50; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://mulsqxfhxxdsadxsljss.supabase.co/storage/v1/object/sign/Media/La%20Mesa%20Abierta%20Logo.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84N2ZkZDdiMi1lYjczLTRhZWItOGNmZS0yOTZjODQ3M2ExYzAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJNZWRpYS9MYSBNZXNhIEFiaWVydGEgTG9nby5wbmciLCJpYXQiOjE3NjI4OTQxNzQsImV4cCI6MTg0MDY1NDE3NH0.iAn0riDQJ-EZXSxDBk_5VjckQbBhLzX6l4bDQ6xKCeM" alt="La Mesa Abierta Logo" />
          <h1>La Mesa Abierta</h1>
          <p>Tu asignación como Anfitrión</p>
        </div>
        <div class="content">
          <h2>¡Hola ${data.hostName}!</h2>
          <p>Gracias por ofrecerte como anfitrión para La Mesa Abierta. Te hemos asignado <strong>${data.guestCount} invitados</strong> para tu cena.</p>

          <p><strong>Fecha:</strong> ${new Date(data.dinnerDate).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p><strong>Hora:</strong> ${data.dinnerTime}</p>
          ${hostFoodText ? `<div class="host-contribution">${hostFoodText}</div>` : ""}

          <div class="guest-list">
            <h3>Tus invitados:</h3>
            <ul>
              ${data.guestList.map(guest => `<li>${guest}</li>`).join('')}
            </ul>
          </div>

          <p><strong>Próximos pasos:</strong></p>
          <ul>
            <li>Los invitados recibirán tu dirección para confirmar su asistencia</li>
            <li>Prepara tu hogar para recibir a tus invitados</li>
            <li>Revisa las restricciones alimentarias indicadas</li>
          </ul>

          <p>¡Que disfrutes de una hermosa velada llena de comunidad y conexión!</p>
        </div>
        <div class="footer">
          <p>CASA - Comunidad de Amor, Servicio y Adoración</p>
          <p>sanandres@iach.cl | +56 9 4162 3577</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(data.to, subject, html);
}

// Send email to guest
async function sendGuestEmail(data: {
  to: string;
  guestName: string;
  hostName: string;
  hostAddress: string;
  hostPhone: string;
  dinnerDate: string;
  dinnerTime: string;
  foodAssignment: string;
  totalPeople: number;
}) {
  const subject = "Tu asignación como Invitado - La Mesa Abierta";

  const foodText = data.foodAssignment !== "none"
    ? `<p><strong>Tu contribución:</strong> ${translateFoodAssignmentWithCount(data.foodAssignment, data.totalPeople)}</p>`
    : "";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #000000; background-color: #ffffff; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ffffff; color: #000000; padding: 30px 20px; text-align: center; border-bottom: 2px solid #000000; }
        .header img { max-width: 100px; margin-bottom: 15px; }
        .header h1 { margin: 0; font-size: 28px; color: #000000; }
        .header p { margin: 5px 0 0 0; font-size: 14px; color: #000000; }
        .content { padding: 30px 20px; background: #ffffff; }
        .content h2 { color: #000000; margin-top: 0; }
        .info-box { background: #f5f5f5; padding: 20px; margin: 20px 0; border: 1px solid #000000; }
        .info-box h3 { margin-top: 0; color: #000000; }
        .info-box p { margin: 10px 0; }
        .content ul { padding-left: 20px; }
        .content ul li { margin: 8px 0; }
        .footer { text-align: center; padding: 20px; color: #666666; font-size: 12px; border-top: 1px solid #cccccc; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://mulsqxfhxxdsadxsljss.supabase.co/storage/v1/object/sign/Media/La%20Mesa%20Abierta%20Logo.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84N2ZkZDdiMi1lYjczLTRhZWItOGNmZS0yOTZjODQ3M2ExYzAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJNZWRpYS9MYSBNZXNhIEFiaWVydGEgTG9nby5wbmciLCJpYXQiOjE3NjI4OTQxNzQsImV4cCI6MTg0MDY1NDE3NH0.iAn0riDQJ-EZXSxDBk_5VjckQbBhLzX6l4bDQ6xKCeM" alt="La Mesa Abierta Logo" />
          <h1>La Mesa Abierta</h1>
          <p>Tu asignación como Invitado</p>
        </div>
        <div class="content">
          <h2>¡Hola ${data.guestName}!</h2>
          <p>Ya te inscribimos para participar en nuestra próxima edición de La Mesa Abierta. ¡Prepárate para conocer gente nueva de CASA!</p>

          <div class="info-box">
            <h3>Detalles de la Cena</h3>
            <p><strong>Fecha:</strong> ${new Date(data.dinnerDate).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p><strong>Hora:</strong> ${data.dinnerTime}</p>
            <p><strong>Dirección:</strong> ${data.hostAddress}</p>
            ${foodText}
          </div>

          <p><strong>Recuerda:</strong> 🤫 La identidad del anfitrión y otros invitados es un misterio hasta que llegues. ¡Esa es la magia de La Mesa Abierta!</p>

          <p><strong>Próximos pasos:</strong></p>
          <ul>
            <li>Confirma tu asistencia directamente en la dirección indicada</li>
            <li>Prepara tu contribución para la cena</li>
            <li>¡Ven con una actitud abierta para conocer gente nueva!</li>
          </ul>

          <p>¡Esperamos que disfrutes de una hermosa velada llena de comunidad y conexión!</p>
        </div>
        <div class="footer">
          <p>CASA - Comunidad de Amor, Servicio y Adoración</p>
          <p>sanandres@iach.cl | +56 9 4162 3577</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(data.to, subject, html);
}

// Translate food assignment to Spanish (for host messages)
function translateFoodAssignment(assignment: string): string {
  const translations: Record<string, string> = {
    main_course: "Plato Principal",
    salad: "Ensalada",
    drinks: "Bebidas",
    dessert: "Postre",
    none: "Ninguna",
  };
  return translations[assignment] || assignment;
}

// Translate food assignment with person count (for guest messages)
function translateFoodAssignmentWithCount(assignment: string, totalPeople: number): string {
  const translations: Record<string, string> = {
    main_course: `Plato Principal para ${totalPeople} personas`,
    salad: `Ensalada para ${totalPeople} personas`,
    drinks: `Bebestibles para ${totalPeople} personas`,
    dessert: `Postre para ${totalPeople} personas`,
    none: "Ninguna",
  };
  return translations[assignment] || assignment;
}
