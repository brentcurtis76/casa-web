/**
 * BiblePassageFetcher - Componente para buscar y mostrar pasajes bíblicos
 */

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Search, X, BookOpen, Check, AlertCircle } from 'lucide-react';
import { LABELS } from './constants';
import {
  type LecturaFetched,
  type BibleVersion,
  type BiblePassageResponse,
  BIBLE_VERSIONS,
} from './types';

interface BiblePassageFetcherProps {
  index: number;
  cita: string;
  lectura: LecturaFetched | null;
  onCitaChange: (cita: string) => void;
  onLecturaFetched: (lectura: LecturaFetched) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export const BiblePassageFetcher = ({
  index,
  cita,
  lectura,
  onCitaChange,
  onLecturaFetched,
  onRemove,
  canRemove,
}: BiblePassageFetcherProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [version, setVersion] = useState<BibleVersion>('NVI');
  const [manualText, setManualText] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);

  const handleFetch = async () => {
    if (!cita.trim()) {
      toast({
        title: 'Error',
        description: 'Ingresa una cita bíblica',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke<BiblePassageResponse>(
        'fetch-bible-passage',
        {
          body: { reference: cita.trim(), version },
        }
      );

      if (error) throw error;

      if (!data?.success || !data.text) {
        throw new Error(data?.error || 'Error desconocido');
      }

      onLecturaFetched({
        cita: data.reference || cita,
        texto: data.text,
        version: data.version || version,
        versionCode: data.versionCode || version,
      });

      toast({
        title: 'Lectura encontrada',
        description: `${data.reference} (${data.version})`,
      });
    } catch (err) {
      console.error('Error fetching bible passage:', err);

      // Si falla la API, ofrecer entrada manual
      setIsManualMode(true);

      toast({
        title: 'No se pudo obtener el texto',
        description: 'Puedes ingresar el texto manualmente',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSave = () => {
    if (!cita.trim() || !manualText.trim()) {
      toast({
        title: 'Error',
        description: 'Completa la cita y el texto',
        variant: 'destructive',
      });
      return;
    }

    const versionInfo = BIBLE_VERSIONS.find(v => v.code === version);

    onLecturaFetched({
      cita: cita.trim(),
      texto: manualText.trim(),
      version: versionInfo?.name || version,
      versionCode: version,
    });

    setIsManualMode(false);
    setManualText('');

    toast({
      title: 'Lectura guardada',
      description: `${cita} agregada manualmente`,
    });
  };

  return (
    <Card className="border-gray-200">
      <CardContent className="p-4 space-y-4">
        {/* Header con número y botón eliminar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-amber-600" />
            <span className="font-medium text-sm">Lectura {index + 1}</span>
          </div>
          {canRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Cita y versión */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label htmlFor={`cita-${index}`} className="text-xs text-gray-600">
              Cita bíblica
            </Label>
            <Input
              id={`cita-${index}`}
              value={cita}
              onChange={(e) => onCitaChange(e.target.value)}
              placeholder={LABELS.placeholders.cita}
              className="mt-1"
              disabled={!!lectura}
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Versión</Label>
            <Select
              value={version}
              onValueChange={(v) => setVersion(v as BibleVersion)}
              disabled={!!lectura}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BIBLE_VERSIONS.map((v) => (
                  <SelectItem key={v.code} value={v.code}>
                    {v.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Texto de la lectura (si ya se obtuvo) */}
        {lectura && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-medium text-sm">{lectura.cita}</p>
                <p className="text-xs text-gray-500">{lectura.version}</p>
              </div>
              <div className="flex items-center gap-1 text-green-600">
                <Check className="h-4 w-4" />
                <span className="text-xs">Cargada</span>
              </div>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap max-h-32 overflow-y-auto">
              {lectura.texto}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onLecturaFetched({
                  cita: '',
                  texto: '',
                  version: '',
                  versionCode: '',
                });
                onCitaChange(lectura.cita);
              }}
              className="mt-2 text-xs text-gray-500"
            >
              Cambiar lectura
            </Button>
          </div>
        )}

        {/* Modo manual */}
        {!lectura && isManualMode && (
          <div className="space-y-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Entrada manual</span>
            </div>
            <Textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Pega aquí el texto de la lectura..."
              rows={6}
              className="bg-white"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleManualSave} className="bg-amber-600 hover:bg-amber-700">
                Guardar texto
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsManualMode(false);
                  setManualText('');
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Botón buscar (si no hay lectura y no está en modo manual) */}
        {!lectura && !isManualMode && (
          <div className="flex gap-2">
            <Button
              onClick={handleFetch}
              disabled={isLoading || !cita.trim()}
              className="flex-1 bg-gray-900 hover:bg-gray-800"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  {LABELS.buttons.fetchLectura}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsManualMode(true)}
              disabled={!cita.trim()}
            >
              Ingresar manual
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BiblePassageFetcher;
