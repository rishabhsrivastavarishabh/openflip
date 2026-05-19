import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[RAZORPAY-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Webhook received");

    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!razorpayKeySecret) {
      throw new Error("Razorpay secret not configured");
    }

    // Verify webhook signature — MANDATORY
    const signature = req.headers.get("x-razorpay-signature");
    const body = await req.text();

    if (!signature) {
      logStep("Missing signature header");
      return new Response("Missing signature", { status: 401 });
    }

    {
      const encoder = new TextEncoder();
      const key = encoder.encode(razorpayKeySecret);
      const data = encoder.encode(body);

      const hmac = await crypto.subtle.importKey(
        "raw",
        key,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );

      const expectedSig = await crypto.subtle.sign("HMAC", hmac, data);
      const expectedSignature = Array.from(new Uint8Array(expectedSig))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      if (expectedSignature !== signature) {
        logStep("Signature verification failed");
        return new Response("Invalid signature", { status: 400 });
      }
    }

    const event = JSON.parse(body);
    logStep("Event type", { type: event.event });

    const payload = event.payload;

    switch (event.event) {
      case "payment.captured": {
        const payment = payload.payment.entity;
        const userId = payment.notes?.user_id;
        
        if (userId) {
          await supabaseClient
            .from('payment_history')
            .insert({
              user_id: userId,
              amount: payment.amount / 100,
              currency: payment.currency,
              status: 'completed',
              stripe_payment_intent_id: payment.id,
              description: 'Payment captured',
            });
        }
        logStep("Payment captured", { paymentId: payment.id });
        break;
      }

      case "payment.failed": {
        const payment = payload.payment.entity;
        const userId = payment.notes?.user_id;
        
        if (userId) {
          await supabaseClient
            .from('payment_history')
            .insert({
              user_id: userId,
              amount: payment.amount / 100,
              currency: payment.currency,
              status: 'failed',
              stripe_payment_intent_id: payment.id,
              description: `Payment failed: ${payment.error_description || 'Unknown error'}`,
            });
        }
        logStep("Payment failed", { paymentId: payment.id });
        break;
      }

      case "subscription.activated": {
        const subscription = payload.subscription.entity;
        const userId = subscription.notes?.user_id;
        const billingCycle = subscription.notes?.billing_cycle || 'monthly';
        
        if (userId) {
          const periodEnd = billingCycle === 'yearly'
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          await supabaseClient
            .from('user_subscriptions')
            .upsert({
              user_id: userId,
              status: 'active',
              billing_cycle: billingCycle,
              current_period_start: new Date().toISOString(),
              current_period_end: periodEnd.toISOString(),
            }, { onConflict: 'user_id' });

          await supabaseClient
            .from('profiles')
            .update({ is_verified: true })
            .eq('id', userId);
        }
        logStep("Subscription activated", { subscriptionId: subscription.id });
        break;
      }

      case "subscription.charged": {
        const subscription = payload.subscription.entity;
        const payment = payload.payment?.entity;
        const userId = subscription.notes?.user_id;
        const billingCycle = subscription.notes?.billing_cycle || 'monthly';
        
        if (userId) {
          const periodEnd = billingCycle === 'yearly'
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          await supabaseClient
            .from('user_subscriptions')
            .update({
              status: 'active',
              current_period_start: new Date().toISOString(),
              current_period_end: periodEnd.toISOString(),
            })
            .eq('user_id', userId);

          if (payment) {
            await supabaseClient
              .from('payment_history')
              .insert({
                user_id: userId,
                amount: payment.amount / 100,
                currency: payment.currency,
                status: 'completed',
                stripe_payment_intent_id: payment.id,
                description: 'Subscription renewal',
              });
          }
        }
        logStep("Subscription charged", { subscriptionId: subscription.id });
        break;
      }

      case "subscription.cancelled": {
        const subscription = payload.subscription.entity;
        const userId = subscription.notes?.user_id;
        
        if (userId) {
          await supabaseClient
            .from('user_subscriptions')
            .update({
              status: 'cancelled',
              cancel_at_period_end: true,
            })
            .eq('user_id', userId);
        }
        logStep("Subscription cancelled", { subscriptionId: subscription.id });
        break;
      }

      case "subscription.expired": {
        const subscription = payload.subscription.entity;
        const userId = subscription.notes?.user_id;
        
        if (userId) {
          await supabaseClient
            .from('user_subscriptions')
            .update({ status: 'expired' })
            .eq('user_id', userId);

          await supabaseClient
            .from('profiles')
            .update({ is_verified: false })
            .eq('id', userId);
        }
        logStep("Subscription expired", { subscriptionId: subscription.id });
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.event });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
