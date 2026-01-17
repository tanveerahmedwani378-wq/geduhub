import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Use dynamic import for pdf-parse to avoid type issues
const pdfParse = async (buffer: Uint8Array) => {
  const pdf = (await import("npm:pdf-parse@1.1.1")).default;
  return pdf(buffer);
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    console.log('Processing PDF:', file.name, 'Size:', file.size);

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Parse PDF
    const data = await pdfParse(buffer);

    console.log('PDF parsed successfully:', data.numpages, 'pages,', data.text.length, 'characters');

    return new Response(JSON.stringify({
      text: data.text,
      pages: data.numpages,
      info: data.info,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('PDF parsing error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to parse PDF',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
