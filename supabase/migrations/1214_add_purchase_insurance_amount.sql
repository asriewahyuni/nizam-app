-- Ensure purchase headers can store insurance separately from shipping.
-- Legacy databases may only have shipping_amount; keep insurance defaulted to 0.

ALTER TABLE public.purchases
ADD COLUMN IF NOT EXISTS insurance_amount DECIMAL(19,4) DEFAULT 0;

UPDATE public.purchases
SET insurance_amount = 0
WHERE insurance_amount IS NULL;
