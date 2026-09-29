import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const CATEGORIES = ["nudity_sexual", "violence_gore", "hate_harassment", "self_harm", "spam_scam", "illegal_goods", "misinformation", "copyright", "minor_safety", "none"];

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
    const [{ data: isAdmin }, { data: isMod }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: user.id, _role: "moderator" }),
    ]);
    if (!isAdmin && !isMod) return json({ error: "Only moderators can use this." }, 403);

    const body = await req.json().catch(() => ({}));
    const caption = typeof body.caption === "string" ? body.caption.slice(0, 2200) : "";
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 200) : "";
    let imageUrl = typeof body.image_url === "string" ? body.image_url.trim() : "";
    if (imageUrl && !/^https:\/\//i.test(imageUrl)) return json({ error: "Image link must start with https://" }, 400);
    if (!caption.trim() && !imageUrl) return json({ error: "Add a caption or an image to review." }, 400);

    const content: unknown[] = [{
      type: "input_text",
      text: `You are a content moderation assistant for the Openflip social app. Review this reported post.${reason ? ` Reporter's reason: "${reason}".` : ""}\nCaption: """${caption || "(none)"}"""\n\nIdentify likely community-guideline violations. Allowed categories: ${CATEGORIES.join(", ")}. Respond with JSON only: {"verdict":"likely_violation"|"possible_violation"|"no_violation","severity":"low"|"medium"|"high","violations":[{"category":"...","confidence":0-1,"evidence":"short, under 20 words"}],"summary":"2-3 sentence review summary for the moderator","suggested_action":"remove"|"warn"|"dismiss"|"escalate"}. Be factual; do not invent details not visible in the caption or image.`,
    }];
    if (imageUrl) content.push({ type: "input_image", image_url: imageUrl });

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
        input: [{ role: "user", content }],
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
      }),
    });

    if (!res.ok || !res.body) {
      const status = res.status;
      const detail = await res.text().catch(() => "");
      console.error("gateway error", status, detail);
      const msg = status === 429 ? "Too many requests right now — try again in a moment."
        : status === 402 ? "AI credits have run out for this app."
        : status === 403 ? "AI review is unavailable right now."
        : status === 400 ? "The image couldn't be read. Check the link and try again."
        : "Couldn't review this post.";
      return json({ error: msg }, status >= 400 ? status : 500);
    }

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
    if (!out) {
      console.error("empty output", streamErr);
      return json({ error: "The AI couldn't review this post." }, 502);
    }
    let parsed: any = {};
    try { const m = out.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : {}; } catch { parsed = {}; }
    if (!parsed.summary) return json({ error: "The AI couldn't review this post." }, 502);
    return json({ review: parsed });
  } catch (e) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    console.error(e);
    return json({ error: "Something went wrong." }, 500);
  }
});
