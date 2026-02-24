import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";
import { crypto as stdCrypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting: 5 orders per hour per IP
const rateLimits = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// CCAvenue encryption using AES-128-CBC with MD5 key derivation
async function encrypt(plainText: string, workingKey: string): Promise<string> {
  const encoder = new TextEncoder();
  
  // Create MD5 hash of working key using std crypto
  const keyHash = await stdCrypto.subtle.digest('MD5', encoder.encode(workingKey));
  const key = new Uint8Array(keyHash);
  
  // Generate random IV (16 bytes)
  const iv = crypto.getRandomValues(new Uint8Array(16));
  
  // Import key for AES-CBC
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-CBC' },
    false,
    ['encrypt']
  );
  
  // Pad plaintext to 16 byte boundary (PKCS7)
  const data = encoder.encode(plainText);
  const paddingLength = 16 - (data.length % 16);
  const paddedData = new Uint8Array(data.length + paddingLength);
  paddedData.set(data);
  paddedData.fill(paddingLength, data.length);
  
  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    cryptoKey,
    paddedData
  );
  
  // Combine IV and encrypted data, convert to hex
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  const hexBytes = encode(combined);
  return new TextDecoder().decode(hexBytes);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               req.headers.get('x-real-ip') || 'unknown';
    const now = Date.now();
    const limit = rateLimits.get(ip);

    if (limit && now < limit.reset) {
      if (limit.count >= RATE_LIMIT) {
        console.log(`Rate limit exceeded for IP: ${ip}`);
        return new Response(
          JSON.stringify({ error: 'Too many order attempts. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      limit.count++;
    } else {
      rateLimits.set(ip, { count: 1, reset: now + RATE_WINDOW });
    }

    const { email, testMode, returnUrl } = await req.json();

    // Validate email
    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (trimmedEmail.length > 254) {
      return new Response(
        JSON.stringify({ error: 'Email address too long' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const merchantId = Deno.env.get('CCAVENUE_MERCHANT_ID');
    const accessCode = Deno.env.get('CCAVENUE_ACCESS_CODE');
    const workingKey = Deno.env.get('CCAVENUE_WORKING_KEY');

    if (!merchantId || !accessCode || !workingKey) {
      console.error('CCAvenue credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Payment configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate unique order ID
    const orderId = `GEDU_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Amount in INR (CCAvenue primarily works with INR)
    // $1.78 USD ≈ ₹149 INR (approximate conversion)
    const amount = testMode ? '1.00' : '149.00';
    const currency = 'INR';

    // CCAvenue redirect URL for response
    const supabaseProjectUrl = Deno.env.get('SUPABASE_URL')!;
    const redirectUrl = `${supabaseProjectUrl}/functions/v1/ccavenue-webhook`;
    const cancelUrl = returnUrl || 'https://geduhub.lovable.app';

    // Build CCAvenue request parameters
    const params: Record<string, string> = {
      merchant_id: merchantId,
      order_id: orderId,
      amount: amount,
      currency: currency,
      redirect_url: redirectUrl,
      cancel_url: cancelUrl,
      language: 'EN',
      billing_email: trimmedEmail,
      merchant_param1: trimmedEmail,
      merchant_param2: testMode ? 'test' : 'prod',
    };

    // Convert to query string
    const queryString = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');

    // Encrypt the data
    const encryptedData = await encrypt(queryString, workingKey);

    // Save order to database
    const { error: dbError } = await supabase.from('subscriptions').insert({
      email: trimmedEmail,
      razorpay_order_id: orderId, // Reusing this column for CCAvenue order ID
      amount: parseFloat(amount) * 100, // Store in paise
      currency: currency,
      status: 'pending'
    });

    if (dbError) {
      console.error('Database error:', dbError);
    }

    console.log('CCAvenue order created:', orderId, 'for email:', trimmedEmail);

    // CCAvenue payment URL (use test or production URL)
    const ccavenueUrl = testMode 
      ? 'https://test.ccavenue.com/transaction/transaction.do?command=initiateTransaction'
      : 'https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction';

    return new Response(
      JSON.stringify({
        orderId,
        encryptedData,
        accessCode,
        ccavenueUrl,
        amount,
        currency
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
