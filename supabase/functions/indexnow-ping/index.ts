// IndexNow ping proxy — accepts a list of URLs from the client and submits
// them to IndexNow. Bing forwards submissions to other IndexNow participants
// (Yandex, Seznam, Naver, etc.). Google does not use IndexNow but still
// discovers new URLs via the sitemap.
//
// Public endpoint (verify_jwt = false) — safe because the IndexNow key is
// public by design (served at /<key>.txt on the host) and IndexNow itself
// only accepts URLs on the same host as the key.

const KEY = "3cb5c9853e90d73686dc34daf02843de";
const HOST = "www.openflip.in";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const rawUrls: unknown = body?.urls ?? (body?.url ? [body.url] : []);
    if (!Array.isArray(rawUrls) || rawUrls.length === 0) {
      return new Response(JSON.stringify({ error: "urls[] required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only accept absolute URLs that match our host.
    const urlList = (rawUrls as unknown[])
      .filter((u): u is string => typeof u === "string")
      .map((u) => {
        try {
          const parsed = new URL(u);
          return parsed.host === HOST ? parsed.toString() : null;
        } catch {
          return null;
        }
      })
      .filter((u): u is string => !!u)
      .slice(0, 10000);

    if (urlList.length === 0) {
      return new Response(JSON.stringify({ error: "no valid urls for host" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      host: HOST,
      key: KEY,
      keyLocation: KEY_LOCATION,
      urlList,
    };

    const res = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });

    const text = await res.text().catch(() => "");
    return new Response(
      JSON.stringify({ ok: res.ok, status: res.status, count: urlList.length, upstream: text.slice(0, 500) }),
      { status: res.ok ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
