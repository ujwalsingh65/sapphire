const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const text = (url.searchParams.get("text") ?? "").slice(0, 64);
    const type = (url.searchParams.get("type") ?? "").slice(0, 32);
    if (!text.trim()) {
      return new Response("[]", {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const tvUrl =
      `https://symbol-search.tradingview.com/symbol_search/?text=${encodeURIComponent(text)}` +
      `&type=${encodeURIComponent(type)}&hl=1&exchange=&lang=en&domain=production`;
    const r = await fetch(tvUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Origin: "https://www.tradingview.com",
        Referer: "https://www.tradingview.com/",
      },
    });
    const body = await r.text();
    return new Response(body, {
      status: r.status,
      headers: {
        ...corsHeaders,
        "Content-Type": r.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "proxy failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});