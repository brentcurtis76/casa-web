
import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const prayerRequestSchema = z.object({
  request: z.string().min(10, 'La petición debe tener al menos 10 caracteres').max(500, 'La petición no puede exceder los 500 caracteres'),
  name: z.string().optional(),
  isAnonymous: z.boolean().default(false),
});

type PrayerRequestFormValues = z.infer<typeof prayerRequestSchema>;

export function PrayerRequestForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const form = useForm<PrayerRequestFormValues>({
    resolver: zodResolver(prayerRequestSchema),
    defaultValues: {
      request: '',
      name: '',
      isAnonymous: false,
    },
  });

  const watchIsAnonymous = form.watch('isAnonymous');

  const onSubmit = async (values: PrayerRequestFormValues) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('prayer-request', {
        body: {
          request: values.request,
          name: values.isAnonymous ? undefined : values.name,
          isAnonymous: values.isAnonymous,
        },
      });

      if (error) {
        throw new Error(error.message || 'Error al enviar la petición de oración');
      }

      if (!data.success) {
        throw new Error(data.error || 'Error al procesar la petición de oración');
      }
      
      toast({
        title: '¡Petición enviada!',
        description: 'Tu petición de oración ha sido recibida.',
      });
      
      form.reset();
    } catch (error: any) {
      console.error('Error al enviar petición de oración:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo enviar tu petición. Por favor, intenta de nuevo.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="request"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tu petición de oración</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Comparte tu petición con nosotros..." 
                    className="min-h-[150px]" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isAnonymous"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 mb-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Enviar como anónimo</FormLabel>
                </div>
              </FormItem>
            )}
          />

          {!watchIsAnonymous && (
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tu nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading}
          >
            {isLoading ? 'Enviando...' : 'Enviar Petición'}
          </Button>
          
          {!user && (
            <p className="text-sm text-center text-muted-foreground mt-4">
              Debes iniciar sesión para enviar una petición de oración.
              <br />
              <Button 
                variant="link" 
                className="p-0 h-auto font-normal" 
                onClick={() => setIsAuthModalOpen(true)}
              >
                Iniciar sesión o crear una cuenta
              </Button>
            </p>
          )}
        </form>
      </Form>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)}
      />
    </>
  );
}
