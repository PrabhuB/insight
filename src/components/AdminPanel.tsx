import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, Trash2, ShieldPlus, ShieldMinus, Lock, Unlock, KeyRound } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface AdminPanelProps {
  currentUserId: string;
}

interface AdminUserRow {
  user_id: string;
  email: string;
  role: string;
  is_locked: boolean;
}

interface PendingUserRow {
  user_id: string;
  email: string;
  is_locked: boolean;
}

interface AdminApiResponse {
  users: AdminUserRow[];
  pending: PendingUserRow[];
}

export const AdminPanel = ({ currentUserId }: AdminPanelProps) => {
  const { isAdmin } = useUserRole(currentUserId);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const validatePassword = (password: string): string | null => {
    const trimmed = password.trim();
    if (trimmed.length < 8 || trimmed.length > 128) {
      return "Password must be between 8 and 128 characters";
    }
    if (!/[A-Z]/.test(trimmed) || !/[a-z]/.test(trimmed) || !/[0-9]/.test(trimmed)) {
      return "Password must include upper, lower case letters and a number";
    }
    return null;
  };

  const loadAdminData = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;
      if (!session) throw new Error("No active session found for admin request");

      const { data, error } = await supabase.functions.invoke<AdminApiResponse>("admin-users", {
        body: { action: "list" },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      setUsers(data?.users ?? []);
      setPendingUsers(data?.pending ?? []);
    } catch (err: any) {
      console.error("Error loading admin data:", err);
      const baseMessage = "Failed to load admin data";
      const functionError = err?.message || err?.error;
      const details = err?.context?.response?.error || err?.context?.response?.data?.error;
      const message = [baseMessage, functionError, details].filter(Boolean).join(" - ");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadAdminData();
    }
  }, [isAdmin]);

  const callAdminAction = async (action: string, userId: string, extraBody?: Record<string, any>) => {
    setUpdatingId(userId);
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;
      if (!session) throw new Error("No active session found for admin action");

      const { error } = await supabase.functions.invoke("admin-users", {
        body: { action, targetUserId: userId, ...extraBody },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (error) throw error;
      await loadAdminData();
    } catch (err: any) {
      console.error("Admin action error:", err);
      const baseMessage = "Admin action failed";
      const functionError = err?.message || err?.error;
      const details = err?.context?.response?.error || err?.context?.response?.data?.error;
      const message = [baseMessage, functionError, details].filter(Boolean).join(" - ");
      toast.error(message);
    } finally {
      setUpdatingId(null);
    }
  };

  if (!isAdmin) {
    return (
      <Card className="p-6 space-y-2">
        <h2 className="text-xl font-semibold">Admin access required</h2>
        <p className="text-sm text-muted-foreground">
          You need to be assigned the <span className="font-medium">admin</span> role to access this section.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Pending user requests</h3>
          {loading && <span className="text-xs text-muted-foreground">Loading...</span>}
        </div>
        {pendingUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending requests right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell className="font-mono text-xs break-all">{user.user_id}</TableCell>
                    <TableCell className="text-sm">{user.email || "(no email)"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {user.is_locked ? "Locked / Denied" : "Pending approval"}
                    </TableCell>
                    <TableCell className="flex gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={updatingId === user.user_id}
                        onClick={() => callAdminAction("approve_user", user.user_id)}
                        aria-label="Approve user"
                        className="text-primary hover:bg-primary/10"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={updatingId === user.user_id}
                        onClick={() => callAdminAction("deny_user", user.user_id)}
                        aria-label="Deny user"
                        className="text-accent hover:bg-accent/10"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={updatingId === user.user_id}
                        onClick={() => callAdminAction("delete_pending_user", user.user_id)}
                        aria-label="Delete pending user"
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">Current users & roles</h3>
            {loading && <span className="text-xs text-muted-foreground">Refreshing...</span>}
          </div>
          {users.some((u) => u.email === "admin@salarytracker.local" && u.role === "admin" && u.user_id === currentUserId) && (
            <Button
              variant="destructive"
              size="sm"
              disabled={loading || updatingId !== null}
              onClick={async () => {
                const confirmed = window.confirm(
                  "This will permanently delete all users except the default admin account. Are you sure?",
                );
                if (!confirmed) return;
                await callAdminAction("delete_non_default_users", currentUserId);
              }}
            >
              Delete all non-default users
            </Button>
          )}
        </div>
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">No roles assigned yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[220px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((row) => {
                  const isDefaultAdmin = row.email === "admin@salarytracker.local" && row.role === "admin";

                  return (
                    <TableRow key={`${row.user_id}-${row.role}`}>
                      <TableCell className="font-mono text-xs break-all">{row.user_id}</TableCell>
                      <TableCell className="text-sm">
                        {row.email || "(no email)"}
                        {isDefaultAdmin && (
                          <span className="ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary border-primary/40 bg-primary/5">
                            Default Admin
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="capitalize">{row.role}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.is_locked ? "Locked" : "Active"}
                      </TableCell>
                      <TableCell className="flex gap-2">
                        {row.role === "admin" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={updatingId === row.user_id || row.user_id === currentUserId}
                            onClick={() => callAdminAction("revoke_admin", row.user_id)}
                            aria-label="Revoke admin role"
                            className="text-accent hover:bg-accent/10"
                          >
                            <ShieldMinus className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={updatingId === row.user_id}
                            onClick={() => callAdminAction("grant_admin", row.user_id)}
                            aria-label="Grant admin role"
                            className="text-primary hover:bg-primary/10"
                          >
                            <ShieldPlus className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={updatingId === row.user_id}
                          onClick={() =>
                            callAdminAction(row.is_locked ? "unlock_account" : "lock_account", row.user_id)
                          }
                          aria-label={row.is_locked ? "Unlock account" : "Lock account"}
                          className="text-accent hover:bg-accent/10"
                        >
                          {row.is_locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={updatingId === row.user_id}
                          onClick={() => callAdminAction("delete_user", row.user_id)}
                          aria-label="Delete user"
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={updatingId === row.user_id}
                          onClick={() => {
                            setResetUserId(row.user_id);
                            setResetPassword("");
                            setResetPasswordError(null);
                          }}
                          aria-label="Reset password"
                          className="text-primary hover:bg-primary/10"
                        >
                          <KeyRound className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog
        open={!!resetUserId}
        onOpenChange={(open) => {
          if (!open) {
            setResetUserId(null);
            setResetPassword("");
            setResetPasswordError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset user password</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Label htmlFor="reset-password">New password</Label>
            <Input
              id="reset-password"
              type="password"
              value={resetPassword}
              onChange={(e) => {
                setResetPassword(e.target.value);
                if (resetPasswordError) {
                  setResetPasswordError(null);
                }
              }}
              placeholder="Enter a strong password"
            />
            {resetPasswordError && (
              <p className="text-xs text-destructive mt-1">{resetPasswordError}</p>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setResetUserId(null);
                setResetPassword("");
                setResetPasswordError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={resetSubmitting || !resetUserId}
              onClick={async () => {
                if (!resetUserId) return;
                const validationError = validatePassword(resetPassword);
                if (validationError) {
                  setResetPasswordError(validationError);
                  return;
                }

                try {
                  setResetSubmitting(true);
                  await callAdminAction("reset_password", resetUserId, { newPassword: resetPassword.trim() });
                  setResetUserId(null);
                  setResetPassword("");
                  setResetPasswordError(null);
                } catch (error: any) {
                  toast.error(error?.message || "Failed to reset password");
                } finally {
                  setResetSubmitting(false);
                }
              }}
            >
              Reset password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
