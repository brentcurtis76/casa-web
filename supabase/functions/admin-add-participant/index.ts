import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: adminRole } = await supabaseAdmin
      .from("mesa_abierta_admin_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!adminRole) {
      return new Response(
        JSON.stringify({ success: false, error: "User is not an admin" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const {
      monthId,
      fullName,
      email,
      phoneNumber,
      rolePreference,
      hasPlusOne,
      plusOneName,
      hostAddress,
      hostMaxGuests,
      whatsappEnabled,
    } = await req.json();

    if (!monthId || !fullName) {
      return new Response(
        JSON.stringify({ success: false, error: "monthId and fullName are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify month exists
    const { data: month, error: monthError } = await supabaseAdmin
      .from("mesa_abierta_months")
      .select("id, status")
      .eq("id", monthId)
      .single();

    if (monthError || !month) {
      return new Response(
        JSON.stringify({ success: false, error: "Month not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let userId: string;

    // Check if user already exists by email
    if (email) {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === email);

      if (existingUser) {
        userId = existingUser.id;

        // Check if already registered for this month
        const { data: existingParticipant } = await supabaseAdmin
          .from("mesa_abierta_participants")
          .select("id")
          .eq("user_id", userId)
          .eq("month_id", monthId)
          .maybeSingle();

        if (existingParticipant) {
          return new Response(
            JSON.stringify({ success: false, error: "Este usuario ya está inscrito para este mes" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Update profile with full name
        await supabaseAdmin
          .from("profiles")
          .update({ full_name: fullName })
          .eq("id", userId);

      } else {
        // Create new user with email
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });

        if (createError || !newUser.user) {
          console.error("Error creating user:", createError);
          return new Response(
            JSON.stringify({ success: false, error: `Error creating user: ${createError?.message}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        userId = newUser.user.id;

        // Create profile for new user
        await supabaseAdmin
          .from("profiles")
          .upsert({
            id: userId,
            full_name: fullName,
            email: email,
          });
      }
    } else {
      // Create a placeholder user for people without email
      // Use a unique identifier based on name and timestamp
      const placeholderEmail = `manual_${Date.now()}_${Math.random().toString(36).substring(7)}@placeholder.mesaabierta.local`;

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: placeholderEmail,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          is_manual_entry: true
        },
      });

      if (createError || !newUser.user) {
        console.error("Error creating placeholder user:", createError);
        return new Response(
          JSON.stringify({ success: false, error: `Error creating placeholder user: ${createError?.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = newUser.user.id;

      // Create profile for placeholder user
      await supabaseAdmin
        .from("profiles")
        .upsert({
          id: userId,
          full_name: fullName,
        });
    }

    // Insert participant record
    const { data: participant, error: participantError } = await supabaseAdmin
      .from("mesa_abierta_participants")
      .insert({
        user_id: userId,
        month_id: monthId,
        role_preference: rolePreference || "guest",
        email: email || null,
        has_plus_one: hasPlusOne || false,
        plus_one_name: plusOneName || null,
        host_address: rolePreference === "host" ? hostAddress : null,
        host_max_guests: rolePreference === "host" ? (hostMaxGuests || 5) : null,
        phone_number: phoneNumber || null,
        whatsapp_enabled: whatsappEnabled !== false,
        status: "pending",
      })
      .select()
      .single();

    if (participantError) {
      console.error("Error creating participant:", participantError);
      return new Response(
        JSON.stringify({ success: false, error: `Error creating participant: ${participantError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Admin ${user.email} added participant ${fullName} (${participant.id}) to month ${monthId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Participante ${fullName} agregado exitosamente`,
        participant: {
          id: participant.id,
          fullName,
          email,
          rolePreference: participant.role_preference,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in admin-add-participant:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
