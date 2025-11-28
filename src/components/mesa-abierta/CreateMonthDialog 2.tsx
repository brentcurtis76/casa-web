"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateMonthDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateMonthDialog({ open, onClose, onSuccess }: CreateMonthDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    dinnerDate: "",
    dinnerTime: "19:00",
    registrationDeadline: "",
    status: "open" as "open" | "closed" | "matched",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.dinnerDate) {
      toast.error("Por favor selecciona una fecha para la cena");
      return;
    }

    if (!formData.registrationDeadline) {
      toast.error("Por favor selecciona una fecha límite de inscripción");
      return;
    }

    // Validate that registration deadline is before dinner date
    const dinnerDateTime = new Date(formData.dinnerDate + "T" + formData.dinnerTime);
    const deadlineDateTime = new Date(formData.registrationDeadline);

    if (deadlineDateTime >= dinnerDateTime) {
      toast.error("La fecha límite de inscripción debe ser antes de la fecha de la cena");
      return;
    }

    setLoading(true);

    try {
      // Calculate month_date (first day of the month from dinner_date)
      const dinnerDate = new Date(formData.dinnerDate);
      const monthDate = new Date(dinnerDate.getFullYear(), dinnerDate.getMonth(), 1);
      const monthDateString = monthDate.toISOString().split('T')[0]; // YYYY-MM-DD format

      const { error } = await supabase.from("mesa_abierta_months").insert({
        month_date: monthDateString,
        dinner_date: formData.dinnerDate,
        dinner_time: formData.dinnerTime,
        registration_deadline: formData.registrationDeadline,
        status: formData.status,
      });

      if (error) throw error;

      toast.success("Mes creado exitosamente");
      onSuccess();
    } catch (error) {
      console.error("Error creating month:", error);
      toast.error("Error al crear el mes");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Crear Nuevo Mes
          </DialogTitle>
          <DialogDescription>
            Configura un nuevo mes para La Mesa Abierta. Los participantes podrán inscribirse después de crear el mes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dinnerDate">Fecha de la Cena</Label>
            <Input
              id="dinnerDate"
              type="date"
              value={formData.dinnerDate}
              onChange={(e) => setFormData({ ...formData, dinnerDate: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground">
              Recomendado: Último viernes del mes
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dinnerTime">Hora de la Cena</Label>
            <Input
              id="dinnerTime"
              type="time"
              value={formData.dinnerTime}
              onChange={(e) => setFormData({ ...formData, dinnerTime: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground">
              Hora por defecto: 19:00 (7:00 PM)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="registrationDeadline">Fecha Límite de Inscripción</Label>
            <Input
              id="registrationDeadline"
              type="datetime-local"
              value={formData.registrationDeadline}
              onChange={(e) => setFormData({ ...formData, registrationDeadline: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground">
              Recomendado: Lunes antes de la cena, 23:59
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Estado</Label>
            <Select
              value={formData.status}
              onValueChange={(value: "open" | "closed" | "matched") =>
                setFormData({ ...formData, status: value })
              }
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Abierto (permite inscripciones)</SelectItem>
                <SelectItem value="closed">Cerrado</SelectItem>
                <SelectItem value="matched">Emparejado</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Normalmente se inicia como "Abierto" para aceptar inscripciones
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear Mes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
