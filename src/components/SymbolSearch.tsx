import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface TVSymbol {
  symbol: string; // e.g. "AAPL"
  description: string;
  exchange: string; // e.g. "NASDAQ"
  type: string; // e.g. "stock", "crypto", "forex", "futures", "index"
  full: string; // "NASDAQ:AAPL"
}

interface Props {
  value: string; // current TV symbol e.g. "TVC:GOLD"
  label?: string;
  onChange: (sym: TVSymbol) => void;
}

const TYPES = ["all", "stock", "crypto", "forex", "futures", "index", "economic"] as const;

export function SymbolSearch({ value, label, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("all");
  const [results, setResults] = useState<TVSymbol[]>([]);
  const [loading, setLoading] = useState(false);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    const reqId = ++reqIdRef.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const projectId = (import.meta as any).env.VITE_SUPABASE_PROJECT_ID;
        const url =
          `https://${projectId}.functions.supabase.co/symbol-search` +
          `?text=${encodeURIComponent(trimmed)}&type=${type === "all" ? "" : type}`;
        const { data: sess } = await supabase.auth.getSession();
        const token =
          sess?.session?.access_token ??
          (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(url, {
          headers: {
            apikey: (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (reqId !== reqIdRef.current) return;
        const list: TVSymbol[] = (Array.isArray(data) ? data : []).slice(0, 50).map((d: any) => ({
          symbol: stripTags(d.symbol ?? ""),
          description: stripTags(d.description ?? ""),
          exchange: d.exchange ?? "",
          type: d.type ?? "",
          full: `${d.exchange ?? ""}:${stripTags(d.symbol ?? "")}`,
        }));
        setResults(list);
      } catch (e) {
        console.error("symbol search failed", e);
        if (reqId === reqIdRef.current) setResults([]);
      } finally {
        if (reqId === reqIdRef.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, type, open]);

  const triggerLabel = useMemo(() => label || value, [label, value]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="min-w-[180px] justify-between gap-2">
          <span className="truncate">{triggerLabel}</span>
          <Search className="h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Search market</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
          <Input
            autoFocus
            placeholder="Search any symbol — AAPL, BTCUSD, EURUSD, GOLD…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 pr-9"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 opacity-60 hover:opacity-100"
              aria-label="Clear"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {TYPES.map((t) => (
            <Button
              key={t}
              variant={type === t ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs capitalize"
              onClick={() => setType(t)}
            >
              {t}
            </Button>
          ))}
        </div>
        <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border">
          {loading && (
            <div className="p-4 text-sm text-muted-foreground">Searching…</div>
          )}
          {!loading && q && results.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">No results.</div>
          )}
          {!loading && !q && (
            <div className="p-4 text-sm text-muted-foreground">
              Type to search across all TradingView markets.
            </div>
          )}
          <ul>
            {results.map((r) => (
              <li key={`${r.full}-${r.type}`}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(r);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 border-b border-border/60 px-3 py-2 text-left hover:bg-secondary/60"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-tab text-sm font-semibold">
                        {r.symbol}
                      </span>
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                        {r.exchange}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.description}
                    </p>
                  </div>
                  <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                    {r.type || "—"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function stripTags(s: string) {
  return s.replace(/<[^>]*>/g, "");
}