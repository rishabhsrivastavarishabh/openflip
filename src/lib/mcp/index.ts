import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyProfileTool from "./tools/get-my-profile";
import listMyPostsTool from "./tools/list-my-posts";
import searchUsersTool from "./tools/search-users";

// Build the OAuth issuer from the Supabase project ref (inlined by Vite at build
// time). The direct `https://<ref>.supabase.co` host is required — mcp-js
// validates the token issuer against the discovery document.
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "openflip-mcp",
  title: "Openflip",
  version: "0.1.0",
  instructions:
    "Tools for Openflip — the signed-in user's social profile, posts, and people search. Use `get_my_profile` to identify the current account, `list_my_posts` to fetch their recent posts, and `search_users` to find other Openflip users by name.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyProfileTool, listMyPostsTool, searchUsersTool],
});
