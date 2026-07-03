import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[RAZORPAY-CREATE-ORDER] ${step}${detailsStr}`);
};

// Razorpay Plan IDs - to be created in Razorpay Dashboard
const SUBSCRIPTION_PLANS = {
  monthly: {
    planId: 'plan_monthly_99', // Replace with actual Razorpay plan ID
    price: 99,
    period: 'monthly',
  },
  yearly: {
    planId: 'plan_yearly_799', // Replace with actual Razorpay plan ID
    price: 799,
    period: 'yearly',
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

    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    
    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error("Razorpay credentials not configured");
    }

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { amount, type, billingCycle, promoCode, metadata } = await req.json();
    logStep("Request body parsed", { amount, type, billingCycle, promoCode });

    if (!amount || amount < 1) {
      throw new Error("Invalid amount. Minimum order amount is ₹1.");
    }

    // Validate promo code if provided
    let finalAmount = amount;
    let discountAmount = 0;
    
    if (promoCode) {
      const { data: promoData } = await supabaseClient
        .rpc('validate_promo_code', { 
          code_input: promoCode, 
          user_id_input: user.id 
        });
      
      if (promoData?.[0]?.is_valid) {
        const promo = promoData[0];
        if (promo.discount_type === 'percentage') {
          discountAmount = Math.round(amount * promo.discount_value / 100);
        } else {
          discountAmount = promo.discount_value;
        }
        finalAmount = Math.max(0, amount - discountAmount);
        logStep("Promo applied", { discountAmount, finalAmount });
      }
    }

    // Calculate GST (18%) — skip for tips and creator subscriptions
    const skipGst = type === 'tip' || type === 'creator_subscription';
    const gstAmount = skipGst ? 0 : Math.round(finalAmount * 0.18);
    const totalAmount = finalAmount + gstAmount;

    // Create Razorpay order
    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    
    const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: totalAmount * 100, // Razorpay expects amount in paise
        currency: "INR",
        receipt: `${type}_${user.id.slice(0, 8)}_${Date.now()}`,
        notes: {
          user_id: user.id,
          user_email: user.email,
          type: type,
          billing_cycle: billingCycle || '',
          promo_code: promoCode || '',
          discount_amount: discountAmount,
          gst_amount: gstAmount,
          ...metadata,
        },
      }),
    });

    if (!orderResponse.ok) {
      const errorData = await orderResponse.text();
      logStep("Razorpay order creation failed", { status: orderResponse.status, error: errorData });
      if (orderResponse.status === 401 || errorData.includes("Authentication failed")) {
        throw new Error("Payment gateway authentication failed. The Razorpay API keys are invalid or belong to a different mode (test vs live). Please update RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend secrets.");
      }
      throw new Error(`Razorpay error: ${errorData}`);
    }

    const order = await orderResponse.json();
    logStep("Order created", { orderId: order.id, amount: order.amount });

    // Get user profile for prefill
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('full_name, phone_number')
      .eq('id', user.id)
      .single();

    return new Response(JSON.stringify({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: razorpayKeyId,
      prefill: {
        name: profile?.full_name || '',
        email: user.email,
        contact: profile?.phone_number || '',
      },
      notes: order.notes,
      subtotal: finalAmount,
      gst: gstAmount,
      discount: discountAmount,
      total: totalAmount,
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
