
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PrayerRequestData {
  request: string;
  name?: string;
  isAnonymous: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { request, name, isAnonymous }: PrayerRequestData = await req.json();

    if (!request) {
      throw new Error("Se requiere una petición de oración");
    }

    console.log(`Procesando petición de oración${!isAnonymous ? ` de: ${name}` : ' anónima'}`);

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
    const destinationEmail = "brentcurtis76@gmail.com";

    try {
      console.log(`Enviando email a: ${destinationEmail} con asunto: Nueva petición de oración${!isAnonymous ? ` de ${name}` : ''}`);
      
      const emailResponse = await resend.emails.send({
        from: "Anglicana San Andrés <onboarding@resend.dev>",
        to: [destinationEmail],
        subject: `Nueva petición de oración${!isAnonymous ? ` de ${name}` : ' anónima'}`,
        html: `
          <h1>Nueva petición de oración</h1>
          ${!isAnonymous ? `<p><strong>De:</strong> ${name}</p>` : '<p><strong>Petición anónima</strong></p>'}
          <p><strong>Petición:</strong> ${request}</p>
        `,
      });

      console.log("Respuesta completa de Resend:", JSON.stringify(emailResponse, null, 2));

      if (emailResponse.error) {
        console.error("Error en la respuesta de Resend:", emailResponse.error);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Error al enviar el email: ${emailResponse.error.message || "Error desconocido"}`,
            details: emailResponse.error
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

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Petición de oración recibida correctamente",
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
          error: `Error al enviar el email: ${emailError.message || "Error desconocido"}`,
          stack: emailError.stack
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
    console.error("Error en la función prayer-request:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Error desconocido",
        stack: error.stack
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
