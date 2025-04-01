
import { useState } from "react";
import { Send } from "lucide-react";
import { InstagramIcon, TikTokIcon, YoutubeIcon } from "@/components/icons/SocialIcons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(2, {
    message: "El nombre debe tener al menos 2 caracteres.",
  }),
  phone: z.string().min(8, {
    message: "Por favor ingrese un número de teléfono válido.",
  }),
});

export function InstagramFeed() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      phone: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setSubmitError(null);
    setSubmitSuccess(false);
    
    try {
      setIsSubmitting(true);
      console.log("Enviando solicitud...", values);

      const { data, error } = await supabase.functions.invoke("whatsapp-signup", {
        body: { name: values.name, phone: values.phone }
      });

      if (error) {
        throw new Error(`Error al enviar el formulario: ${error.message}`);
      }

      console.log("Respuesta:", data);
      
      if (!data.success) {
        throw new Error(data.error || "Error al procesar la solicitud");
      }

      setSubmitSuccess(true);
      toast({
        title: "¡Solicitud enviada!",
        description: "Gracias por unirte a nuestra lista de difusión.",
      });

      form.reset();
    } catch (error) {
      console.error("Error:", error);
      const errorMessage = error instanceof Error ? error.message : "Ocurrió un error inesperado";
      setSubmitError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error al enviar",
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="section bg-white" id="redes-sociales">
      <div className="container-custom">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold text-casa-700 mb-8">
              Síguenos en redes sociales
            </h2>
            
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-casa-600">Nuestras redes</h3>
              
              <div className="flex flex-col space-y-4">
                <a 
                  href="https://www.instagram.com/anglicanasanandres" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-md hover:bg-gray-100 transition-colors"
                >
                  <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white p-2 rounded-full w-10 h-10 flex items-center justify-center">
                    <InstagramIcon />
                  </div>
                  <span className="font-medium">@anglicanasanandres</span>
                </a>
                
                <a 
                  href="https://www.tiktok.com/@anglicanasanandres" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-md hover:bg-gray-100 transition-colors"
                >
                  <div className="bg-black text-white p-2 rounded-full w-10 h-10 flex items-center justify-center">
                    <TikTokIcon />
                  </div>
                  <span className="font-medium">@anglicanasanandres</span>
                </a>
                
                <a 
                  href="https://www.youtube.com/c/ComunidadAnglicanaSanAndrés" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-md hover:bg-gray-100 transition-colors"
                >
                  <div className="bg-red-600 text-white p-2 rounded-full w-10 h-10 flex items-center justify-center">
                    <YoutubeIcon />
                  </div>
                  <span className="font-medium">Comunidad Anglicana San Andrés</span>
                </a>
              </div>
            </div>
          </div>

          <div className="bg-casa-50 p-6 rounded-lg shadow-sm">
            <h3 className="text-xl font-semibold text-casa-600 mb-4">
              Únete a nuestra lista de difusión de WhatsApp
            </h3>
            
            {submitError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}
            
            {submitSuccess && (
              <Alert className="mb-4 bg-green-50 border-green-200">
                <AlertTitle className="text-green-700">¡Solicitud enviada!</AlertTitle>
                <AlertDescription className="text-green-600">
                  Gracias por unirte a nuestra lista de difusión.
                </AlertDescription>
              </Alert>
            )}
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="Tu nombre" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono</FormLabel>
                      <FormControl>
                        <Input placeholder="+56 9 xxxxxxxx" {...field} />
                      </FormControl>
                      <FormDescription>
                        Incluya el código de país (+56 para Chile)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Enviando..." : "Unirse"}
                  <Send className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </section>
  );
}
