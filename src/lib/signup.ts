import { supabase } from '@/integrations/supabase/client';
import type { SignupFormData } from '@/types/signups';

export type SignupResult = {
  status: 'success' | 'duplicate' | 'error';
  message: string;
};

export async function submitSignup(data: SignupFormData): Promise<SignupResult> {
  const { data: responseData, error } = await supabase.functions.invoke('public-signup', {
    body: data,
  });

  if (error) {
    return {
      status: 'error',
      message: 'Ocurrio un error al procesar tu inscripcion. Intentalo de nuevo.',
    };
  }

  if (!responseData?.success) {
    return {
      status: 'error',
      message: responseData?.error || 'Ocurrio un error inesperado.',
    };
  }

  // Distinguish new signup from duplicate by checking the message
  const message: string = responseData.message || '';
  if (message.toLowerCase().includes('ya tienes')) {
    return { status: 'duplicate', message };
  }

  return { status: 'success', message };
}
