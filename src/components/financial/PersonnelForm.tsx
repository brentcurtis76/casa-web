/**
 * PersonnelForm — Dialog form for adding/editing personnel.
 * Uses react-hook-form + zodResolver with personnelSchema.
 */

import { useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import CLPInput from './CLPInput';
import { personnelSchema, type PersonnelFormData } from '@/lib/financial/schemas';
import { formatRut, cleanRut } from '@/lib/financial/rutValidator';
import { useCreatePersonnel, useUpdatePersonnel } from '@/lib/financial/hooks';
import type { Personnel, ContractType } from '@/types/financial';

interface PersonnelFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personnel?: Personnel | null;
}

const AFP_OPTIONS = [
  'Capital', 'Cuprum', 'Habitat', 'Modelo', 'Planvital', 'ProVida', 'Uno',
];

const PersonnelForm = ({ open, onOpenChange, personnel }: PersonnelFormProps) => {
  const isEditing = !!personnel;
  const createMutation = useCreatePersonnel();
  const updateMutation = useUpdatePersonnel();

  const form = useForm<PersonnelFormData>({
    resolver: zodResolver(personnelSchema),
    defaultValues: {
      name: '',
      rut: '',
      role_position: '',
      contract_type: 'indefinido',
      gross_salary: 0,
      afp_name: null,
      isapre_name: null,
      bank_name: null,
      bank_account_number: null,
      start_date: null,
    },
  });

  const contractType = form.watch('contract_type');

  // Reset form when dialog opens with personnel data
  useEffect(() => {
    if (open) {
      if (personnel) {
        form.reset({
          name: personnel.name,
          rut: personnel.rut,
          role_position: personnel.role_position,
          contract_type: personnel.contract_type,
          gross_salary: personnel.gross_salary,
          afp_name: personnel.afp_name,
          isapre_name: personnel.isapre_name,
          bank_name: personnel.bank_name,
          bank_account_number: personnel.bank_account_number,
          start_date: personnel.start_date,
        });
      } else {
        form.reset({
          name: '',
          rut: '',
          role_position: '',
          contract_type: 'indefinido',
          gross_salary: 0,
          afp_name: null,
          isapre_name: null,
          bank_name: null,
          bank_account_number: null,
          start_date: null,
        });
      }
    }
  }, [open, personnel, form]);

  const handleRutBlur = useCallback(() => {
    const currentRut = form.getValues('rut');
    if (currentRut) {
      const cleaned = cleanRut(currentRut);
      if (cleaned.length >= 2) {
        form.setValue('rut', formatRut(cleaned), { shouldValidate: true });
      }
    }
  }, [form]);

  const onSubmit = useCallback(async (data: PersonnelFormData) => {
    // Clean the RUT before sending to service
    const cleanedData = {
      ...data,
      rut: cleanRut(data.rut),
      afp_name: data.contract_type === 'honorarios' ? null : data.afp_name,
    };

    if (isEditing && personnel) {
      await updateMutation.mutateAsync({ id: personnel.id, data: cleanedData });
    } else {
      await createMutation.mutateAsync(cleanedData as PersonnelFormData & { contract_type: ContractType });
    }
    onOpenChange(false);
  }, [isEditing, personnel, createMutation, updateMutation, onOpenChange]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Personal' : 'Agregar Personal'}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? 'Modifique los datos del personal.' : 'Complete los datos para registrar nuevo personal.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Juan Pérez" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rut"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>RUT</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="12.345.678-9"
                      {...field}
                      onBlur={(e) => {
                        field.onBlur();
                        handleRutBlur();
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role_position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cargo / Posición</FormLabel>
                  <FormControl>
                    <Input placeholder="Pastor Asociado" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contract_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de contrato</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="indefinido">Indefinido</SelectItem>
                      <SelectItem value="plazo_fijo">Plazo Fijo</SelectItem>
                      <SelectItem value="honorarios">Honorarios</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gross_salary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sueldo bruto mensual</FormLabel>
                  <FormControl>
                    <CLPInput
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="0"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {contractType !== 'honorarios' ? (
              <FormField
                control={form.control}
                name="afp_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>AFP</FormLabel>
                    <Select
                      value={field.value || undefined}
                      onValueChange={(v) => field.onChange(v || null)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar AFP" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {AFP_OPTIONS.map((afp) => (
                          <SelectItem key={afp} value={afp}>{afp}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <div className="text-sm text-gray-500 py-2">
                AFP: No aplica para contratos de honorarios
              </div>
            )}

            <FormField
              control={form.control}
              name="isapre_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Salud</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Fonasa o nombre de ISAPRE"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bank_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Banco (opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Banco Estado"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bank_account_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de cuenta (opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="123456789"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de inicio (opcional)</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Guardar' : 'Crear'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default PersonnelForm;
