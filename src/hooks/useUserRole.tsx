import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "admin" | "user" | null;

const DEFAULT_ADMIN_EMAIL = "admin@salarytracker.local";

interface UseUserRoleResult {
  role: UserRole;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
}

export const useUserRole = (userId?: string | null): UseUserRoleResult => {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setRole(null);
      return;
    }

    let isMounted = true;

    const fetchRole = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);

        if (error) throw error;

        // Also look up the user's email so we can guarantee the embedded
        // default admin account is always treated as admin, even if roles
        // haven't been assigned correctly yet.
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", userId)
          .maybeSingle();

        if (profileError) throw profileError;

        if (!isMounted) return;

        const roles = Array.isArray(data) ? data.map((r) => r.role as UserRole) : [];
        const isDefaultAdmin = profile?.email === DEFAULT_ADMIN_EMAIL;

        const normalizedRole: UserRole = isDefaultAdmin
          ? "admin"
          : roles.includes("admin")
            ? "admin"
            : roles[0] ?? null;

        setRole(normalizedRole);
      } catch (err: any) {
        if (!isMounted) return;
        console.error("Error fetching user role:", err);
        setError(err.message ?? "Failed to load role");
        setRole(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchRole();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  return {
    role,
    isAdmin: role === "admin",
    loading,
    error,
  };
};
