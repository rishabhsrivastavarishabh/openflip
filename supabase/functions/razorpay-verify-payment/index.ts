import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { createHmac } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[RAZORPAY-VERIFY-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!razorpayKeySecret) {
      throw new Error("Razorpay secret not configured");
    }

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      type,
      billing_cycle,
      promo_code,
      metadata 
    } = await req.json();

    logStep("Verifying payment", { razorpay_order_id, razorpay_payment_id });

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const encoder = new TextEncoder();
    const key = encoder.encode(razorpayKeySecret);
    const data_to_sign = encoder.encode(body);
    
    const hmac = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signature = await crypto.subtle.sign("HMAC", hmac, data_to_sign);
    const expectedSignature = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (expectedSignature !== razorpay_signature) {
      logStep("Signature verification failed");
      throw new Error("Payment verification failed - invalid signature");
    }

    logStep("Signature verified successfully");

    // Fetch payment details from Razorpay
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    
    const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
      headers: {
        "Authorization": `Basic ${auth}`,
      },
    });

    if (!paymentResponse.ok) {
      throw new Error("Failed to fetch payment details");
    }

    const payment = await paymentResponse.json();
    logStep("Payment details fetched", { status: payment.status, amount: payment.amount });

    if (payment.status !== 'captured') {
      throw new Error(`Payment not captured. Status: ${payment.status}`);
    }

    const amountInRupees = payment.amount / 100;

    // Handle different payment types
    if (type === 'subscription') {
      // Create or update subscription
      const periodEnd = billing_cycle === 'yearly' 
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const { data: existingSub } = await supabaseClient
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (existingSub) {
        await supabaseClient
          .from('user_subscriptions')
          .update({
            status: 'active',
            billing_cycle: billing_cycle,
            current_period_start: new Date().toISOString(),
            current_period_end: periodEnd.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingSub.id);
      } else {
        await supabaseClient
          .from('user_subscriptions')
          .insert({
            user_id: user.id,
            status: 'active',
            billing_cycle: billing_cycle,
            current_period_start: new Date().toISOString(),
            current_period_end: periodEnd.toISOString(),
          });
      }

      // Update verified status
      await supabaseClient
        .from('profiles')
        .update({ is_verified: true })
        .eq('id', user.id);

      logStep("Subscription activated", { billing_cycle, periodEnd });
    } else if (type === 'boost') {
      // Activate boost campaign
      const campaignId = metadata?.campaign_id;
      if (campaignId) {
        const durationDays = parseInt(metadata?.duration_days || '7');
        await supabaseClient
          .from('boost_campaigns')
          .update({
            status: 'active',
            starts_at: new Date().toISOString(),
            ends_at: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq('id', campaignId);
        
        logStep("Boost campaign activated", { campaignId });
      }
    }

    // Record payment history
    await supabaseClient
      .from('payment_history')
      .insert({
        user_id: user.id,
        amount: amountInRupees,
        currency: 'INR',
        status: 'completed',
        description: type === 'subscription' 
          ? `${billing_cycle} subscription` 
          : `Boost campaign payment`,
        stripe_payment_intent_id: razorpay_payment_id, // Reusing column for razorpay ID
      });

    // Record promo code usage if applicable
    if (promo_code && payment.notes?.discount_amount) {
      const { data: promoData } = await supabaseClient
        .from('promo_codes')
        .select('id')
        .eq('code', promo_code.toUpperCase())
        .single();

      if (promoData) {
        await supabaseClient
          .from('promo_code_usage')
          .insert({
            promo_code_id: promoData.id,
            user_id: user.id,
            discount_applied: payment.notes.discount_amount,
          });

        await supabaseClient
          .from('promo_codes')
          .update({ current_uses: supabaseClient.rpc('increment_uses') })
          .eq('id', promoData.id);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      payment_id: razorpay_payment_id,
      amount: amountInRupees,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
