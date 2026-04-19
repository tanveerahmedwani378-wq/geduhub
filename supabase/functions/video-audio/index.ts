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
): Promise<string | null> {
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
      console.error("SFX failed:", r.status, await r.text());
      return null;
    }
    const buf = await r.arrayBuffer();
    return `data:audio/mpeg;base64,${base64Encode(new Uint8Array(buf))}`;
  } catch (e) {
    console.error("SFX error:", e);
    return null;
  }
}

async function generateMusic(
  apiKey: string,
  prompt: string,
  durationMs: number
): Promise<string | null> {
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
      console.error("Music failed:", r.status, await r.text());
      return null;
    }
    const buf = await r.arrayBuffer();
    return `data:audio/mpeg;base64,${base64Encode(new Uint8Array(buf))}`;
  } catch (e) {
    console.error("Music error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ELEVENLABS_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const scene: string = (body.scene || body.prompt || "ambient cinematic scene").toString().slice(0, 500);
    const duration: number = Math.min(Math.max(Number(body.duration) || 6, 3), 15);
    const wantMusic = body.music !== false;
    const wantSfx = body.sfx !== false;

    const sfxPrompt = `Ambient sound effects for: ${scene}. Cinematic, immersive, natural atmosphere.`;
    const musicPrompt = `Short cinematic ${duration}-second background score matching this scene: ${scene}. Atmospheric, no vocals, gentle build.`;

    const [sfxUrl, musicUrl] = await Promise.all([
      wantSfx ? generateSfx(apiKey, sfxPrompt, duration) : Promise.resolve(null),
      wantMusic ? generateMusic(apiKey, musicPrompt, duration * 1000) : Promise.resolve(null),
    ]);

    return new Response(
      JSON.stringify({ sfxUrl, musicUrl }),
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
