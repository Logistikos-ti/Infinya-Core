-- Add tamanho column to produtos
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS tamanho text;
