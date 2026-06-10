// podcast-backfill — one-time import of episodes from the show's previous
// RSS feed (Spotify for Creators / Anchor) into church_podcast_episodes +
// the podcast-media bucket.
//
// Admin-gated: requires a valid JWT whose user has a row in
// mesa_abierta_admin_roles (same gate as the sermon editor UI).
//
// Actions (POST JSON):
//   { action: "list",   feedUrl }                        → parsed episodes + alreadyImported flags
//   { action: "import", feedUrl, guid, episodeNumber? }  → downloads ONE episode's audio (and
//                                                          cover, best-effort) server-side and
//                                                          publishes the row. One episode per
//                                                          invocation to stay inside time limits.
//
// The original feed guid is preserved on import so Spotify recognizes the
// episodes as the same items after the feed redirect.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PODCAST_BUCKET = "podcast-media";
// Keep in sync with the bucket's file_size_limit (200 MB).
const MAX_AUDIO_BYTES = 209715200;
// church_podcast_episodes.description CHECK (char_length <= 4000)
const DESCRIPTION_MAX = 4000;

interface FeedEpisode {
  guid: string;
  title: string;
  description: string | null;
  /** ISO timestamp */
  pubDate: string | null;
  durationSeconds: number | null;
  enclosureUrl: string;
  enclosureType: string;
  enclosureLength: number | null;
  imageUrl: string | null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** itunes:duration can be plain seconds, MM:SS or HH:MM:SS. */
function parseDuration(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return parseInt(text, 10);
  const parts = text.split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

/** Text content of a node that fast-xml-parser may give as string or object. */
function nodeText(node: unknown): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    return String(obj["#text"] ?? "");
  }
  return String(node);
}

