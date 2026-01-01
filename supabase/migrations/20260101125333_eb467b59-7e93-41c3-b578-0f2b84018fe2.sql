-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "Anyone can create subscription orders" ON public.subscriptions;

-- Drop the broken UPDATE policy
DROP POLICY IF EXISTS "Service role can update subscriptions" ON public.subscriptions;

-- Create restrictive INSERT policy - block all client inserts
-- Orders are created via edge functions using service role which bypasses RLS
CREATE POLICY "Block client inserts"
ON public.subscriptions
FOR INSERT
WITH CHECK (false);

-- Create restrictive UPDATE policy - block all client updates
-- Updates are done via edge functions using service role which bypasses RLS
CREATE POLICY "Block client updates"
ON public.subscriptions
FOR UPDATE
USING (false);