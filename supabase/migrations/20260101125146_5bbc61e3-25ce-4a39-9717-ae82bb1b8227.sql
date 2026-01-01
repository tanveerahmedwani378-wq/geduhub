-- Add SELECT policy to block all client reads (service role bypasses this)
CREATE POLICY "Block all client reads"
ON public.subscriptions
FOR SELECT
USING (false);