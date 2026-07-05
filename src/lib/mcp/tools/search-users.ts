import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
declare const process: { env: Record<string, string | undefined> };

function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "search_users",
  title: "Search Openflip users",
  description:
    "Search public Openflip profiles by username or full name. Returns up to 20 matches.",
  inputSchema: {
    query: z.string().trim().min(1).describe("Search text to match against username or full name."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const pattern = `%${query.replace(/[%_]/g, "\\$&")}%`;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, is_verified, account_type")
      .or(`username.ilike.${pattern},full_name.ilike.${pattern}`)
      .limit(20);

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { users: data ?? [] },
    };
  },
});
