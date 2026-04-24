import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function userFacingError(content: string, error = content): Response {
  return jsonResponse({
    ok: false,
    type: 'error',
    content,
    error,
  });
}

// Keywords that suggest image generation request
const imageKeywords = [
  'generate image', 'create image', 'make image', 'draw', 'generate a picture',
  'create a picture', 'make a picture', 'generate an image', 'create an image',
  'make an image', 'image of', 'picture of', 'illustration of', 'visualize',
  'generate artwork', 'create artwork', 'design', 'sketch', 'paint', 'render',
  'generate photo', 'create photo', 'show me', 'can you draw', 'please draw',
  'generate a', 'create a visual', 'make me a', 'generate me'
];

// Keywords that suggest video generation request
const videoKeywords = [
  'generate video', 'create video', 'make video', 'generate a video', 'create a video',
  'make a video', 'video of', 'animate', 'make animation', 'create animation',
  'generate animation', 'video about', 'make me a video', 'create a clip',
  'generate a clip', 'make a clip', 'video clip', 'short video', 'create a short',
  'make a short', 'film of', 'create a film', 'motion video'
];

function isImageRequest(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  // Don't match as image if it's a video request
  if (isVideoRequest(message)) return false;
  return imageKeywords.some(keyword => lowerMessage.includes(keyword));
}

function isVideoRequest(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return videoKeywords.some(keyword => lowerMessage.includes(keyword));
}

// Input validation
interface ValidatedMessage {
  role: 'user' | 'assistant';
  content: string;
}

