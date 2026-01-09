/**
 * LiturgiaForm - Formulario para ingresar datos de la liturgia
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Plus, Wand2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BiblePassageFetcher } from './BiblePassageFetcher';
import { LABELS } from './constants';
import type { LiturgiaInput, LecturaFetched } from './types';

interface LiturgiaFormProps {
  onGenerate: (liturgia: LiturgiaInput, lecturas: LecturaFetched[]) => void;
  isGenerating: boolean;
}

interface LecturaEntry {
  cita: string;
  fetched: LecturaFetched | null;
}

export const LiturgiaForm = ({ onGenerate, isGenerating }: LiturgiaFormProps) => {
  const [fecha, setFecha] = useState<Date | undefined>(getNextSunday());
  const [titulo, setTitulo] = useState('');
  const [resumen, setResumen] = useState('');
  const [lecturas, setLecturas] = useState<LecturaEntry[]>([
    { cita: '', fetched: null },
  ]);

  // Obtener el próximo domingo
  function getNextSunday(): Date {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + daysUntilSunday);
    return nextSunday;
  }

  // Agregar una nueva lectura
  const addLectura = () => {
    if (lecturas.length < 4) {
      setLecturas([...lecturas, { cita: '', fetched: null }]);
    }
  };

  // Eliminar una lectura
  const removeLectura = (index: number) => {
    if (lecturas.length > 1) {
      setLecturas(lecturas.filter((_, i) => i !== index));
    }
  };

  // Actualizar cita de una lectura
  const updateCita = (index: number, cita: string) => {
    const updated = [...lecturas];
    updated[index] = { ...updated[index], cita, fetched: null };
    setLecturas(updated);
  };

  // Actualizar lectura obtenida
  const updateFetched = (index: number, fetched: LecturaFetched) => {
    const updated = [...lecturas];
    updated[index] = { ...updated[index], fetched };
    setLecturas(updated);
  };

  // Verificar si el formulario está completo
  const isFormValid = () => {
    if (!fecha || !titulo.trim() || !resumen.trim()) return false;

    // Al menos una lectura debe estar completa
    const hasValidLectura = lecturas.some(
      (l) => l.fetched && l.fetched.texto.trim()
    );

    return hasValidLectura;
  };

  // Manejar submit
  const handleSubmit = () => {
    if (!fecha || !isFormValid()) return;

    const liturgiaInput: LiturgiaInput = {
      fecha,
      titulo: titulo.trim(),
      resumen: resumen.trim(),
      lecturas: lecturas
        .filter((l) => l.fetched)
        .map((l) => l.fetched!.cita),
    };

    const lecturasData = lecturas
      .filter((l) => l.fetched && l.fetched.texto)
      .map((l) => l.fetched!);

    onGenerate(liturgiaInput, lecturasData);
  };

  const completedLecturas = lecturas.filter(l => l.fetched && l.fetched.texto).length;

  return (
    <Card className="border-gray-200">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-light text-gray-900">
          Datos de la Liturgia
        </CardTitle>
        <CardDescription>
          Completa la información para generar las oraciones antifonales
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Fecha y Título */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Selector de fecha */}
          <div className="space-y-2">
            <Label htmlFor="fecha" className="text-sm font-medium">
              Fecha de la liturgia
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="fecha"
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !fecha && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {fecha ? (
                    format(fecha, "EEEE d 'de' MMMM, yyyy", { locale: es })
                  ) : (
                    <span>Selecciona una fecha</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fecha}
                  onSelect={setFecha}
                  locale={es}
                  initialFocus
                  // Resaltar domingos
                  modifiers={{
                    sunday: (date) => date.getDay() === 0,
                  }}
                  modifiersStyles={{
                    sunday: { fontWeight: 'bold', color: '#D4A853' },
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="titulo" className="text-sm font-medium">
              Título de la reflexión
            </Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={LABELS.placeholders.titulo}
            />
          </div>
        </div>

        {/* Resumen */}
        <div className="space-y-2">
          <Label htmlFor="resumen" className="text-sm font-medium">
            Resumen / Enfoque temático
          </Label>
          <Textarea
            id="resumen"
            value={resumen}
            onChange={(e) => setResumen(e.target.value)}
            placeholder={LABELS.placeholders.resumen}
            rows={3}
            className="resize-none"
          />
        </div>

        {/* Lecturas Bíblicas */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Lecturas bíblicas
              {completedLecturas > 0 && (
                <span className="ml-2 text-xs text-green-600">
                  ({completedLecturas} cargada{completedLecturas > 1 ? 's' : ''})
                </span>
              )}
            </Label>
            {lecturas.length < 4 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={addLectura}
                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              >
                <Plus className="h-4 w-4 mr-1" />
                {LABELS.buttons.addLectura}
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {lecturas.map((lectura, index) => (
              <BiblePassageFetcher
                key={index}
                index={index}
                cita={lectura.cita}
                lectura={lectura.fetched}
                onCitaChange={(cita) => updateCita(index, cita)}
                onLecturaFetched={(fetched) => updateFetched(index, fetched)}
                onRemove={() => removeLectura(index)}
                canRemove={lecturas.length > 1}
              />
            ))}
          </div>
        </div>

        {/* Botón Generar */}
        <div className="pt-4 border-t border-gray-100">
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid() || isGenerating}
            className="w-full bg-gray-900 hover:bg-gray-800 h-12 text-base"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {LABELS.status.generating}
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-5 w-5" />
                {LABELS.buttons.generate}
              </>
            )}
          </Button>

          {!isFormValid() && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              Completa todos los campos y carga al menos una lectura bíblica
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default LiturgiaForm;
