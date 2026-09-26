import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Please sign in first." }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Please sign in first." }, 401);

    const { interests } = await req.json().catch(() => ({}));
    const text = typeof interests === "string" ? interests.trim().slice(0, 500) : "";
    if (text.length < 3) return json({ error: "Tell us a little about your interests." }, 400);

    // Only public profiles are candidates.
    const { data: candidates, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, bio, avatar_url, is_verified")
      .eq("is_private", false)
      .neq("id", user.id)
      .not("username", "is", null)
      .limit(200);
    if (error) throw error;
    if (!candidates?.length) return json({ recommendations: [] });

    const list = candidates
      .map((c) => `${c.username} | ${c.full_name ?? ""} | ${(c.bio ?? "").replace(/\s+/g, " ").slice(0, 160)}${c.is_verified ? " | verified" : ""}`)
      .join("\n");

    const prompt = `A user of the Openflip social app describes their interests as:\n"""${text}"""\n\nHere are public profiles (username | name | bio):\n${list}\n\nPick up to 8 profiles most relevant to the interests. Only use usernames from the list. Respond with JSON only, no prose: {"recommendations":[{"username":"...","reason":"one short sentence, under 20 words"}]}. If nothing fits, return an empty array.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      signal: req.signal,
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": Deno.env.get("LOVABLE_API_KEY")!,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        input: prompt,
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
      }),
    });

    if (!res.ok || !res.body) {
      const status = res.status;
      const msg = status === 429 ? "Too many requests right now — try again in a moment."
        : status === 402 ? "AI credits have run out for this app."
        : status === 403 ? "AI recommendations are unavailable right now."
        : "Couldn't get recommendations.";
      console.error("gateway error", status, await res.text().catch(() => ""));
      return json({ error: msg }, status >= 400 ? status : 500);
    }

    // Read SSE and accumulate output text.
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", out = "", streamErr = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const ev = JSON.parse(data);
          if (ev.type === "response.output_text.delta") out += ev.delta ?? "";
          else if (ev.type === "error" || ev.type === "response.failed") streamErr = ev.message ?? ev.response?.error?.message ?? "failed";
        } catch { /* ignore */ }
      }
    }
    if (!out && streamErr) return json({ error: "Couldn't get recommendations." }, 502);

    let parsed: { recommendations?: { username: string; reason: string }[] } = {};
    try {
      const m = out.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    } catch { parsed = {}; }

    const byName = new Map(candidates.map((c) => [c.username!.toLowerCase(), c]));
    const seen = new Set<string>();
    const recommendations = (parsed.recommendations ?? [])
      .filter((r) => r && typeof r.username === "string")
      .map((r) => ({ p: byName.get(r.username.replace(/^@/, "").toLowerCase()), reason: String(r.reason ?? "").slice(0, 160) }))
      .filter((r) => r.p && !seen.has(r.p.id) && seen.add(r.p.id))
      .slice(0, 8)
      .map((r) => ({ ...r.p!, reason: r.reason }));

    return json({ recommendations });
  } catch (e) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    console.error(e);
    return json({ error: "Something went wrong." }, 500);
  }
});
