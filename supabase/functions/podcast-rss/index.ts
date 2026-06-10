import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// ── Channel constants (verified against the live Spotify show) ─────────────
const SHOW_TITLE = "CASA";
const SHOW_DESCRIPTION =
  "Reflexiones de la Comunidad Anglicana San Andrés Santiago, Chile";
const SHOW_AUTHOR = "Comunidad Anglicana San Andrés";
const SHOW_LINK = "https://iglesia-casa.cl";
// TODO(Brent): confirm before Spotify cutover; publicly visible in feed
const OWNER_EMAIL = "brentcurtis76@gmail.com";
const LANGUAGE = "es";
// Top-level iTunes category. The "&" is escaped because it goes straight into XML.
const CATEGORY = "Religion &amp; Spirituality";
const SUBCATEGORY = "Christianity";
const EXPLICIT = false;
const SHOW_COVER_URL =
  "https://mulsqxfhxxdsadxsljss.supabase.co/storage/v1/object/public/podcast-media/show/cover.jpg";
const FEED_SELF_URL =
  "https://mulsqxfhxxdsadxsljss.supabase.co/functions/v1/podcast-rss";

interface EpisodeRow {
  id: string;
  title: string;
  description: string | null;
  speaker: string | null;
  episode_date: string;
  audio_url: string | null;
  audio_size_bytes: number | null;
  duration_seconds: number | null;
  mime_type: string;
  cover_url: string | null;
  guid: string;
  episode_number: number | null;
  published_at: string | null;
}

function escapeXml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapCdata(value: string | null | undefined): string {
  if (!value) return "<![CDATA[]]>";
  // Strip any sequences that would prematurely close the CDATA block.
  const safe = value.replace(/]]>/g, "]]]]><![CDATA[>");
  return `<![CDATA[${safe}]]>`;
}

function renderItem(ep: EpisodeRow): string {
  const parts: string[] = [];
  parts.push(`<title>${escapeXml(ep.title)}</title>`);
  parts.push(`<description>${wrapCdata(ep.description)}</description>`);
  parts.push(
    `<enclosure url="${escapeXml(ep.audio_url)}" length="${escapeXml(
      ep.audio_size_bytes,
    )}" type="${escapeXml(ep.mime_type)}" />`,
  );
  parts.push(
    `<guid isPermaLink="false">${escapeXml(ep.guid)}</guid>`,
  );
  if (ep.published_at) {
    parts.push(
      `<pubDate>${escapeXml(
        new Date(ep.published_at).toUTCString(),
      )}</pubDate>`,
    );
  }
  if (ep.duration_seconds !== null) {
    parts.push(
      `<itunes:duration>${escapeXml(ep.duration_seconds)}</itunes:duration>`,
    );
  }
  if (ep.speaker) {
    parts.push(`<itunes:author>${escapeXml(ep.speaker)}</itunes:author>`);
  }
  if (ep.cover_url) {
    parts.push(
      `<itunes:image href="${escapeXml(ep.cover_url)}" />`,
    );
  }
  parts.push(`<itunes:episodeType>full</itunes:episodeType>`);
  if (ep.episode_number !== null) {
    parts.push(
      `<itunes:episode>${escapeXml(ep.episode_number)}</itunes:episode>`,
    );
  }
  parts.push(`<itunes:explicit>false</itunes:explicit>`);
  return `<item>${parts.join("")}</item>`;
}

function renderFeed(episodes: EpisodeRow[]): string {
  const lastBuildDate = new Date().toUTCString();
  const items = episodes
    .filter((e) => e.audio_url && e.audio_size_bytes && e.published_at)
    .map(renderItem)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${escapeXml(SHOW_TITLE)}</title>
<link>${escapeXml(SHOW_LINK)}</link>
<description>${escapeXml(SHOW_DESCRIPTION)}</description>
<language>${escapeXml(LANGUAGE)}</language>
<lastBuildDate>${escapeXml(lastBuildDate)}</lastBuildDate>
<itunes:author>${escapeXml(SHOW_AUTHOR)}</itunes:author>
<itunes:owner><itunes:name>${escapeXml(SHOW_AUTHOR)}</itunes:name><itunes:email>${escapeXml(OWNER_EMAIL)}</itunes:email></itunes:owner>
<itunes:image href="${escapeXml(SHOW_COVER_URL)}" />
<itunes:category text="${CATEGORY}"><itunes:category text="${escapeXml(SUBCATEGORY)}" /></itunes:category>
<itunes:explicit>${EXPLICIT ? "true" : "false"}</itunes:explicit>
<itunes:type>episodic</itunes:type>
<atom:link href="${escapeXml(FEED_SELF_URL)}" rel="self" type="application/rss+xml" />
${items}
</channel>
</rss>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data, error } = await supabaseClient
      .from("church_podcast_episodes")
      .select(
        "id, title, description, speaker, episode_date, audio_url, audio_size_bytes, duration_seconds, mime_type, cover_url, guid, episode_number, published_at",
      )
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (error) {
      console.error("podcast-rss: query error", error);
      return new Response("Internal Server Error", {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const feed = renderFeed((data ?? []) as EpisodeRow[]);

    return new Response(feed, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=600",
      },
    });
  } catch (err) {
    console.error("podcast-rss: unexpected error", err);
    return new Response("Internal Server Error", {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
});
