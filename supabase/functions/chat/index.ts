import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Keywords that suggest image generation request
const imageKeywords = [
  'generate image', 'create image', 'make image', 'draw', 'generate a picture',
  'create a picture', 'make a picture', 'generate an image', 'create an image',
  'make an image', 'image of', 'picture of', 'illustration of', 'visualize',
  'generate artwork', 'create artwork', 'design', 'sketch', 'paint', 'render',
  'generate photo', 'create photo', 'show me', 'can you draw', 'please draw',
  'generate a', 'create a visual', 'make me a', 'generate me'
];

function isImageRequest(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return imageKeywords.some(keyword => lowerMessage.includes(keyword));
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
          return new Response(JSON.stringify({ 
            error: "Free message limit reached. Please upgrade to premium for unlimited access." 
          }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    } else {
      // For unauthenticated requests (using anon key), still allow but with limits
      // Use IP-based limiting for anonymous users
      const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
      if (!checkFreeUserRateLimit(`anon_${clientIp}`)) {
        return new Response(JSON.stringify({ 
          error: "Rate limit reached. Please sign in for more access." 
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("AI service not configured");
    }

    const lastMessage = messages[messages.length - 1];
    const isImageGen = lastMessage?.role === 'user' && isImageRequest(lastMessage.content);

    console.log("Processing chat request:", { 
      messageCount: messages.length, 
      isImageGen,
      userEmail: userEmail ? `${userEmail.substring(0, 3)}***` : 'anonymous',
      lastMessageLength: lastMessage?.content?.length
    });

    if (isImageGen) {
      // Use image generation model via chat completions
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 55000); // 55s timeout
      
      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [
              { 
                role: "system", 
                content: "Generate an image based on the user's description. Keep text response very brief." 
              },
              { role: "user", content: lastMessage.content }
            ],
            modalities: ["image", "text"]
          }),
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("AI gateway error for image gen:", response.status, errorText);
          
          if (response.status === 429) {
            return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (response.status === 402) {
            return new Response(JSON.stringify({ error: "Payment required. Please add credits to continue." }), {
              status: 402,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          
          return new Response(JSON.stringify({ error: "Image generation failed" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const data = await response.json();
        console.log("Image generation response received");

        const choice = data.choices?.[0]?.message;
        const textContent = choice?.content || "Here's your generated image:";
        const images = choice?.images || [];
        
        const imageUrls = images.map((img: Record<string, unknown>) => {
          if (typeof img === 'string') return img;
          const imgUrl = img as { image_url?: { url?: string }; url?: string };
          return imgUrl.image_url?.url || imgUrl.url || null;
        }).filter(Boolean);
        
        console.log("Extracted image URLs count:", imageUrls.length);

        return new Response(JSON.stringify({ 
          type: 'image',
          content: textContent,
          images: imageUrls
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (abortError) {
        clearTimeout(timeout);
        console.error("Image generation timed out or aborted:", abortError);
        return new Response(JSON.stringify({ error: "Image generation timed out. Please try again." }), {
          status: 504,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Regular text chat - streaming
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: `You are GEDUHub AI, a helpful educational assistant. 

When a user shares document content (marked with [File: filename]), you MUST:
1. Carefully read and analyze the entire document content provided
2. Answer questions about the document accurately and thoroughly
3. Summarize key points if asked
4. Help explain complex concepts from the document
5. Provide insights and analysis based on the document content

For general questions (without documents), keep responses SHORT and CONCISE - aim for 2-4 sentences unless more detail is needed. Get straight to the point.

If someone asks to generate or draw an image, tell them to use phrases like "create image of" or "generate image of".` 
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
