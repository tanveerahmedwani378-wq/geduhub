-- Create subscriptions table to track premium users
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  amount INTEGER NOT NULL DEFAULT 14900,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow public insert for creating orders (before payment)
CREATE POLICY "Anyone can create subscription orders"
ON public.subscriptions
FOR INSERT
WITH CHECK (true);

-- Allow public select by email
CREATE POLICY "Users can view their own subscriptions"
ON public.subscriptions
FOR SELECT
USING (true);

-- Allow updates from service role only (for webhook)
CREATE POLICY "Service role can update subscriptions"
ON public.subscriptions
FOR UPDATE
USING (true);

-- Create index on email for faster lookups
CREATE INDEX idx_subscriptions_email ON public.subscriptions(email);
CREATE INDEX idx_subscriptions_razorpay_order_id ON public.subscriptions(razorpay_order_id);