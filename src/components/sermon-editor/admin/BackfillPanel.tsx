/**
 * BackfillPanel — one-time admin tool that imports the show's existing
 * episodes from its previous RSS feed (Spotify for Creators / Anchor) into
 * church_podcast_episodes via the podcast-backfill edge function.
 *
 * The audio is copied server-side; nothing is downloaded to the browser.
 * Episodes import oldest-first so episode numbers stay chronological.
 */
import React, { useCallback, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  Rss,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDurationLong } from '@/lib/sermon-editor/audioProcessor';

interface BackfillEpisode {
  guid: string;
  title: string;
  description: string | null;
  pubDate: string | null;
  durationSeconds: number | null;
  suggestedEpisodeNumber: number;
  alreadyImported: boolean;
}

type RowStatus = 'pending' | 'importing' | 'done' | 'error';

interface RowState {
  status: RowStatus;
  error?: string;
}

function formatFecha(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function BackfillPanel() {
  const [feedUrl, setFeedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [episodes, setEpisodes] = useState<BackfillEpisode[]>([]);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [importingAll, setImportingAll] = useState(false);

  const setRow = useCallback((guid: string, state: RowState) => {
    setRows((prev) => ({ ...prev, [guid]: state }));
  }, []);

  const loadEpisodes = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setEpisodes([]);
    setRows({});
    try {
      const { data, error } = await supabase.functions.invoke(
        'podcast-backfill',
        { body: { action: 'list', feedUrl: feedUrl.trim() } },
      );
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error ?? 'Error desconocido');

      const eps = data.episodes as BackfillEpisode[];
      setEpisodes(eps);
      setRows(
        Object.fromEntries(
          eps.map((e) => [
            e.guid,
            { status: e.alreadyImported ? 'done' : 'pending' } as RowState,
          ]),
        ),
      );
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'No se pudo leer el feed.',
      );
    } finally {
      setLoading(false);
    }
  }, [feedUrl]);

  const importOne = useCallback(
    async (episode: BackfillEpisode): Promise<boolean> => {
      setRow(episode.guid, { status: 'importing' });
      try {
        const { data, error } = await supabase.functions.invoke(
          'podcast-backfill',
          {
            body: {
              action: 'import',
              feedUrl: feedUrl.trim(),
              guid: episode.guid,
              episodeNumber: episode.suggestedEpisodeNumber,
            },
          },
        );
        if (error) throw new Error(error.message);
        if (!data?.success) throw new Error(data?.error ?? 'Error desconocido');
        setRow(episode.guid, { status: 'done' });
        return true;
      } catch (err) {
        setRow(episode.guid, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Error al importar',
        });
        return false;
      }
    },
    [feedUrl, setRow],
  );

  const importAllPending = useCallback(async () => {
    setImportingAll(true);
    try {
      // Sequential, oldest first — one edge-function invocation per episode.
      for (const episode of episodes) {
        const state = rows[episode.guid];
        if (state?.status === 'done') continue;
        const ok = await importOne(episode);
        if (!ok) break; // stop on first failure so errors don't cascade
      }
    } finally {
      setImportingAll(false);
    }
  }, [episodes, rows, importOne]);

  const pendingCount = episodes.filter(
    (e) => rows[e.guid]?.status !== 'done',
  ).length;

  return (
    <div className="space-y-4">
      <Alert>
        <Rss className="h-4 w-4" />
        <AlertDescription>
          Pega la URL del feed RSS actual del programa (Spotify for Creators →
          Settings → RSS Distribution). Los episodios se copian al nuevo
          alojamiento conservando su identificador, fecha y descripción.
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <Label htmlFor="backfill-feed-url">URL del feed RSS anterior</Label>
        <div className="flex gap-2">
          <Input
            id="backfill-feed-url"
            placeholder="https://anchor.fm/s/…/podcast/rss"
            value={feedUrl}
            onChange={(e) => setFeedUrl(e.target.value)}
            disabled={loading || importingAll}
          />
          <Button
            onClick={loadEpisodes}
            disabled={loading || importingAll || !feedUrl.trim()}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Cargar episodios'
            )}
          </Button>
        </div>
      </div>

      {loadError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {episodes.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {episodes.length} episodios en el feed · {pendingCount} pendientes
            </p>
            <Button
              size="sm"
              onClick={importAllPending}
              disabled={importingAll || pendingCount === 0}
            >
              {importingAll ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando…
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Importar pendientes
                </>
              )}
            </Button>
          </div>

          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {episodes.map((episode) => {
              const state = rows[episode.guid] ?? { status: 'pending' };
              return (
                <div
                  key={episode.guid}
                  className="flex items-center gap-3 rounded-md border p-3"
                >
                  <span className="w-8 shrink-0 text-sm text-muted-foreground">
                    #{episode.suggestedEpisodeNumber}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {episode.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFecha(episode.pubDate)}
                      {episode.durationSeconds
                        ? ` · ${formatDurationLong(episode.durationSeconds)}`
                        : ''}
                    </p>
                    {state.status === 'error' && (
                      <p className="text-xs text-destructive">{state.error}</p>
                    )}
                  </div>
                  {state.status === 'done' ? (
                    <Badge variant="secondary" className="shrink-0">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Importado
                    </Badge>
                  ) : state.status === 'importing' ? (
                    <Badge variant="outline" className="shrink-0">
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Importando…
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => importOne(episode)}
                      disabled={importingAll}
                    >
                      {state.status === 'error' ? 'Reintentar' : 'Importar'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
