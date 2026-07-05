// Fire-and-forget IndexNow submitter. Notifies Bing/Yandex/etc. that a URL
// was just created or updated so it can be crawled quickly. Google ignores
// IndexNow and still relies on the sitemap.
import { supabase } from '@/integrations/supabase/client';

const SITE = 'https://www.openflip.in';

export function pingIndexNow(paths: string | string[]): void {
  const list = (Array.isArray(paths) ? paths : [paths])
    .filter(Boolean)
    .map((p) => (p.startsWith('http') ? p : `${SITE}${p.startsWith('/') ? p : `/${p}`}`));
  if (list.length === 0) return;

  // Fire-and-forget — never block UI on this and never surface errors.
  supabase.functions
    .invoke('indexnow-ping', { body: { urls: list } })
    .catch(() => {});
}
