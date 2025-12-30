-- Remove the overly permissive SELECT policy that exposes all subscription data
-- All reads go through edge functions with service role, so no public SELECT is needed
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;