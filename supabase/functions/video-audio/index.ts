import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ELEVEN = "https://api.elevenlabs.io/v1";

async function generateSfx(
  apiKey: string,
  prompt: string,
  durationSeconds: number
): Promise<{ url: string | null; error: string | null }> {
  try {
    const r = await fetch(`${ELEVEN}/sound-generation`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: prompt,
        duration_seconds: Math.min(Math.max(durationSeconds, 1), 22),
        prompt_influence: 0.4,
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      console.error("SFX failed:", r.status, txt);
      return { url: null, error: `SFX ${r.status}: ${txt.slice(0, 200)}` };
    }
    const buf = await r.arrayBuffer();
    return {
      url: `data:audio/mpeg;base64,${base64Encode(new Uint8Array(buf))}`,
      error: null,
    };
  } catch (e) {
    console.error("SFX error:", e);
    return { url: null, error: e instanceof Error ? e.message : "sfx error" };
  }
}

async function generateMusic(
  apiKey: string,
  prompt: string,
  durationMs: number
): Promise<{ url: string | null; error: string | null }> {
  try {
    const r = await fetch(`${ELEVEN}/music`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        music_length_ms: Math.min(Math.max(durationMs, 10000), 30000),
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      console.error("Music failed:", r.status, txt);
      return { url: null, error: `Music ${r.status}: ${txt.slice(0, 200)}` };
    }
    const buf = await r.arrayBuffer();
    return {
      url: `data:audio/mpeg;base64,${base64Encode(new Uint8Array(buf))}`,
      error: null,
    };
  } catch (e) {
    console.error("Music error:", e);
    return { url: null, error: e instanceof Error ? e.message : "music error" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    const body = await req.json().catch(() => ({}));
    const scene: string = (body.scene || body.prompt || "ambient cinematic scene").toString().slice(0, 500);
    const duration: number = Math.min(Math.max(Number(body.duration) || 6, 3), 15);
    const wantMusic = body.music !== false;
    const wantSfx = body.sfx !== false;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          sfxUrl: null,
          musicUrl: null,
          warning: "ELEVENLABS_API_KEY not configured — client will synthesize fallback audio.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sfxPrompt = `Ambient sound effects for: ${scene}. Cinematic, immersive, natural atmosphere.`;
    const musicPrompt = `Short cinematic ${duration}-second background score matching this scene: ${scene}. Atmospheric, no vocals, gentle build.`;

    const [sfxRes, musicRes] = await Promise.all([
      wantSfx ? generateSfx(apiKey, sfxPrompt, duration) : Promise.resolve({ url: null, error: null }),
      wantMusic ? generateMusic(apiKey, musicPrompt, duration * 1000) : Promise.resolve({ url: null, error: null }),
    ]);

    const warnings: string[] = [];
    if (sfxRes.error) warnings.push(sfxRes.error);
    if (musicRes.error) warnings.push(musicRes.error);

    return new Response(
      JSON.stringify({
        sfxUrl: sfxRes.url,
        musicUrl: musicRes.url,
        warning: warnings.length ? warnings.join(" | ") : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("video-audio error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
