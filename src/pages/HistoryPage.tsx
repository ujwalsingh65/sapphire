import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDown, ArrowUp, Minus, Loader2 } from "lucide-react";

interface Row {
  id: string;
  created_at: string;
  symbol: string;
  symbol_name: string;
  interval: string;
  direction: string;
  confidence: number;
  rationale: string;
  entry: number | null;
  stop_loss: number | null;
  take_profit: number | null;
}

const HistoryPage = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("signals")
        .select(
          "id,created_at,symbol,symbol_name,interval,direction,confidence,rationale,entry,stop_loss,take_profit",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (!error && data) setRows(data as Row[]);
      setLoading(false);
    })();
  }, []);

  return (
    <section className="container py-8">
      <h2 className="text-2xl font-bold tracking-tight">Signal history</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Last 100 confirmed signals — public shared history.
      </p>

      {loading && (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="mt-8 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No signals yet. Run an analysis to populate history.
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        {rows.map((r) => {
          const Icon =
            r.direction === "BUY" ? ArrowUp : r.direction === "SELL" ? ArrowDown : Minus;
          const tone =
            r.direction === "BUY"
              ? "text-bull"
              : r.direction === "SELL"
              ? "text-bear"
              : "text-neutral-signal";
          return (
            <article
              key={r.id}
              className="rounded-xl border border-border bg-card p-4 shadow-card"
            >
              <header className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${tone}`} />
                    <span className={`font-semibold ${tone}`}>{r.direction}</span>
                    <span className="text-xs text-muted-foreground">{r.interval}</span>
                  </div>
                  <p className="text-sm font-medium">{r.symbol_name}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono-tab text-lg font-bold">
                    {Math.round(r.confidence)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
              </header>
              {r.entry != null && (
                <div className="mt-2 grid grid-cols-3 gap-2 rounded-md border border-border/60 bg-secondary/40 p-2 text-xs font-mono-tab">
                  <Stat label="Entry" v={r.entry} />
                  <Stat label="SL" v={r.stop_loss} tone="text-bear" />
                  <Stat label="TP" v={r.take_profit} tone="text-bull" />
                </div>
              )}
              <p className="mt-2 line-clamp-3 text-xs text-foreground/80">
                {r.rationale}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
};

function Stat({ label, v, tone }: { label: string; v: number | null; tone?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${tone ?? ""}`}>{v?.toFixed(2) ?? "—"}</p>
    </div>
  );
}

export default HistoryPage;