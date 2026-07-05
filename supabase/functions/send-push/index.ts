// Sends a web push notification to all of a user's saved subscriptions.
// Body: { user_id: string, title: string, body?: string, data?: object, tag?: string, type?: 'message'|'call'|string, requireInteraction?: boolean }
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { z } from 'npm:zod@3.23.8';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:support@openflip.in';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const BodySchema = z.object({
  user_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  body: z.string().max(500).optional(),
  data: z.record(z.any()).optional(),
  tag: z.string().max(200).optional(),
  type: z.string().max(50).optional(),
  requireInteraction: z.boolean().optional(),
  icon: z.string().url().optional(),
});

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Require authenticated caller (user JWT) OR service-role bypass (used by DB triggers).
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '');
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const isServiceRole = jwt === SERVICE_ROLE;
    if (!isServiceRole) {
      const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
      if (userErr || !userData.user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { user_id, title, body, data, tag, type, requireInteraction, icon } = parsed.data;

    const { data: subs, error: subsErr } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', user_id);

    if (subsErr) throw subsErr;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.stringify({
      title,
      body: body ?? '',
      tag,
      data: data ?? {},
      type,
      icon,
      requireInteraction: requireInteraction ?? type === 'call',
    });

    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: type === 'call' ? 30 : 60 * 60 * 24, urgency: type === 'call' ? 'high' : 'normal' },
        ),
      ),
    );

    // Prune dead subscriptions (410/404)
    const toDelete: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const status = (r.reason as any)?.statusCode;
        if (status === 404 || status === 410) toDelete.push(subs[i].id);
      }
    });
    if (toDelete.length) {
      await admin.from('push_subscriptions').delete().in('id', toDelete);
    }

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    return new Response(JSON.stringify({ sent, pruned: toDelete.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('send-push error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