async function fetchFeedEpisodes(feedUrl: string): Promise<FeedEpisode[]> {
  const res = await fetch(feedUrl, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
  });
  if (!res.ok) {
    throw new Error(`El feed respondió HTTP ${res.status}`);
  }
  const xml = await res.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });
  const doc = parser.parse(xml);
  let items = doc?.rss?.channel?.item ?? [];
  if (!Array.isArray(items)) items = [items];

  const episodes: FeedEpisode[] = [];
  for (const it of items) {
    const guid = nodeText(it.guid).trim();
    const enclosure = it.enclosure ?? {};
    const enclosureUrl = String(enclosure["@_url"] ?? "").trim();
    if (!guid || !enclosureUrl) continue;

    const image = it["itunes:image"];
    const imageUrl =
      image && typeof image === "object"
        ? String((image as Record<string, unknown>)["@_href"] ?? "") || null
        : null;

    let pubDate: string | null = null;
    if (it.pubDate) {
      const d = new Date(String(it.pubDate));
      if (!Number.isNaN(d.getTime())) pubDate = d.toISOString();
    }

    const lengthRaw = parseInt(String(enclosure["@_length"] ?? ""), 10);

    episodes.push({
      guid,
      title: nodeText(it.title).trim() || "(sin título)",
      description: nodeText(it.description).trim() || null,
      pubDate,
      durationSeconds: parseDuration(it["itunes:duration"]),
      enclosureUrl,
      enclosureType: String(enclosure["@_type"] ?? "audio/mpeg"),
      enclosureLength: Number.isNaN(lengthRaw) ? null : lengthRaw,
      imageUrl,
    });
  }

  // Oldest first — backfill assigns chronological episode numbers.
  episodes.sort((a, b) =>
    (a.pubDate ?? "").localeCompare(b.pubDate ?? ""),
  );
  return episodes;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ success: false, error: "Method Not Allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const service = createClient(supabaseUrl, serviceKey);

    // ── Auth: valid JWT + sermon-editor admin role ─────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ success: false, error: "Authorization requerida" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await service.auth.getUser(token);
    if (authError || !user) {
      return json({ success: false, error: "Autenticación inválida" }, 401);
    }

    const { data: roleRow } = await service
      .from("mesa_abierta_admin_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!roleRow) {
      return json(
        { success: false, error: "Acceso denegado: se requiere rol de administrador" },
        403,
      );
    }

    // ── Request ────────────────────────────────────────────────────────────
    const body = await req.json();
    const action = String(body.action ?? "");
    const feedUrl = String(body.feedUrl ?? "").trim();

    if (!feedUrl.startsWith("https://")) {
      return json(
        { success: false, error: "feedUrl debe ser una URL https://" },
        400,
      );
    }

    if (action === "list") {
      const episodes = await fetchFeedEpisodes(feedUrl);

      const { data: existing, error: existingError } = await service
        .from("church_podcast_episodes")
        .select("guid, status");
      if (existingError) throw existingError;

      const importedGuids = new Set(
        (existing ?? [])
          .filter((r) => r.status === "published")
          .map((r) => r.guid),
      );

      return json({
        success: true,
        episodes: episodes.map((e, idx) => ({
          ...e,
          suggestedEpisodeNumber: idx + 1,
          alreadyImported: importedGuids.has(e.guid),
        })),
      });
    }

    if (action === "import") {
      const guid = String(body.guid ?? "").trim();
      if (!guid) {
        return json({ success: false, error: "guid es requerido" }, 400);
      }
      const episodeNumber =
        typeof body.episodeNumber === "number" ? body.episodeNumber : null;

      const episodes = await fetchFeedEpisodes(feedUrl);
      const item = episodes.find((e) => e.guid === guid);
      if (!item) {
        return json(
          { success: false, error: "Episodio no encontrado en el feed" },
          404,
        );
      }

      // Already published with this guid? Nothing to do (idempotent).
      const { data: existingRow } = await service
        .from("church_podcast_episodes")
        .select("id, status")
        .eq("guid", guid)
        .maybeSingle();
      if (existingRow?.status === "published") {
        return json({
          success: true,
          alreadyImported: true,
          episodeId: existingRow.id,
        });
      }

      const pubDate = item.pubDate ?? new Date().toISOString();
      const episodeDate = pubDate.slice(0, 10);
      const description = item.description
        ? item.description.slice(0, DESCRIPTION_MAX)
        : null;

      // Draft row first (reuse an existing draft from a failed prior run).
      let episodeId: string;
      if (existingRow) {
        episodeId = existingRow.id;
      } else {
        const { data: inserted, error: insertError } = await service
          .from("church_podcast_episodes")
          .insert({
            title: item.title.slice(0, 200),
            description,
            episode_date: episodeDate,
            guid,
            episode_number: episodeNumber,
            created_by: user.id,
          })
          .select("id")
          .single();
        if (insertError || !inserted) {
          throw new Error(
            `No se pudo crear el episodio: ${insertError?.message ?? "desconocido"}`,
          );
        }
        episodeId = inserted.id;
      }

      // ── Audio: download from the old host, upload to our bucket ─────────
      if (
        item.enclosureLength !== null &&
        item.enclosureLength > MAX_AUDIO_BYTES
      ) {
        return json(
          { success: false, error: "El audio supera 200 MB", episodeId },
          400,
        );
      }

      const audioRes = await fetch(item.enclosureUrl);
      if (!audioRes.ok) {
        return json(
          {
            success: false,
            error: `No se pudo descargar el audio (HTTP ${audioRes.status})`,
            episodeId,
          },
          502,
        );
      }
      const audioBuffer = await audioRes.arrayBuffer();
      if (audioBuffer.byteLength > MAX_AUDIO_BYTES) {
        return json(
          { success: false, error: "El audio supera 200 MB", episodeId },
          400,
        );
      }

      const audioPath = `episodes/${episodeId}/audio.mp3`;
      const { error: audioUploadError } = await service.storage
        .from(PODCAST_BUCKET)
        .upload(audioPath, audioBuffer, {
          contentType: item.enclosureType || "audio/mpeg",
          upsert: true,
          cacheControl: "3600",
        });
      if (audioUploadError) {
        throw new Error(`Falló la subida del audio: ${audioUploadError.message}`);
      }
      const { data: audioPublic } = service.storage
        .from(PODCAST_BUCKET)
        .getPublicUrl(audioPath);

      // ── Cover: best effort — feed falls back to channel artwork ─────────
      let coverUrl: string | null = null;
      if (item.imageUrl) {
        try {
          const coverRes = await fetch(item.imageUrl);
          if (coverRes.ok) {
            const coverBuffer = await coverRes.arrayBuffer();
            const contentType =
              coverRes.headers.get("content-type") ?? "image/jpeg";
            const coverPath = `episodes/${episodeId}/cover.jpg`;
            const { error: coverError } = await service.storage
              .from(PODCAST_BUCKET)
              .upload(coverPath, coverBuffer, {
                contentType,
                upsert: true,
                cacheControl: "3600",
              });
            if (!coverError) {
              const { data: coverPublic } = service.storage
                .from(PODCAST_BUCKET)
                .getPublicUrl(coverPath);
              coverUrl = coverPublic.publicUrl;
            }
          }
        } catch (coverErr) {
          console.warn("podcast-backfill: cover download failed", coverErr);
        }
      }

      // duration_seconds is NOT NULL for published rows — estimate from the
      // real byte size at 128 kbps when the feed omits itunes:duration.
      const durationSeconds =
        item.durationSeconds ??
        Math.max(1, Math.round((audioBuffer.byteLength * 8) / 128000));

      const { error: publishError } = await service
        .from("church_podcast_episodes")
        .update({
          status: "published",
          audio_url: audioPublic.publicUrl,
          audio_size_bytes: audioBuffer.byteLength,
          duration_seconds: durationSeconds,
          mime_type: item.enclosureType || "audio/mpeg",
          cover_url: coverUrl,
          published_at: pubDate,
          episode_number: episodeNumber,
        })
        .eq("id", episodeId);
      if (publishError) {
        throw new Error(`No se pudo publicar: ${publishError.message}`);
      }

      return json({
        success: true,
        episodeId,
        audioBytes: audioBuffer.byteLength,
        durationSeconds,
        coverUrl,
      });
    }

    return json({ success: false, error: `Acción desconocida: ${action}` }, 400);
  } catch (err) {
    console.error("podcast-backfill: error", err);
    return json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Error inesperado",
      },
      500,
    );
  }
});
