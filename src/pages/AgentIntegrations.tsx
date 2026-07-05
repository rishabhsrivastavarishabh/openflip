import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, Bot, Shield, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type Tool = {
  name: string;
  title: string;
  description: string;
  readOnly: boolean;
  params?: { name: string; required?: boolean; description: string; default?: string }[];
  examples: string[];
};

const TOOLS: Tool[] = [
  {
    name: 'get_my_profile',
    title: 'Get my Openflip profile',
    description:
      'Fetch the signed-in Openflip user\'s profile: username, full name, bio, website, verification status, and account type.',
    readOnly: true,
    examples: [
      'What\'s on my Openflip profile right now?',
      'Am I verified on Openflip?',
      'Show me my Openflip bio and website.',
    ],
  },
  {
    name: 'list_my_posts',
    title: 'List my recent posts',
    description:
      'Return the signed-in user\'s most recent Openflip posts (id, caption, media type, created_at).',
    readOnly: true,
    params: [
      { name: 'limit', description: 'Number of posts to return (1–50).', default: '10' },
    ],
    examples: [
      'Show me my last 5 Openflip posts.',
      'What did I post on Openflip this week?',
      'Summarise the captions of my 10 most recent posts.',
    ],
  },
  {
    name: 'search_users',
    title: 'Search Openflip users',
    description:
      'Search public Openflip profiles by username or full name. Returns up to 20 matches.',
    readOnly: true,
    params: [
      { name: 'query', required: true, description: 'Text to match against username or full name.' },
    ],
    examples: [
      'Find Openflip users named "priya".',
      'Search Openflip for @openflip.',
      'Look up creators called "studio" on Openflip.',
    ],
  },
];

const MCP_URL = 'https://openflip.lovable.app/functions/v1/mcp';

export default function AgentIntegrationsPage() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      toast.success('Copied');
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <header className="sticky top-0 z-40 glass-strong border-b px-4 py-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-semibold text-lg">Agent integrations</h1>
            <p className="text-xs text-muted-foreground">MCP tools your AI assistants can use</p>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-6">
        <Card className="p-4 space-y-3 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold">Connect Openflip to ChatGPT, Claude, Cursor & more</p>
              <p className="text-sm text-muted-foreground">
                Openflip exposes a secure MCP server. Add this URL to your AI client and sign in
                with your Openflip account — the assistant can then use your profile and posts on
                your behalf.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-background/70 border p-2">
            <code className="text-xs flex-1 truncate select-all">{MCP_URL}</code>
            <Button size="sm" variant="ghost" onClick={() => copy('url', MCP_URL)}>
              {copied === 'url' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            OAuth 2.1 — you approve every client on the consent screen.
          </div>
        </Card>

        <div>
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3 px-1">
            Available tools ({TOOLS.length})
          </h2>
          <div className="space-y-3">
            {TOOLS.map((tool) => (
              <Card key={tool.name} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{tool.title}</h3>
                      {tool.readOnly && (
                        <Badge variant="secondary" className="text-[10px]">Read-only</Badge>
                      )}
                    </div>
                    <code className="text-xs text-muted-foreground">{tool.name}</code>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">{tool.description}</p>

                {tool.params && tool.params.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Parameters
                    </p>
                    <div className="rounded-lg border divide-y">
                      {tool.params.map((p) => (
                        <div key={p.name} className="p-2.5 text-sm">
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{p.name}</code>
                            {p.required ? (
                              <span className="text-[10px] text-destructive font-medium">required</span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">optional{p.default ? ` · default ${p.default}` : ''}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Example requests
                  </p>
                  <div className="space-y-1.5">
                    {tool.examples.map((ex) => (
                      <button
                        key={ex}
                        onClick={() => copy(`${tool.name}-${ex}`, ex)}
                        className="w-full text-left flex items-start gap-2 p-2.5 rounded-lg border hover:bg-accent/50 transition-colors text-sm group"
                      >
                        <span className="flex-1">"{ex}"</span>
                        {copied === `${tool.name}-${ex}` ? (
                          <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Card className="p-4 space-y-2">
          <p className="font-medium text-sm">How to connect</p>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal ml-5">
            <li>In your AI client (ChatGPT, Claude, Cursor), add a new MCP server.</li>
            <li>Paste the server URL above.</li>
            <li>Sign in with your Openflip account and approve on the consent screen.</li>
            <li>The tools listed here become available to the assistant.</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
