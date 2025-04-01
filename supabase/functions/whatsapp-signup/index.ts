
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
      // Fallback to direct response without email if API key is missing
      console.log("La clave de API de Resend no está configurada. Omitiendo el envío de correo electrónico.");
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Solicitud recibida correctamente (sin correo electrónico)"
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    const resend = new Resend(resendApiKey);
    const destinationEmail = "sanandres@iach.cl";

    const emailResponse = await resend.emails.send({
      from: "Anglicana San Andrés <onboarding@resend.dev>",
      to: [destinationEmail],
      subject: "Nueva solicitud para lista de difusión WhatsApp",
      html: `
        <h1>Nueva solicitud para lista de difusión</h1>
        <p><strong>Nombre:</strong> ${name}</p>
        <p><strong>Teléfono:</strong> ${phone}</p>
        <p>Por favor agrega este contacto a la lista de difusión de WhatsApp.</p>
      `,
    });

    console.log("Email enviado exitosamente:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Solicitud recibida correctamente"
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
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
