// Send WhatsApp Notifications for La Mesa Abierta
// Sends assignment WhatsApp messages to hosts and guests after matching
// Uses Twilio WhatsApp API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_WHATSAPP_NUMBER = Deno.env.get("TWILIO_WHATSAPP_NUMBER") || "whatsapp:+14155238886";

interface NotificationRequest {
  monthId: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate Twilio is configured
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error("Twilio credentials not configured");
    }

    // Parse request
    const { monthId }: NotificationRequest = await req.json();

    if (!monthId) {
      return new Response(
        JSON.stringify({ success: false, error: "monthId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all matches for this month
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
    const userIdsArray = Array.from(userIds);
    const { data: users, error: usersError } = await supabase
      .rpc('get_users_by_ids', { user_ids: userIdsArray });

    if (usersError) {
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

    let messagesSent = 0;
    let messagesFailed = 0;

    console.log(`Processing ${matches?.length || 0} matches`);

    // Send WhatsApp messages to each match
    for (const match of matches || []) {
      console.log(`Processing match ${match.id}`);

      // Get host participant from the map
      const hostParticipant = participantMap.get(match.host_participant_id);

      if (!hostParticipant) {
        console.error(`Host participant not found for match ${match.id}`);
        messagesFailed++;
        continue;
      }

      // Only send WhatsApp if enabled
      if (!hostParticipant.whatsapp_enabled || !hostParticipant.phone_number) {
        console.log(`Host ${hostParticipant.id} has WhatsApp disabled or no phone number`);
        continue;
      }

      const hostUser = userMap.get(hostParticipant.user_id);
      const hostName = hostUser?.raw_user_meta_data?.full_name || "Anfitrión";

      // Get assignments for this match
      const matchAssignments = assignmentsByMatch.get(match.id) || [];

      // Prepare guest list for host message (NO NAMES - keep anonymous!)
      const guestList = matchAssignments.map((assignment: any, index: number) => {
        const guestParticipant = participantMap.get(assignment.guest_participant_id);
        const plusOne = guestParticipant?.has_plus_one ? " (+1 acompañante)" : "";
        const food = assignment.food_assignment !== "none" ? `${translateFoodAssignment(assignment.food_assignment)}` : "Sin asignación";
        return `• Invitado ${index + 1}${plusOne}: ${food}`;
      });

      // Send WhatsApp to host
      const hostMessageResult = await sendWhatsAppMessage({
        to: formatPhoneNumber(hostParticipant.phone_number),
        message: buildHostMessage({
          hostName,
          dinnerDate: match.dinner_date,
          dinnerTime: match.dinner_time,
          guestList,
          guestCount: matchAssignments.length,
        }),
      });

      if (hostMessageResult.success) {
        messagesSent++;
        // Log WhatsApp message
        await supabase.from("mesa_abierta_whatsapp_messages").insert({
          month_id: monthId,
          participant_id: hostParticipant.id,
          message_type: "assignment",
          recipient_phone: hostParticipant.phone_number,
          status: "sent",
          twilio_message_sid: hostMessageResult.messageSid,
        });
      } else {
        messagesFailed++;
        console.error(`Failed to send WhatsApp to host ${hostParticipant.phone_number}:`, hostMessageResult.error);
      }

      // Rate limit: Twilio allows ~10 messages/second, but be conservative
      await new Promise(resolve => setTimeout(resolve, 500));

      // Send WhatsApp to each guest
      for (const assignment of matchAssignments) {
        const guestParticipant = participantMap.get(assignment.guest_participant_id);

        if (!guestParticipant) {
          console.error(`Guest participant not found for assignment ${assignment.id}`);
          messagesFailed++;
          continue;
        }

        // Only send WhatsApp if enabled
        if (!guestParticipant.whatsapp_enabled || !guestParticipant.phone_number) {
          console.log(`Guest ${guestParticipant.id} has WhatsApp disabled or no phone number`);
          continue;
        }

        const guestUser = userMap.get(guestParticipant.user_id);
        const guestName = guestUser?.raw_user_meta_data?.full_name || "Invitado";

        const guestMessageResult = await sendWhatsAppMessage({
          to: formatPhoneNumber(guestParticipant.phone_number),
          message: buildGuestMessage({
            guestName,
            hostName,
            hostAddress: hostParticipant.host_address || "Por confirmar",
            hostPhone: hostParticipant.phone_number || "Por confirmar",
            dinnerDate: match.dinner_date,
            dinnerTime: match.dinner_time,
            foodAssignment: assignment.food_assignment,
          }),
        });

        if (guestMessageResult.success) {
          messagesSent++;
          // Log WhatsApp message
          await supabase.from("mesa_abierta_whatsapp_messages").insert({
            month_id: monthId,
            participant_id: guestParticipant.id,
            message_type: "assignment",
            recipient_phone: guestParticipant.phone_number,
            status: "sent",
            twilio_message_sid: guestMessageResult.messageSid,
          });
        } else {
          messagesFailed++;
          console.error(`Failed to send WhatsApp to guest ${guestParticipant.phone_number}:`, guestMessageResult.error);
        }

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `WhatsApp notifications sent successfully`,
        results: {
          messagesSent,
          messagesFailed,
          totalMatches: matches?.length || 0,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper function to send WhatsApp message via Twilio
async function sendWhatsAppMessage(data: {
  to: string;
  message: string;
}): Promise<{ success: boolean; messageSid?: string; error?: string }> {
  try {
    const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: TWILIO_WHATSAPP_NUMBER,
          To: data.to,
          Body: data.message,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.message || JSON.stringify(result) };
    }

    return { success: true, messageSid: result.sid };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Format phone number for WhatsApp (add whatsapp: prefix and country code if needed)
function formatPhoneNumber(phone: string): string {
  // Remove any existing whatsapp: prefix
  let cleaned = phone.replace(/^whatsapp:/, "");

  // Remove all non-numeric characters except +
  cleaned = cleaned.replace(/[^\d+]/g, "");

  // Add + if not present
  if (!cleaned.startsWith("+")) {
    // Default to Chile (+56) if no country code
    cleaned = `+56${cleaned}`;
  }

  return `whatsapp:${cleaned}`;
}

// Build host WhatsApp message
function buildHostMessage(data: {
  hostName: string;
  dinnerDate: string;
  dinnerTime: string;
  guestList: string[];
  guestCount: number;
}): string {
  const date = new Date(data.dinnerDate).toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `🏠 *LA MESA ABIERTA*
¡Hola ${data.hostName}!

Gracias por ofrecerte como anfitrión. Te hemos asignado *${data.guestCount} invitados* para tu cena.

📅 *Fecha:* ${date}
⏰ *Hora:* ${data.dinnerTime}

👥 *Tus invitados:*
${data.guestList.join('\n')}

📋 *Próximos pasos:*
• Los invitados recibirán tu dirección y teléfono
• Prepara tu hogar para recibir a tus invitados
• Revisa las restricciones alimentarias indicadas

¡Que disfrutes de una hermosa velada llena de comunidad y conexión!

_CASA - Comunidad de Amor, Servicio y Adoración_`;
}

// Build guest WhatsApp message
function buildGuestMessage(data: {
  guestName: string;
  hostName: string;
  hostAddress: string;
  hostPhone: string;
  dinnerDate: string;
  dinnerTime: string;
  foodAssignment: string;
}): string {
  const date = new Date(data.dinnerDate).toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const foodText = data.foodAssignment !== "none"
    ? `🍽️ *Tu contribución:* ${translateFoodAssignment(data.foodAssignment)}\n\n`
    : "";

  return `🍽️ *LA MESA ABIERTA*
¡Hola ${data.guestName}!

Ya te inscribimos para participar en nuestra próxima edición de La Mesa Abierta. ¡Prepárate para conocer gente nueva de CASA!

📅 *Fecha:* ${date}
⏰ *Hora:* ${data.dinnerTime}
📍 *Dirección:* ${data.hostAddress}
📞 *Contacto:* ${data.hostPhone}

${foodText}🤫 *Recuerda:* La identidad del anfitrión y otros invitados es un misterio hasta que llegues. ¡Esa es la magia de La Mesa Abierta!

📋 *Próximos pasos:*
• Llama o escribe al anfitrión para confirmar tu asistencia
• Prepara tu contribución para la cena
• ¡Ven con una actitud abierta para conocer gente nueva!

¡Esperamos que disfrutes de una hermosa velada llena de comunidad y conexión!

_CASA - Comunidad de Amor, Servicio y Adoración_`;
}

// Translate food assignment to Spanish
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
