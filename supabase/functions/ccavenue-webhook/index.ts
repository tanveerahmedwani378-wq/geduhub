import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// CCAvenue decryption using AES-128-CBC
async function decrypt(encryptedText: string, workingKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  // Convert hex to bytes
  const encryptedBytes = new Uint8Array(
    encryptedText.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );
  
  // Create MD5 hash of working key for AES key
  const keyHash = await crypto.subtle.digest('MD5', encoder.encode(workingKey));
  const key = new Uint8Array(keyHash);
  
  // Extract IV (first 16 bytes) and ciphertext
  const iv = encryptedBytes.slice(0, 16);
  const ciphertext = encryptedBytes.slice(16);
  
  // Import key for AES-CBC
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-CBC' },
    false,
    ['decrypt']
  );
  
  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv },
    cryptoKey,
    ciphertext
  );
  
  // Remove PKCS7 padding
  const decryptedArray = new Uint8Array(decrypted);
  const paddingLength = decryptedArray[decryptedArray.length - 1];
  const unpaddedData = decryptedArray.slice(0, decryptedArray.length - paddingLength);
  
  return decoder.decode(unpaddedData);
}

// Parse query string to object
function parseQueryString(queryString: string): Record<string, string> {
  const params: Record<string, string> = {};
  queryString.split('&').forEach(pair => {
    const [key, value] = pair.split('=');
    if (key && value) {
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    }
  });
  return params;
}

serve(async (req) => {
  console.log('CCAvenue webhook called, method:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const workingKey = Deno.env.get('CCAVENUE_WORKING_KEY');
    
    if (!workingKey) {
      console.error('CCAvenue working key not configured');
      return new Response(
        JSON.stringify({ error: 'Configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let encryptedResponse: string;
    
    // Handle both POST form data and JSON
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      encryptedResponse = formData.get('encResp') as string;
    } else if (contentType.includes('application/json')) {
      const body = await req.json();
      encryptedResponse = body.encResp;
    } else {
      const body = await req.text();
      // Try to parse as form data
      const params = new URLSearchParams(body);
      encryptedResponse = params.get('encResp') || '';
    }

    if (!encryptedResponse) {
      console.error('No encrypted response received');
      return new Response(
        JSON.stringify({ error: 'Invalid response' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decrypt the response
    const decryptedData = await decrypt(encryptedResponse, workingKey);
    console.log('Decrypted CCAvenue response:', decryptedData);
    
    const params = parseQueryString(decryptedData);
    
    const orderId = params.order_id;
    const orderStatus = params.order_status;
    const trackingId = params.tracking_id;
    const email = params.merchant_param1 || params.billing_email;
    
    console.log('Order:', orderId, 'Status:', orderStatus, 'Email:', email);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (orderStatus === 'Success') {
      // Set expiration to 6 months from now
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 6);

      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          razorpay_payment_id: trackingId, // Store CCAvenue tracking ID
          razorpay_signature: 'ccavenue_verified',
          status: 'active',
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('razorpay_order_id', orderId);

      if (updateError) {
        console.error('Database update error:', updateError);
      } else {
        console.log('Payment verified and subscription activated for order:', orderId);
      }

      // Redirect to success page
      const successUrl = `https://geduhub.lovable.app/?payment=success&email=${encodeURIComponent(email || '')}`;
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders, 
          'Location': successUrl 
        }
      });

    } else if (orderStatus === 'Failure' || orderStatus === 'Aborted') {
      // Update status to failed
      await supabase
        .from('subscriptions')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('razorpay_order_id', orderId);

      console.log('Payment failed for order:', orderId, 'Status:', orderStatus);

      // Redirect to failure page
      const failureUrl = `https://geduhub.lovable.app/?payment=failed`;
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders, 
          'Location': failureUrl 
        }
      });
    }

    // Default redirect
    return new Response(null, {
      status: 302,
      headers: { 
        ...corsHeaders, 
        'Location': 'https://geduhub.lovable.app' 
      }
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
