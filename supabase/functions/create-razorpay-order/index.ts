import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting: 5 orders per hour per IP
const rateLimits = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting by IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               req.headers.get('x-real-ip') || 
               'unknown';
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

    // Cleanup old rate limit entries periodically
    if (Math.random() < 0.1) { // 10% chance to cleanup on each request
      const cutoff = now;
      for (const [key, value] of rateLimits.entries()) {
        if (value.reset < cutoff) {
          rateLimits.delete(key);
        }
      }
    }

    const { email, testMode } = await req.json();

    // Validate email format
    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      console.log(`Invalid email format: ${trimmedEmail}`);
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit email length to prevent abuse
    if (trimmedEmail.length > 254) {
      return new Response(
        JSON.stringify({ error: 'Email address too long' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!keyId || !keySecret) {
      console.error('Razorpay credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Payment configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client early to check for existing pending orders
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check for existing pending order for this email (handled by unique index, but good to check)
    const { data: existingOrder } = await supabase
      .from('subscriptions')
      .select('razorpay_order_id, created_at')
      .eq('email', trimmedEmail)
      .eq('status', 'pending')
      .maybeSingle();

    // Determine amount (INR - Razorpay uses smallest currency unit: paise)
    const amount = 100; // ₹1 = 100 paise

    if (existingOrder) {
      // Return existing order if it's less than 30 minutes old
      const orderAge = now - new Date(existingOrder.created_at).getTime();
      if (orderAge < 30 * 60 * 1000 && !testMode) {
        console.log(`Returning existing pending order for: ${trimmedEmail}`);
        return new Response(
          JSON.stringify({
            orderId: existingOrder.razorpay_order_id,
            amount: 100,
            currency: 'INR',
            keyId
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Delete old pending order to allow new one
        await supabase
          .from('subscriptions')
          .delete()
          .eq('email', trimmedEmail)
          .eq('status', 'pending');
      }
    }

    // Create Razorpay order
    console.log(`Creating order for ${trimmedEmail} with amount: ${amount} paise (testMode: ${testMode})`);
    const orderData = {
      amount: amount,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: { email: trimmedEmail, testMode: testMode ? 'true' : 'false' }
    };

    const auth = btoa(`${keyId}:${keySecret}`);
    
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    if (!razorpayResponse.ok) {
      const errorText = await razorpayResponse.text();
      console.error('Razorpay error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to create order' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const order = await razorpayResponse.json();
    console.log('Razorpay order created:', order.id, 'for email:', trimmedEmail);

    // Save order to database
    const { error: dbError } = await supabase.from('subscriptions').insert({
      email: trimmedEmail,
      razorpay_order_id: order.id,
      amount: amount,
      currency: 'INR',
      status: 'pending'
    });

    if (dbError) {
      console.error('Database error:', dbError);
      // Don't fail the request if DB insert fails - the order was created in Razorpay
    }

    return new Response(
      JSON.stringify({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId
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
