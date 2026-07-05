// Ambient declaration for the `process` global used by mcp-js tool handlers.
// Tools run inside the generated Supabase Edge Function (Deno) at runtime, but
// Vite still typechecks the source. This declaration keeps TS happy without
// pulling in @types/node.
declare const process: {
  env: Record<string, string | undefined>;
};
