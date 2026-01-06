import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Wallet } from "lucide-react";
import { z } from "zod";

const DEFAULT_ADMIN_EMAIL = "admin@salarytracker.local";

const Auth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pendingApproval, setPendingApproval] = useState(false);

  useEffect(() => {
    const ensureUserRoleOrBootstrapAdmin = async (userId: string, email?: string | null) => {
      // Check if the user already has any role assigned (admin or user)
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) throw error;

      // If there is at least one row, user has some role assigned
      let hasRole = Array.isArray(roles) && roles.length > 0;

      // Special-case bootstrap for the default admin account.
      // If this is the default admin email and no role exists yet,
      // attempt to insert an admin role using the "First user can become admin" policy.
      if (!hasRole && email === DEFAULT_ADMIN_EMAIL) {
        const { error: insertError } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "admin" });

        if (insertError) {
          console.error("Error bootstrapping default admin role:", insertError);
          // Even if role insert fails (e.g. policies), treat this account as approved
          // so the owner of DEFAULT_ADMIN_EMAIL can always sign in.
          return { hasRole: true, isDefaultAdmin: true };
        }

        hasRole = true;
      }

      return { hasRole, isDefaultAdmin: email === DEFAULT_ADMIN_EMAIL };
    };

    const handleSession = async (session: any) => {
      try {
        const { hasRole, isDefaultAdmin } = await ensureUserRoleOrBootstrapAdmin(
          session.user.id,
          session.user.email,
        );

        // For the embedded default admin account, always allow sign-in
        // even if role insertion hits a policy error.
        if (!hasRole && !isDefaultAdmin) {
          setPendingApproval(true);
          toast.info("Your account is awaiting admin approval before you can sign in.");
          await supabase.auth.signOut();
          return;
        }

        setPendingApproval(false);
        navigate("/");
      } catch (err: any) {
        console.error("Error checking user approval:", err);
        toast.error(err.message ?? "Unable to verify account approval");
        setPendingApproval(false);
        await supabase.auth.signOut();
      }
    };

    const checkSessionAndApproval = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session) return;

      setTimeout(() => {
        handleSession(session);
      }, 0);
    };

    checkSessionAndApproval();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) return;

      setTimeout(() => {
        handleSession(session);
      }, 0);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const signUpSchema = z.object({
      username: z
        .string()
        .trim()
        .min(3, { message: "Username must be at least 3 characters" })
        .max(30, { message: "Username must be at most 30 characters" })
        .regex(/^[a-zA-Z0-9]+$/, { message: "Username must be alphanumeric" }),
      email: z
        .string()
        .trim()
        .email({ message: "Please enter a valid email address" })
        .max(255, { message: "Email must be less than 255 characters" }),
      password: z
        .string()
        .min(6, { message: "Password must be at least 6 characters" })
        .max(128, { message: "Password must be at most 128 characters" }),
    });

    try {
      const parsed = signUpSchema.parse({ username, email, password });

      const { data, error } = await supabase.auth.signUp({
        email: parsed.email,
        password: parsed.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      if (data.user) {
        // Create or update the profile with username + email for username-based login
        const { error: profileError } = await supabase.from("profiles").upsert(
          {
            id: data.user.id,
            username: parsed.username,
            email: parsed.email,
          },
          { onConflict: "id" },
        );

        if (profileError) {
          console.error("Error creating profile during sign up:", profileError);
          toast.error("Account created, but failed to save username profile.");
        }
      }

      toast.success("Account created! Once an admin approves you, you can sign in with your username.");
      setUsername("");
      setEmail("");
      setPassword("");
    } catch (error: any) {
      if (error?.issues?.[0]?.message) {
        toast.error(error.issues[0].message);
      } else {
        toast.error(error.message || "Failed to create account");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setPendingApproval(false);

    const signInSchema = z.object({
      identifier: z
        .string()
        .trim()
        .min(3, { message: "Username or email must be at least 3 characters" })
        .max(255, { message: "Username or email must be at most 255 characters" }),
      password: z
        .string()
        .min(6, { message: "Password must be at least 6 characters" })
        .max(128, { message: "Password must be at most 128 characters" }),
    });

    try {
      const parsed = signInSchema.parse({ identifier: username, password });

      const rawIdentifier = parsed.identifier.trim();
      const isEmail = rawIdentifier.includes("@");

      let emailForLogin: string | null = null;

      if (isEmail) {
        // Direct email login path (for accounts like admin@salarytracker.local)
        const emailSchema = z
          .string()
          .trim()
          .email({ message: "Please enter a valid email address" })
          .max(255, { message: "Email must be less than 255 characters" });

        emailForLogin = emailSchema.parse(rawIdentifier);
      } else {
        // Username-based login path for users who registered with a username
        const { data: emailResult, error: emailError } = await supabase.rpc(
          "get_email_for_username",
          { p_username: rawIdentifier },
        );

        if (emailError) throw emailError;

        emailForLogin = emailResult as string | null;
        if (!emailForLogin) {
          throw new Error("Invalid username or password");
        }
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: emailForLogin,
        password: parsed.password,
      });

      if (error) {
        throw new Error("Invalid username or password");
      }

      toast.success("Welcome back!");
    } catch (error: any) {
      if (error?.issues?.[0]?.message) {
        toast.error(error.issues[0].message);
      } else {
        toast.error("Invalid username or password");
      }
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-secondary/10 p-4">
      <Card className="w-full max-w-md shadow-2xl border-primary/20">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
            <Wallet className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Salary Tracker
          </CardTitle>
          <CardDescription>Track your salary, analyze earnings, and monitor deductions</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingApproval && (
            <div className="mb-4 rounded-md border border-border/60 bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
              Your account has been created and is <span className="font-medium">waiting for admin approval</span>
              before you can sign in.
            </div>
          )}
          <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
               <TabsTrigger value="signin">Sign In</TabsTrigger>
               <TabsTrigger value="signup">Sign Up</TabsTrigger>
             </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username-signin">Username or email</Label>
                  <Input
                    id="username-signin"
                    type="text"
                    placeholder="yourusername or you@example.com"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-signin">Password</Label>
                  <Input
                    id="password-signin"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username-signup">Username</Label>
                  <Input
                    id="username-signup"
                    type="text"
                    placeholder="yourusername"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">Use only letters and numbers, 3-30 characters.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-signup">Email</Label>
                  <Input
                    id="email-signup"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-signup">Password</Label>
                  <Input
                    id="password-signup"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    minLength={6}
                  />
                  <p className="text-xs text-muted-foreground">Password must be at least 6 characters</p>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
              </form>
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
