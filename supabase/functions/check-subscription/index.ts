import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    
    // If no auth header, check if email was provided in body (for non-authenticated flow)
    if (!authHeader) {
      // For unauthenticated requests, require email in body but only allow checking
      const { email } = await req.json();
      
      if (!email) {
        return new Response(
          JSON.stringify({ isPremium: false, error: 'Email required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // For unauthenticated requests, only return boolean status (no details)
      const { data, error } = await supabase
        .from('subscriptions')
        .select('expires_at')
        .eq('email', email)
        .eq('status', 'active')
        .gte('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return new Response(
        JSON.stringify({ 
          isPremium: !error && !!data,
          expiresAt: data?.expires_at || null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For authenticated requests, verify the user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user?.email) {
      return new Response(
        JSON.stringify({ isPremium: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use the authenticated user's email - they can only check their own subscription
    const userEmail = user.email;
    console.log('Checking subscription for authenticated user:', userEmail);

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('email', userEmail)
      .eq('status', 'active')
      .gte('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return new Response(
        JSON.stringify({ isPremium: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return full details only for authenticated users checking their own subscription
    return new Response(
      JSON.stringify({ 
        isPremium: true, 
        expiresAt: data.expires_at,
        subscription: {
          id: data.id,
          createdAt: data.created_at,
          expiresAt: data.expires_at
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error checking subscription:', error);
    return new Response(
      JSON.stringify({ isPremium: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
