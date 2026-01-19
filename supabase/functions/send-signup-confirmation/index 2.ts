import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SignupConfirmationRequest {
  participantId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { participantId }: SignupConfirmationRequest = await req.json();

    if (!participantId) {
      throw new Error("participantId is required");
    }

    // Fetch participant details
    const { data: participant, error: participantError } = await supabaseClient
      .from("mesa_abierta_participants")
      .select(`
        id,
        email,
        role_preference,
        has_plus_one,
        mesa_abierta_months!inner(
          dinner_date,
          dinner_time,
          registration_deadline
        ),
        profiles!inner(
          full_name
        )
      `)
      .eq("id", participantId)
      .single();

    if (participantError || !participant) {
      throw new Error("Participant not found");
    }

    const participantName = participant.profiles.full_name;
    const participantEmail = participant.email;
    const rolePreference = participant.role_preference;
    const hasPlusOne = participant.has_plus_one;
    const dinnerDate = participant.mesa_abierta_months.dinner_date;
    const dinnerTime = participant.mesa_abierta_months.dinner_time;
    const registrationDeadline = participant.mesa_abierta_months.registration_deadline;

    // Send confirmation email
    const emailResult = await sendConfirmationEmail({
      to: participantEmail,
      name: participantName,
      rolePreference,
      hasPlusOne,
      dinnerDate,
      dinnerTime,
      registrationDeadline,
    });

    if (!emailResult.success) {
      throw new Error(`Failed to send email: ${emailResult.error}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Confirmation email sent successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

async function sendEmail(to: string, subject: string, html: string) {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "La Mesa Abierta <noreply@relajona.cl>",
        to: [to],
        subject,
        html,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, data };
    } else {
      const error = await res.text();
      return { success: false, error };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function sendConfirmationEmail(data: {
  to: string;
  name: string;
  rolePreference: string;
  hasPlusOne: boolean;
  dinnerDate: string;
  dinnerTime: string;
  registrationDeadline: string;
}) {
  const subject = "¡Inscripción Confirmada! - La Mesa Abierta";

  const roleText = data.rolePreference === "host"
    ? "como <strong>anfitrión(a)</strong>"
    : data.hasPlusOne
    ? "como <strong>invitado(a) + 1 acompañante</strong>"
    : "como <strong>invitado(a)</strong>";

  const deadlineDate = new Date(data.registrationDeadline);
  const formattedDeadline = deadlineDate.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  const dinnerDateObj = new Date(data.dinnerDate + "T" + data.dinnerTime);
  const formattedDinnerDate = dinnerDateObj.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #000000; background-color: #ffffff; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ffffff; color: #000000; padding: 30px 20px; text-align: center; border-bottom: 2px solid #000000; }
        .header img { max-width: 120px; margin-bottom: 15px; }
        .header h1 { margin: 0; font-size: 28px; color: #000000; }
        .header p { margin: 5px 0 0 0; font-size: 14px; color: #666666; }
        .content { padding: 30px 20px; background: #ffffff; }
        .content h2 { color: #000000; margin-top: 0; }
        .info-box { background: #f5f5f5; padding: 20px; margin: 20px 0; border-left: 4px solid #000000; }
        .info-box h3 { margin-top: 0; color: #000000; }
        .info-box p { margin: 10px 0; }
        .highlight { background: #fff3cd; padding: 15px; margin: 20px 0; border-left: 4px solid #ffc107; }
        .content ul { padding-left: 20px; }
        .content ul li { margin: 8px 0; }
        .footer { text-align: center; padding: 20px; color: #666666; font-size: 12px; border-top: 1px solid #cccccc; }
        .button { display: inline-block; padding: 12px 30px; background-color: #000000; color: #ffffff; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://mulsqxfhxxdsadxsljss.supabase.co/storage/v1/object/sign/Media/La%20Mesa%20Abierta%20Logo.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84N2ZkZDdiMi1lYjczLTRhZWItOGNmZS0yOTZjODQ3M2ExYzAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJNZWRpYS9MYSBNZXNhIEFiaWVydGEgTG9nby5wbmciLCJpYXQiOjE3NjI4OTQxNzQsImV4cCI6MTg0MDY1NDE3NH0.iAn0riDQJ-EZXSxDBk_5VjckQbBhLzX6l4bDQ6xKCeM" alt="La Mesa Abierta Logo" />
          <h1>La Mesa Abierta</h1>
          <p>Confirmación de Inscripción</p>
        </div>
        <div class="content">
          <h2>¡Hola ${data.name}!</h2>
          <p>Confirmamos que te has inscrito exitosamente ${roleText} para nuestra próxima edición de La Mesa Abierta.</p>

          <div class="info-box">
            <h3>📅 Detalles del Evento</h3>
            <p><strong>Fecha de la cena:</strong> ${formattedDinnerDate}</p>
            <p><strong>Hora:</strong> ${data.dinnerTime}</p>
            <p><strong>Tu rol:</strong> ${data.rolePreference === "host" ? "Anfitrión(a)" : "Invitado(a)"}${data.hasPlusOne ? " + 1 acompañante" : ""}</p>
          </div>

          <div class="highlight">
            <p><strong>⏰ Fecha límite de inscripción:</strong> ${formattedDeadline}</p>
            <p style="margin: 5px 0 0 0; font-size: 14px;">Después de esta fecha no se aceptarán más inscripciones y se realizará el emparejamiento.</p>
          </div>

          <h3>¿Qué sigue ahora?</h3>
          <ul>
            <li><strong>El lunes anterior al evento</strong> recibirás un email con los detalles completos de tu cena</li>
            ${data.rolePreference === "host"
              ? "<li>Como anfitrión, recibirás información sobre tus invitados y las restricciones alimentarias</li>"
              : "<li>Como invitado, recibirás la dirección del anfitrión y tu asignación de comida</li>"}
            <li>Recuerda: ¡la identidad de los demás participantes es un misterio hasta que llegues! 🤫</li>
          </ul>

          <p><strong>¿Necesitas cancelar o modificar tu inscripción?</strong></p>
          <p>Puedes gestionar tu participación desde tu panel de usuario en cualquier momento antes de la fecha límite de inscripción.</p>

          <a href="https://relajona.cl/mesa-abierta/dashboard" class="button">Ver Mi Participación</a>

          <p style="margin-top: 30px;">¡Esperamos que disfrutes de una hermosa velada llena de comunidad y conexión!</p>
        </div>
        <div class="footer">
          <p>CASA - Comunidad de Amor, Servicio y Adoración</p>
          <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(data.to, subject, html);
}
