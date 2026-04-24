CREATE POLICY "Block client deletes"
ON public.subscriptions
FOR DELETE
USING (false);