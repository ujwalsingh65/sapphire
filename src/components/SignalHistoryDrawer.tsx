import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Minus, Loader2, RefreshCw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface SignalRow {
  id: string;
  symbol: string;
  symbol_name: string;
  interval: string;
  direction: "BUY" | "SELL" | "NEUTRAL";
  confidence: number;
  entry: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  rationale: string;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: number; // bump to trigger refetch
}

const dirIcon = { BUY: ArrowUp, SELL: ArrowDown, NEUTRAL: Minus } as const;
const dirTone = {
  BUY: "text-bull",
  SELL: "text-bear",
  NEUTRAL: "text-neutral-signal",
} as const;

export const SignalHistoryDrawer = ({ open, onOpenChange, version }: Props) => {
  const [rows, setRows] = useState<SignalRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("signals")
      .select("id, symbol, symbol_name, interval, direction, confidence, entry, stop_loss, take_profit, rationale, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) setRows(data as SignalRow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open, version]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[380px] sm:w-[420px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>Signal History</SheetTitle>
            <Button size="icon" variant="ghost" onClick={load} disabled={loading} aria-label="Refresh">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
          <SheetDescription>
            Last 50 confirmed signals (shared across all users).
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {!loading && rows.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No signals saved yet.
            </p>
          )}
          {rows.map((r) => {
            const Icon = dirIcon[r.direction];
            const tone = dirTone[r.direction];
            return (
              <div
                key={r.id}
                className="rounded-lg border border-border bg-card p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${tone}`} strokeWidth={2.5} />
                      <span className={`font-bold ${tone}`}>{r.direction}</span>
                      <span className="text-xs text-muted-foreground">
                        · {r.symbol_name} · {r.interval}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-foreground/80">
                      {r.rationale}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-mono-tab text-sm font-semibold">
                      {Math.round(Number(r.confidence))}%
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
                {r.entry != null && r.stop_loss != null && r.take_profit != null && (
                  <div className="mt-2 flex justify-between rounded-md border border-border/60 bg-secondary/40 px-2 py-1 font-mono-tab text-[11px]">
                    <span>
                      <span className="text-muted-foreground">E </span>
                      {Number(r.entry).toFixed(2)}
                    </span>
                    <span className="text-bear">
                      <span className="text-muted-foreground">SL </span>
                      {Number(r.stop_loss).toFixed(2)}
                    </span>
                    <span className="text-bull">
                      <span className="text-muted-foreground">TP </span>
                      {Number(r.take_profit).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};