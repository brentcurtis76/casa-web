
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WhatsappSignupRequest {
  name: string;
  phone: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, phone }: WhatsappSignupRequest = await req.json();

    if (!name || !phone) {
      throw new Error("Se requiere nombre y teléfono");
    }

    console.log(`Procesando solicitud para: ${name}, teléfono: ${phone}`);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("Error: La clave de API de Resend no está configurada.");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "La clave de API de Resend no está configurada" 
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    const resend = new Resend(resendApiKey);
    const destinationEmail = "sanandres@iach.cl";

    try {
      console.log(`Enviando email a: ${destinationEmail} con asunto: Agrega a ${name} a la lista de difusión de CASA`);
      
      const emailResponse = await resend.emails.send({
        from: "Anglicana San Andrés <onboarding@resend.dev>",
        to: [destinationEmail],
        subject: `Agrega a ${name} a la lista de difusión de CASA`,
        html: `
          <h1>Nueva solicitud para lista de difusión</h1>
          <p><strong>Nombre:</strong> ${name}</p>
          <p><strong>Teléfono:</strong> ${phone}</p>
          <p>Por favor agrega este contacto a la lista de difusión de WhatsApp.</p>
        `,
      });

      console.log("Email enviado exitosamente:", JSON.stringify(emailResponse));

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Solicitud recibida correctamente",
          emailStatus: emailResponse
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    } catch (emailError: any) {
      console.error("Error al enviar el email:", emailError);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Error al enviar el email: ${emailError.message || "Error desconocido"}` 
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }
  } catch (error: any) {
    console.error("Error en la función whatsapp-signup:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Error desconocido"
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
};

serve(handler);
