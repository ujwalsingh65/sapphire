import { useEffect, useRef } from "react";
import { useTheme } from "@/components/ThemeProvider";

interface Props {
  symbol: string; // TradingView symbol e.g. TVC:GOLD or NASDAQ:AAPL
  interval?: string; // 1, 5, 15, 60, D
  onSymbolChange?: (fullSymbol: string) => void; // called when user changes symbol inside the chart
}

declare global {
  interface Window {
    TradingView?: any;
  }
}

/**
 * Full TradingView Advanced Chart widget — exposes ALL standard tools:
 * drawing toolbar, 100+ indicators, chart styles, compare, save image,
 * symbol search, screenshot, hotlist, calendar, news, etc.
 */
export const TradingViewChart = ({ symbol, interval = "5", onSymbolChange }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(`tv_${Math.random().toString(36).slice(2)}`);
  const { resolvedTheme } = useTheme();
  const onSymbolChangeRef = useRef(onSymbolChange);
  onSymbolChangeRef.current = onSymbolChange;

  // Listen for symbol-change postMessage events emitted by the TradingView widget iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      try {
        // TradingView sends structured messages; symbol change carries a "name" and "data" field
        const msg = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        // The widget emits { name: "quoteUpdate" | "symbolChange" | ... , data: { ... } }
        // Symbol changes arrive as setSymbol or symbolChange events
        const name: string = msg?.name ?? msg?.type ?? "";
        if (/symbol/i.test(name)) {
          const sym: string =
            msg?.data?.symbol ??
            msg?.data?.name ??
            msg?.symbol ??
            "";
          if (sym && onSymbolChangeRef.current) {
            onSymbolChangeRef.current(sym);
          }
        }
      } catch {
        // ignore non-JSON or unrelated messages
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    const id = idRef.current;
    const mount = () => {
      if (!window.TradingView || !containerRef.current) return;
      containerRef.current.innerHTML = `<div id="${id}" style="height:100%;width:100%"></div>`;
      new window.TradingView.widget({
        autosize: true,
        symbol,
        interval,
        timezone: "Etc/UTC",
        theme: resolvedTheme === "light" ? "light" : "dark",
        style: "1",
        locale: "en",
        toolbar_bg: resolvedTheme === "light" ? "#ffffff" : "#0b1220",
        enable_publishing: false,
        allow_symbol_change: true,
        hide_side_toolbar: false,
        hide_top_toolbar: false,
        hide_legend: false,
        withdateranges: true,
        details: true,
        hotlist: true,
        calendar: true,
        news: ["headlines"],
        studies: ["RSI@tv-basicstudies", "MACD@tv-basicstudies"],
        show_popup_button: true,
        popup_width: "1000",
        popup_height: "650",
        container_id: id,
        // Sync symbol changes back to the app
        symbol_change_callback: (sym: string) => {
          if (onSymbolChangeRef.current) onSymbolChangeRef.current(sym);
        },
      });
    };

    if (window.TradingView) {
      mount();
    } else {
      const existing = document.getElementById("tv-script") as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener("load", mount, { once: true });
      } else {
        const s = document.createElement("script");
        s.id = "tv-script";
        s.src = "https://s3.tradingview.com/tv.js";
        s.async = true;
        s.onload = mount;
        document.body.appendChild(s);
      }
    }
  }, [symbol, interval, resolvedTheme]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden rounded-xl border border-border bg-card shadow-card"
    />
  );
};