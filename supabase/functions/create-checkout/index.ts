import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

// INR Pricing - Stripe price IDs
const SUBSCRIPTION_PLANS = {
  monthly: {
    priceId: 'price_1SwxVBQUKes0XsxYJ9N882wn',
    productId: 'prod_Tun5w14Dic9AQf',
    price: 99, // ₹99
  },
  yearly: {
    priceId: 'price_1SwxVnQUKes0XsxYWJbL5R01',
    productId: 'prod_Tun5ROkSxQZKRK',
    price: 799, // ₹799
  },
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

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { priceId, billingCycle, promoCode } = await req.json();
    if (!priceId) throw new Error("Price ID is required");
    logStep("Request body parsed", { priceId, billingCycle, promoCode });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    
    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    }

    const origin = req.headers.get("origin") || "https://openflip.lovable.app";
    
    // Build checkout session params
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/settings?subscription=success`,
      cancel_url: `${origin}/settings?subscription=cancelled`,
      metadata: {
        user_id: user.id,
        billing_cycle: billingCycle || 'monthly',
      },
      payment_method_types: ['card'],
      billing_address_collection: 'required',
      phone_number_collection: {
        enabled: true,
      },
      tax_id_collection: {
        enabled: true,
      },
      currency: 'inr',
    };

    // If promo code provided, validate and apply discount
    if (promoCode) {
      logStep("Validating promo code", { promoCode });
      
      const { data: promoData, error: promoError } = await supabaseClient
        .rpc('validate_promo_code', { 
          code_input: promoCode, 
          user_id_input: user.id 
        });
      
      if (promoError) {
        logStep("Promo validation error", { error: promoError.message });
      } else if (promoData && promoData.length > 0 && promoData[0].is_valid) {
        const promo = promoData[0];
        logStep("Promo code valid", { discount_type: promo.discount_type, discount_value: promo.discount_value });
        
        // Create a Stripe coupon for this promo
        let stripeCoupon;
        if (promo.discount_type === 'percentage') {
          stripeCoupon = await stripe.coupons.create({
            percent_off: promo.discount_value,
            duration: 'once',
            metadata: { openflip_promo: promoCode }
          });
        } else {
          stripeCoupon = await stripe.coupons.create({
            amount_off: promo.discount_value * 100, // Convert to paise
            currency: 'inr',
            duration: 'once',
            metadata: { openflip_promo: promoCode }
          });
        }
        
        // Use discounts instead of allow_promotion_codes
        sessionParams.discounts = [{ coupon: stripeCoupon.id }];
        
        // Store promo code info in metadata
        sessionParams.metadata = {
          ...sessionParams.metadata,
          promo_code: promoCode,
          discount_type: promo.discount_type,
          discount_value: promo.discount_value.toString(),
        };
      } else if (promoData && promoData.length > 0) {
        logStep("Promo code invalid", { error: promoData[0].error_message });
        return new Response(JSON.stringify({ 
          error: promoData[0].error_message || 'Invalid promo code' 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
    } else {
      // No promo code provided, allow user to enter one in Stripe checkout
      sessionParams.allow_promotion_codes = true;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
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
