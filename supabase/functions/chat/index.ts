import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const lastMessage = messages[messages.length - 1];
    const isImageGen = lastMessage?.role === 'user' && isImageRequest(lastMessage.content);

    console.log("Processing chat request:", { 
      messageCount: messages.length, 
      isImageGen,
      lastMessageContent: lastMessage?.content?.substring(0, 100)
    });

    if (isImageGen) {
      // Use image generation model
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image-preview",
          messages: [
            { 
              role: "system", 
              content: "You are GEDUHub AI, an expert image generator. Generate high-quality, creative images based on user descriptions. Be artistic and detailed in your creations." 
            },
            { role: "user", content: lastMessage.content }
          ],
          modalities: ["image", "text"]
        }),
      });

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

      const textContent = data.choices?.[0]?.message?.content || "Here's your generated image:";
      const images = data.choices?.[0]?.message?.images || [];

      return new Response(JSON.stringify({ 
        type: 'image',
        content: textContent,
        images: images.map((img: any) => img.image_url?.url || img.url)
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
            content: "You are GEDUHub AI, a helpful and intelligent assistant. You provide clear, accurate, and helpful responses. You can help with questions, writing, analysis, coding, math, science, and much more. Be concise but thorough in your explanations. If someone asks you to generate, create, or draw an image, let them know you can do that - just ask them to describe what they want to see." 
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
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
