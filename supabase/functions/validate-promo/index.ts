import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VALIDATE-PROMO] ${step}${detailsStr}`);
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { promoCode, planPrice } = await req.json();
    if (!promoCode) throw new Error("Promo code is required");
    logStep("Validating promo code", { promoCode, planPrice });

    // Call the validate_promo_code function
    const { data, error } = await supabaseClient
      .rpc('validate_promo_code', { 
        code_input: promoCode, 
        user_id_input: user.id 
      });

    if (error) {
      logStep("Validation error", { error: error.message });
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ 
        valid: false, 
        error: 'Invalid promo code' 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const result = data[0];
    
    if (!result.is_valid) {
      logStep("Promo code invalid", { error: result.error_message });
      return new Response(JSON.stringify({ 
        valid: false, 
        error: result.error_message 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (planPrice) {
      if (result.discount_type === 'percentage') {
        discountAmount = Math.round(planPrice * (result.discount_value / 100));
      } else {
        discountAmount = Math.min(result.discount_value, planPrice);
      }
    }

    logStep("Promo code valid", { 
      discount_type: result.discount_type, 
      discount_value: result.discount_value,
      discountAmount 
    });

    return new Response(JSON.stringify({
      valid: true,
      discount_type: result.discount_type,
      discount_value: result.discount_value,
      discount_amount: discountAmount,
      final_price: planPrice ? planPrice - discountAmount : null,
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
