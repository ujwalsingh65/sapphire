CREATE TABLE public.signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  symbol_name TEXT NOT NULL,
  interval TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('BUY','SELL','NEUTRAL')),
  confidence NUMERIC NOT NULL,
  rationale TEXT NOT NULL,
  entry NUMERIC,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  support NUMERIC,
  resistance NUMERIC,
  indicators JSONB,
  candles JSONB,
  backtest JSONB,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view signals"
  ON public.signals FOR SELECT
  USING (true);

CREATE POLICY "Public can insert signals"
  ON public.signals FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can update signals"
  ON public.signals FOR UPDATE
  USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_signals_updated_at
  BEFORE UPDATE ON public.signals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_signals_created_at ON public.signals(created_at DESC);
CREATE INDEX idx_signals_symbol ON public.signals(symbol);