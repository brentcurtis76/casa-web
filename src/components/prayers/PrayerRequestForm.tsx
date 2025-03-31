
import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';
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
    },
  });

  const onSubmit = async (values: PrayerRequestFormValues) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    setIsLoading(true);
    try {
      // Simulamos envío - en una app real esto sería una llamada API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: '¡Petición enviada!',
        description: 'Tu petición de oración ha sido recibida.',
      });
      
      form.reset();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo enviar tu petición. Por favor, intenta de nuevo.',
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
