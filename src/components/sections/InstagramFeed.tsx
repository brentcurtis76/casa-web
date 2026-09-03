
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
import { motion } from "framer-motion";

const formSchema = z.object({
  name: z.string().min(2, {
    message: "El nombre debe tener al menos 2 caracteres.",
  }),
  phone: z.string().min(8, {
    message: "Por favor ingrese un número de teléfono válido.",
  }),
  // Honeypot: a real visitor never sees or fills this field. The whatsapp-signup
  // Function answers a silent 200 when it arrives with content. The field name
  // must match supabase/functions/whatsapp-signup/handler.ts.
  _honey: z.string().optional(),
});

const socialLinks = [
  {
    href: "https://www.instagram.com/anglicanasanandres",
    icon: InstagramIcon,
    label: "@anglicanasanandres",
    bgClass: "bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500"
  },
  {
    href: "https://www.tiktok.com/@anglicanasanandres",
    icon: TikTokIcon,
    label: "@anglicanasanandres",
    bgClass: "bg-black"
  },
  {
    href: "https://www.youtube.com/c/ComunidadAnglicanaSanAndrés",
    icon: YoutubeIcon,
    label: "Comunidad Anglicana San Andrés",
    bgClass: "bg-red-600"
  }
];

export function InstagramFeed() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  // Anti-bot timing metadata for the whatsapp-signup Function: when this form was
  // presented. Refreshed after a successful submission so the next one is timed
  // from the moment the empty form reappears. Client-supplied, so it only stops
  // naïve scripted posts — the Function treats it as one signal, not as proof.
  const [presentedAt, setPresentedAt] = useState<number>(() => Date.now());

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      phone: "",
      _honey: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      setIsSubmitting(true);
      // Privacy: the visitor's name and phone are never logged from the browser.

      const { data, error } = await supabase.functions.invoke("whatsapp-signup", {
        body: {
          name: values.name,
          phone: values.phone,
          _honey: values._honey ?? "",
          _timestamp: presentedAt,
        }
      });

      if (error) {
        throw new Error(`Error al enviar el formulario: ${error.message}`);
      }

      if (!data?.success) {
        throw new Error(data?.error || "Error al procesar la solicitud");
      }

      setSubmitSuccess(true);
      toast({
        title: "¡Solicitud enviada!",
        description: "Gracias por unirte a nuestra lista de difusión.",
      });

      form.reset();
      setPresentedAt(Date.now());
    } catch (error) {
      // No console output: the error may echo the submitted values or a raw
      // response body. The user-facing message below is all that is surfaced.
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
            <motion.h2
              className="text-2xl md:text-3xl font-bold text-casa-700 mb-8"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              Síguenos en redes sociales
            </motion.h2>

            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
            >
              <h3 className="text-xl font-semibold text-casa-600">Nuestras redes</h3>

              <div className="flex flex-col space-y-4">
                {socialLinks.map((link, index) => (
                  <motion.a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-md hover:bg-gray-100 transition-colors"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                    viewport={{ once: true }}
                    whileHover={{ x: 5 }}
                  >
                    <motion.div
                      className={`${link.bgClass} text-white p-2 rounded-full w-10 h-10 flex items-center justify-center`}
                      whileHover={{ scale: 1.1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <link.icon />
                    </motion.div>
                    <span className="font-medium">{link.label}</span>
                  </motion.a>
                ))}
              </div>
            </motion.div>
          </div>

          <motion.div
            className="bg-casa-50 p-6 rounded-lg shadow-sm"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            viewport={{ once: true }}
          >
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

                {/* Honeypot: out of the visual flow and the tab order, hidden from
                    assistive tech. Humans never fill it; form-filling bots do. */}
                <div
                  aria-hidden="true"
                  className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
                >
                  <label htmlFor="whatsapp-signup-honey">No completar este campo</label>
                  <input
                    id="whatsapp-signup-honey"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    {...form.register("_honey")}
                  />
                </div>

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
          </motion.div>
        </div>
      </div>
    </section>
  );
}
