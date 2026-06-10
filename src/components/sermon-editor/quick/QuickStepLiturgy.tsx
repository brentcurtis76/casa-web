/**
 * QuickStepLiturgy — step 2 of Publicación Rápida.
 *
 * Lets the user link the upload to one of the last 50 liturgias, pick from
 * a dropdown, or continue without a liturgy by entering metadata manually.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, Link2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { QuickLiturgy } from '@/hooks/useQuickPublish';

interface QuickStepLiturgyProps {
  liturgies: QuickLiturgy[];
  matched: QuickLiturgy | null;
  loading: boolean;
  onSelect: (l: QuickLiturgy) => void;
  onContinueWithoutLiturgy: (manual: {
    title: string;
    speaker: string;
    date: Date;
  }) => void;
  onConfirm: () => void;
}

type Mode = 'matched' | 'pick' | 'manual';

export function QuickStepLiturgy({
  liturgies,
  matched,
  loading,
  onSelect,
  onContinueWithoutLiturgy,
  onConfirm,
}: QuickStepLiturgyProps) {
  const [mode, setMode] = useState<Mode>(matched ? 'matched' : 'pick');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [manualTitle, setManualTitle] = useState('');
  const [manualSpeaker, setManualSpeaker] = useState('');
  const [manualDate, setManualDate] = useState(
    format(new Date(), 'yyyy-MM-dd'),
  );

  useEffect(() => {
    if (matched && mode === 'pick') {
      setMode('matched');
    }
  }, [matched, mode]);

  const formattedMatchedDate = useMemo(() => {
    if (!matched) return '';
    const d = new Date(matched.fecha + 'T00:00:00');
    return format(d, "EEEE d 'de' MMMM", { locale: es });
  }, [matched]);

  const canContinueManual =
    manualTitle.trim().length > 0 && manualSpeaker.trim().length > 0;

  const handleUseMatched = () => {
    if (matched) {
      onSelect(matched);
      onConfirm();
    }
  };

  const handleUsePicked = () => {
    const picked = liturgies.find((l) => l.id === pickedId);
    if (picked) {
      onSelect(picked);
      onConfirm();
    }
  };

  const handleManualSubmit = () => {
    if (!canContinueManual) return;
    onContinueWithoutLiturgy({
      title: manualTitle.trim(),
      speaker: manualSpeaker.trim(),
      date: new Date(manualDate + 'T00:00:00'),
    });
    onConfirm();
  };

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">
            ¿Vincular esta reflexión a una liturgia?
          </h2>
          <p className="text-sm text-muted-foreground">
            Si la vinculas, importamos título, predicador y fecha automáticamente.
          </p>
        </div>

        {loading && (
          <p className="text-sm text-muted-foreground">Cargando liturgias…</p>
        )}

        {!loading && matched && mode === 'matched' && (
          <Alert>
            <CalendarDays className="h-4 w-4" />
            <AlertTitle>
              Encontramos una liturgia para el {formattedMatchedDate}
            </AlertTitle>
            <AlertDescription className="space-y-3">
              <p className="font-medium text-foreground">«{matched.titulo}»</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleUseMatched} className="bg-amber-600 hover:bg-amber-700">
                  <Link2 className="h-4 w-4 mr-2" />
                  Usar esta liturgia
                </Button>
                <Button variant="outline" onClick={() => setMode('pick')}>
                  Elegir otra liturgia
                </Button>
                <Button variant="ghost" onClick={() => setMode('manual')}>
                  Continuar sin liturgia
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {!loading && mode === 'pick' && (
          <div className="space-y-3">
            <Label htmlFor="quick-liturgy-select">Selecciona una liturgia</Label>
            <Select
              value={pickedId ?? undefined}
              onValueChange={(v) => setPickedId(v)}
            >
              <SelectTrigger id="quick-liturgy-select">
                <SelectValue placeholder="— elige una liturgia —" />
              </SelectTrigger>
              <SelectContent>
                {liturgies.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.titulo} · {l.fecha}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleUsePicked}
                disabled={!pickedId}
                className="bg-amber-600 hover:bg-amber-700"
              >
                Usar esta liturgia
              </Button>
              <Button variant="ghost" onClick={() => setMode('manual')}>
                Continuar sin liturgia
              </Button>
            </div>
          </div>
        )}

        {!loading && mode === 'manual' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="quick-manual-title">Título de la reflexión</Label>
              <Input
                id="quick-manual-title"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="Ej. Lo que la oración nos enseña"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="quick-manual-speaker">Predicador</Label>
              <Input
                id="quick-manual-speaker"
                value={manualSpeaker}
                onChange={(e) => setManualSpeaker(e.target.value)}
                placeholder="Nombre del predicador"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="quick-manual-date">Fecha</Label>
              <Input
                id="quick-manual-date"
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                onClick={handleManualSubmit}
                disabled={!canContinueManual}
                className="bg-amber-600 hover:bg-amber-700"
              >
                Continuar
              </Button>
              {matched && (
                <Button variant="ghost" onClick={() => setMode('matched')}>
                  Volver a la liturgia sugerida
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
