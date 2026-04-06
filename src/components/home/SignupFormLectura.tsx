import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { submitSignup } from '@/lib/signup';

const formSchema = z.object({
  full_name: z.string().min(2, 'El nombre es requerido'),
  email: z.string().email('Correo electronico invalido'),
  phone: z.string().optional(),
  _honey: z.string().optional(),
  _timestamp: z.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface SignupFormLecturaProps {
  onSuccess: () => void;
}

export function SignupFormLectura({ onSuccess }: SignupFormLecturaProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: '',
      email: '',
      phone: '',
      _honey: '',
      _timestamp: undefined,
    },
  });

  useEffect(() => {
    form.setValue('_timestamp', Date.now());
  }, [form]);

  const onSubmit = async (data: FormValues) => {
    const result = await submitSignup({
      form_type: 'club_lectura',
      full_name: data.full_name,
      email: data.email,
      phone: data.phone || undefined,
      _honey: data._honey || undefined,
      _timestamp: data._timestamp,
    });

    if (result.status === 'success') {
      toast.success('¡Inscripcion registrada!');
      form.reset();
      setTimeout(onSuccess, 1200);
    } else if (result.status === 'duplicate') {
      toast.info('Ya estas inscrito/a en este programa. No es necesario inscribirse nuevamente.');
    } else {
      toast.error(result.message);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre Completo</FormLabel>
              <FormControl>
                <Input placeholder="Tu nombre completo" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Correo Electronico</FormLabel>
              <FormControl>
                <Input placeholder="tu@ejemplo.com" type="email" {...field} />
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
              <FormLabel>Telefono (opcional)</FormLabel>
              <FormControl>
                <Input placeholder="+56 9 1234 5678" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Honeypot field — hidden from users */}
        <input
          type="text"
          style={{ display: 'none' }}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          {...form.register('_honey')}
        />

        <Button
          type="submit"
          className="w-full bg-[#D4A853] hover:bg-[#B8923D] text-white"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? 'Enviando...' : 'Inscribirme'}
        </Button>
      </form>
    </Form>
  );
}
