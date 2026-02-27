import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const pdfParse = async (buffer: Uint8Array) => {
  const { default: pdf } = await import("https://esm.sh/pdf-parse@1.1.1");
  return pdf(buffer);
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Use Gemini vision to OCR scanned PDFs or images
async function extractWithVision(base64Data: string, mimeType: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("Vision API not configured");
  }

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
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract ALL text content from this document/image. Return ONLY the extracted text, preserving the original structure and formatting as much as possible. Do not add any commentary or explanation.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Data}`,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Vision API error:", response.status, errorText);
    throw new Error(`Vision API failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// Convert bytes to base64
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing file:', file.name, 'Size:', file.size, 'Type:', file.type);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Check if this is an image file - use vision directly
    const isImage = file.type.startsWith('image/') || 
      /\.(png|jpg|jpeg|gif|webp|bmp|tiff)$/i.test(file.name);

    if (isImage) {
      console.log('Image file detected, using vision API for text extraction');
      const base64 = uint8ArrayToBase64(buffer);
      const mimeType = file.type || 'image/png';
      const extractedText = await extractWithVision(base64, mimeType);
      
      if (!extractedText || extractedText.trim().length === 0) {
        return new Response(JSON.stringify({
          text: '[No readable text found in the image]',
          pages: 1,
          info: { method: 'vision' },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Vision extracted', extractedText.length, 'characters from image');
      return new Response(JSON.stringify({
        text: extractedText,
        pages: 1,
        info: { method: 'vision' },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PDF processing with fallback
    let textContent = '';
    let numPages = 0;

    try {
      const data = await pdfParse(buffer);
      textContent = data.text;
      numPages = data.numpages;
      console.log('PDF parsed:', numPages, 'pages,', textContent.length, 'characters');
    } catch (parseError) {
      console.warn('PDF text extraction failed:', parseError);
    }

    // Check if text extraction was meaningful
    const cleanedText = textContent.replace(/\s+/g, ' ').trim();
    
    if (cleanedText.length < 50) {
      console.log('Minimal text extracted, falling back to vision API for OCR');
      try {
        const base64 = uint8ArrayToBase64(buffer);
        const visionText = await extractWithVision(base64, 'application/pdf');
        
        if (visionText && visionText.trim().length > cleanedText.length) {
          console.log('Vision API extracted', visionText.length, 'characters (vs', cleanedText.length, 'from text)');
          return new Response(JSON.stringify({
            text: visionText,
            pages: numPages || 1,
            info: { method: 'vision-ocr' },
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (visionError) {
        console.error('Vision fallback also failed:', visionError);
      }
    }

    return new Response(JSON.stringify({
      text: textContent,
      pages: numPages,
      info: { method: 'text-extraction' },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('File parsing error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to parse file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
