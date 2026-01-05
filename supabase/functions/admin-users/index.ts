import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Expect a valid JWT from the client; this is also enforced by the platform
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Client scoped to the current user
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Service-role client for privileged operations (bypasses RLS)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Admin role check -------------------------------------------------
    const { data: roleRows, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (roleError) {
      console.error("admin-users: error checking admin role", roleError);
      return new Response(
        JSON.stringify({
          error: "Admin role check failed",
          details: roleError.message ?? String(roleError),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const hasAdminRole = (roleRows ?? []).some((r: { role: string }) => r.role === "admin");

    let isAdminUser = hasAdminRole;

    // Bootstrap primary owner or default admin account as admin if needed,
    // and clean up any existing roles so only a single admin role remains.
    const bootstrapAdminEmails = ["admin@salarytracker.local"];
    if (!isAdminUser && bootstrapAdminEmails.includes(user.email ?? "")) {
      console.log("admin-users: bootstrapping primary owner as admin", { userId: user.id, email: user.email });

      const { error: deleteError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", user.id);
      if (deleteError) {
        console.error("admin-users: failed to clean up roles for primary owner", deleteError);
        return new Response(
          JSON.stringify({
            error: "Failed to clean up primary admin roles",
            details: deleteError.message ?? String(deleteError),
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { error: insertError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: user.id, role: "admin" });

      if (insertError) {
        console.error("admin-users: failed to bootstrap primary owner admin role", insertError);
        return new Response(
          JSON.stringify({
            error: "Failed to initialize primary admin role",
            details: insertError.message ?? String(insertError),
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      isAdminUser = true;
    }

    if (!isAdminUser) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Parse body -------------------------------------------------------
    const body = await req.json().catch(() => ({}));
    const { action, targetUserId, newPassword } = body as {
      action?: string;
      targetUserId?: string;
      newPassword?: string;
    };

    // ---- List users & roles ----------------------------------------------
    if (!action || action === "list") {
      const { data: roles, error: rolesError } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const { data: locks, error: locksError } = await supabaseAdmin
        .from("user_account_locks")
        .select("user_id, is_locked, reason");

      if (locksError) throw locksError;

      const { data: usersResult, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
      if (usersError) throw usersError;

      const allUsers = usersResult?.users ?? [];

      const userIdsWithRole = new Set((roles ?? []).map((r: { user_id: string }) => r.user_id));

      const currentUsers = (roles ?? []).map((r: { user_id: string; role: string }) => {
        const userMeta = allUsers.find((u) => u.id === r.user_id);
        const lockRow = locks?.find((l: { user_id: string }) => l.user_id === r.user_id) as
          | { is_locked: boolean }
          | undefined;
        return {
          user_id: r.user_id,
          email: userMeta?.email ?? "",
          role: r.role,
          is_locked: lockRow?.is_locked ?? false,
        };
      });

      const pendingUsers = allUsers
        .filter((u) => !userIdsWithRole.has(u.id))
        .map((u) => {
          const lockRow = locks?.find((l: { user_id: string }) => l.user_id === u.id) as
            | { is_locked: boolean }
            | undefined;
          return {
            user_id: u.id,
            email: u.email ?? "",
            is_locked: lockRow?.is_locked ?? false,
          };
        });

      return new Response(JSON.stringify({ users: currentUsers, pending: pendingUsers }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- All other actions need a target user ----------------------------
    if (!targetUserId) {
      return new Response(JSON.stringify({ error: "Missing targetUserId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Mutating actions -------------------------------------------------
    if (action === "approve_user") {
      const { error } = await supabaseAdmin.from("user_roles").insert({
        user_id: targetUserId,
        role: "user",
      });
      if (error) throw error;
    } else if (action === "deny_user") {
      const { error } = await supabaseAdmin.from("user_account_locks").upsert({
        user_id: targetUserId,
        is_locked: true,
        reason: "Denied by admin",
      });
      if (error) throw error;
    } else if (action === "grant_admin") {
      // Ensure the user has only a single role. Remove any existing roles
      // (e.g., "user") before assigning "admin" so we don't create
      // duplicate entries for the same user with different roles.
      const { error: deleteError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", targetUserId);
      if (deleteError) throw deleteError;

      const { error: insertError } = await supabaseAdmin.from("user_roles").insert({
        user_id: targetUserId,
        role: "admin",
      });
      if (insertError) throw insertError;
    } else if (action === "revoke_admin") {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", targetUserId)
        .eq("role", "admin");
      if (error) throw error;
    } else if (action === "lock_account") {
      const { error } = await supabaseAdmin.from("user_account_locks").upsert({
        user_id: targetUserId,
        is_locked: true,
      });
      if (error) throw error;
    } else if (action === "unlock_account") {
      const { error } = await supabaseAdmin.from("user_account_locks").upsert({
        user_id: targetUserId,
        is_locked: false,
      });
      if (error) throw error;
    } else if (action === "delete_pending_user" || action === "delete_user") {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
      if (error) throw error;
    } else if (action === "reset_password") {
      if (!newPassword || typeof newPassword !== "string") {
        return new Response(JSON.stringify({ error: "Missing newPassword for reset" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const trimmedPassword = newPassword.trim();
      const lengthValid = trimmedPassword.length >= 8 && trimmedPassword.length <= 128;
      const complexityValid =
        /[A-Z]/.test(trimmedPassword) && /[a-z]/.test(trimmedPassword) && /[0-9]/.test(trimmedPassword);

      if (!lengthValid || !complexityValid) {
        return new Response(
          JSON.stringify({
            error:
              "Password must be 8-128 characters and include at least one uppercase letter, one lowercase letter, and one number",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        password: trimmedPassword,
      });
      if (error) throw error;
    } else if (action === "delete_non_default_users") {
      // Remove all users except the default admin account
      const { data: usersResult, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
      if (usersError) throw usersError;

      const allUsers = usersResult?.users ?? [];
      const usersToDelete = allUsers.filter((u) => u.email !== "admin@salarytracker.local");

      for (const u of usersToDelete) {
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(u.id);
        if (deleteError) throw deleteError;
      }
    } else {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("admin-users function error", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: "Internal server error", details: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
