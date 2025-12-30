-- Create a unique partial index to prevent duplicate pending orders per email
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_pending_order_per_email 
ON public.subscriptions(email) 
WHERE status = 'pending';