function validateMessages(messages: unknown): ValidatedMessage[] {
  if (!Array.isArray(messages)) {
    throw new Error('Messages must be an array');
  }

  if (messages.length === 0) {
    throw new Error('Messages array cannot be empty');
  }

  if (messages.length > 50) {
    throw new Error('Too many messages in history (max 50)');
  }

  return messages.map((msg, idx) => {
    if (!msg || typeof msg !== 'object') {
      throw new Error(`Invalid message at index ${idx}`);
    }

    const m = msg as Record<string, unknown>;

    // Validate role - only allow user and assistant (not system)
    if (!['user', 'assistant'].includes(m.role as string)) {
      throw new Error(`Invalid role at index ${idx}`);
    }

    // Validate content
    if (typeof m.content !== 'string') {
      throw new Error(`Invalid content at index ${idx}`);
    }

    // Length limit per message (100000 chars for documents, 8000 for regular)
    const hasDocument = (m.content as string).includes('[File:');
    const maxLen = hasDocument ? 100000 : 8000;
    if ((m.content as string).length > maxLen) {
      // Truncate instead of rejecting, to preserve document analysis
      (m as Record<string, unknown>).content = (m.content as string).substring(0, maxLen);
    }

    // Sanitize content - remove null bytes and control characters
    const sanitized = (m.content as string)
      .replace(/\0/g, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

    return {
      role: m.role as 'user' | 'assistant',
      content: sanitized,
    };
  });
}

// Check subscription status
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkPremiumStatus(supabase: any, email: string | null): Promise<boolean> {
  if (!email) return false;

  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('email', email)
    .eq('status', 'active')
    .gte('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle();

  return !!data;
}

// Simple in-memory rate limiting (per function invocation - resets on cold start)
const FREE_MESSAGES_LIMIT = 5;
const freeUserMessageCounts = new Map<string, { count: number; resetTime: number }>();

function checkFreeUserRateLimit(email: string): boolean {
  const now = Date.now();
  const record = freeUserMessageCounts.get(email);
  
  // Reset after 24 hours
  const RESET_INTERVAL = 24 * 60 * 60 * 1000;
  
  if (!record || now > record.resetTime) {
    freeUserMessageCounts.set(email, { count: 1, resetTime: now + RESET_INTERVAL });
    return true;
  }
  
  if (record.count >= FREE_MESSAGES_LIMIT) {
    return false;
  }
  
  record.count++;
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate and parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages: rawMessages } = body as { messages: unknown };

    // Validate messages
    let messages: ValidatedMessage[];
    try {
      messages = validateMessages(rawMessages);
    } catch (validationError) {
      console.error("Validation error:", validationError);
      return new Response(JSON.stringify({ error: validationError instanceof Error ? validationError.message : "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure last message is from user
    if (messages[messages.length - 1]?.role !== 'user') {
      return new Response(JSON.stringify({ error: "Last message must be from user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user session
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    let userEmail: string | null = null;
    
    if (user && !authError) {
      userEmail = user.email || null;
      
      // Check premium status for authenticated users
      const isPremium = await checkPremiumStatus(supabase, userEmail);
      
      if (!isPremium && userEmail) {
        // Check rate limit for free users
        if (!checkFreeUserRateLimit(userEmail)) {
          return userFacingError(
            "⚠️ Free message limit reached for this account. Please try again later.",
            "Free message limit reached. Please upgrade to premium for unlimited access.",
          );
        }
      }
    } else {
      // For unauthenticated requests (using anon key), still allow but with limits
      // Use IP-based limiting for anonymous users
      const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
      if (!checkFreeUserRateLimit(`anon_${clientIp}`)) {
        return userFacingError(
          "⚠️ Rate limit reached. Please sign in and try again in a moment.",
          "Rate limit reached. Please sign in for more access.",
        );
      }
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const AI_KEY = GEMINI_API_KEY || LOVABLE_API_KEY;
    const AI_URL = GEMINI_API_KEY
      ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const TEXT_MODEL = GEMINI_API_KEY ? "gemini-2.5-flash" : "google/gemini-3-flash-preview";
    const IMAGE_MODEL = GEMINI_API_KEY ? "gemini-2.5-flash-image" : "google/gemini-3-pro-image-preview";

    if (!AI_KEY) {
      console.error("No AI key configured (GEMINI_API_KEY or LOVABLE_API_KEY)");
      throw new Error("AI service not configured");
    }

    const lastMessage = messages[messages.length - 1];
    const isImageGen = lastMessage?.role === 'user' && isImageRequest(lastMessage.content);
    const isVideoGen = lastMessage?.role === 'user' && isVideoRequest(lastMessage.content);

    console.log("Processing chat request:", { 
      messageCount: messages.length, 
      isImageGen,
      isVideoGen,
      userEmail: userEmail ? `${userEmail.substring(0, 3)}***` : 'anonymous',
      lastMessageLength: lastMessage?.content?.length
    });

    // Video generation is currently disabled to preserve AI credits.
    if (isVideoGen) {
      return new Response(JSON.stringify({
        type: 'text',
        content: "🎬 Video generation is currently disabled. Try asking me to generate an **image** instead — for example: \"Generate an image of a sunset over mountains\".",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isImageGen) {
      // Free image generation via Pollinations.ai — no API key, no limits
      try {
        // Strip common trigger phrases to get a cleaner prompt
        const cleanPrompt = lastMessage.content
          .replace(/^(please\s+)?(can you\s+)?(generate|create|make|draw|show me|render|design|sketch|paint)\s+(an?\s+|me\s+an?\s+)?(image|picture|photo|illustration|artwork|visual)\s+(of\s+)?/i, '')
          .replace(/^(image|picture|photo|illustration)\s+of\s+/i, '')
          .trim();

        const prompt = cleanPrompt || lastMessage.content;
        const seed = Math.floor(Math.random() * 1000000);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${seed}&nologo=true&enhance=true`;

        console.log("Generating image via Pollinations:", prompt.slice(0, 80));

        return new Response(JSON.stringify({
          type: 'image',
          content: `Here's your image of **${prompt}**:`,
          images: [imageUrl],
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("Image generation error:", err);
        return userFacingError("⚠️ Image generation failed. Please try again.");
      }
    }

    // Regular text chat - streaming
    const fallbackModels = GEMINI_API_KEY
      ? [TEXT_MODEL, "gemini-2.5-flash-lite", "gemini-2.0-flash"]
      : [TEXT_MODEL];

    const buildBody = (model: string) => JSON.stringify({
      model,
      messages: [
          { 
            role: "system", 
            content: `You are GEDUHub AI, a helpful educational assistant created by Aayat Tanveer. 

IMPORTANT: If anyone asks who made you, who created you, who built you, or who your creator/developer is, you MUST always answer: "I was created by Aayat Tanveer."

FORMATTING RULES (VERY IMPORTANT — format like ChatGPT):
- ALWAYS break your answer into short paragraphs separated by a blank line. Never return one long wall of text.
- For any answer with 2+ facts, steps, or items: use a **bulleted list** (with "- ") or a **numbered list** (1., 2., 3.).
- Put a blank line BEFORE and AFTER every list and every heading.
- Use bold section headers (**Like This**) to group related points when the answer has multiple parts.
- Each bullet point should be on its own line and start with "- ".
- Use **bold** for key terms, names, and important values.
- Use \`inline code\` for technical terms and fenced code blocks for code.
- For casual/small-talk messages (greetings, jokes, "what's up"), use emojis naturally to be friendly 😊✨.
- For academic/formal questions, keep emojis minimal but STILL use the spacing + bullet structure above.

Example good format for "what is earth":
**Earth** 🌍 is the third planet from the Sun and the only known planet with life.

**Key facts:**
- **Position:** 3rd planet from the Sun
- **Type:** Terrestrial (rocky) planet
- **Special:** Only known planet to support life
- **Atmosphere:** Nitrogen + oxygen, protects life

When a user shares document content (marked with [File: filename]), you MUST:
1. Carefully read and analyze the entire document content provided
2. Answer questions about the document accurately and thoroughly
3. Summarize key points if asked
4. Help explain complex concepts from the document
5. Provide insights and analysis based on the document content

Keep responses concise but ALWAYS well-structured with the spacing and bullet rules above — even short answers should use line breaks between ideas.

If someone asks to generate or draw an image, tell them to use phrases like "create image of" or "generate image of".`
          },
          ...messages,
        ],
        stream: true,
    });

    let response: Response | null = null;
    let lastErrorText = "";
    let lastStatus = 0;
    for (const model of fallbackModels) {
      response = await fetch(AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AI_KEY}`,
          "Content-Type": "application/json",
        },
        body: buildBody(model),
      });
      if (response.ok) break;
      lastStatus = response.status;
      lastErrorText = await response.text();
      console.error(`AI error with ${model}:`, response.status, lastErrorText);
      // Only fall back on overload/unavailable
      if (response.status !== 503 && response.status !== 429) break;
    }

    if (!response || !response.ok) {
      if (lastStatus === 503) {
        return userFacingError(
          "⚠️ The AI model is temporarily overloaded. Please try again in a moment.",
          "Model overloaded (503).",
        );
      }
      if (lastStatus === 429) {
        return userFacingError(
          "⚠️ I hit a rate limit. Please try again in a moment.",
          "Rate limit exceeded.",
        );
      }
      if (lastStatus === 402) {
        return userFacingError(
          "⚠️ The AI service is out of credits. Please try again later.",
          "Payment required.",
        );
      }
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Streaming response from AI gateway");

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat function error:", error);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
