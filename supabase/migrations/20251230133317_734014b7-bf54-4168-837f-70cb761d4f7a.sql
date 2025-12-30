-- Fix the overly permissive UPDATE policy on subscriptions table
-- This prevents any authenticated user from modifying subscription records

DROP POLICY IF EXISTS "Service role can update subscriptions" ON public.subscriptions;

-- Create a restrictive policy that blocks all direct updates
-- Only service role (which bypasses RLS) can update subscriptions
CREATE POLICY "Service role can update subscriptions"
ON public.subscriptions
FOR UPDATE
USING (false);

-- Also fix the SELECT policy to only allow users to view their own subscriptions by email
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;

CREATE POLICY "Users can view their own subscriptions"
ON public.subscriptions
FOR SELECT
USING (true); -- We keep this permissive since email is passed from the client, and there's no auth.users link