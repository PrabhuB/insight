import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Unlock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const passcodeSchema = z.string().regex(/^\d{6}$/, "Passcode must be exactly 6 digits");

interface PasscodeLockProps {
  userId: string;
  onUnlock: () => void;
}


export const PasscodeLock = ({ userId, onUnlock }: PasscodeLockProps) => {
  const [passcode, setPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  const [hasPasscode, setHasPasscode] = useState<boolean | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkPasscodeExists();
  }, [userId]);

  const checkPasscodeExists = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_passcodes")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      setHasPasscode(!!data);
    } catch (error: any) {
      console.error("Error checking passcode:", error);
      toast.error("Failed to check passcode status");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupPasscode = async () => {
    try {
      const validatedPasscode = passcodeSchema.parse(passcode);
      const validatedConfirm = passcodeSchema.parse(confirmPasscode);

      if (validatedPasscode !== validatedConfirm) {
        toast.error("Passcodes do not match");
        return;
      }

      const { error } = await supabase.rpc("set_passcode", {
        p_passcode: validatedPasscode,
      });

      if (error) throw error;

      toast.success("Passcode set successfully");
      setHasPasscode(true);
      setIsSettingUp(false);
      setPasscode("");
      setConfirmPasscode("");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error("Error setting passcode:", error);
        toast.error("Failed to set passcode");
      }
    }
  };

  const handleUnlock = async () => {
    try {
      const validatedPasscode = passcodeSchema.parse(passcode);

      const { data, error } = await supabase.rpc("verify_passcode", {
        p_passcode: validatedPasscode,
      });

      if (error) throw error;

      if (data === true) {
        toast.success("Unlocked successfully");
        onUnlock();
      } else {
        toast.error("Incorrect passcode");
        setPasscode("");
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error("Error unlocking:", error);
        const message =
          typeof error?.message === "string" && error.message.includes("Too many attempts")
            ? error.message
            : "Failed to unlock";
        toast.error(message);
      }
    }
  };

  const handlePasscodeInput = (value: string) => {
    // Only allow digits and limit to 6
    const cleaned = value.replace(/\D/g, "").slice(0, 6);
    setPasscode(cleaned);
  };

  const handleConfirmPasscodeInput = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 6);
    setConfirmPasscode(cleaned);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Logged out successfully");
    } catch (error: any) {
      console.error("Error logging out:", error);
      toast.error(error.message || "Failed to log out");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/10 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasPasscode || isSettingUp) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>Setup App Passcode</CardTitle>
            <CardDescription>Create a 6-digit passcode to secure your salary data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="passcode">Enter 6-Digit Passcode</Label>
              <Input
                id="passcode"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={passcode}
                onChange={(e) => handlePasscodeInput(e.target.value)}
                placeholder="••••••"
                className="text-center text-2xl tracking-widest"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-passcode">Confirm Passcode</Label>
              <Input
                id="confirm-passcode"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={confirmPasscode}
                onChange={(e) => handleConfirmPasscodeInput(e.target.value)}
                placeholder="••••••"
                className="text-center text-2xl tracking-widest"
              />
            </div>
            <Button
              onClick={handleSetupPasscode}
              className="w-full"
              disabled={passcode.length !== 6 || confirmPasscode.length !== 6}
            >
              Set Passcode
            </Button>
            {hasPasscode && (
              <Button variant="ghost" onClick={() => setIsSettingUp(false)} className="w-full">
                Cancel
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <CardTitle>Enter Passcode</CardTitle>
          <CardDescription>Enter your 6-digit passcode to access your salary data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="unlock-passcode">Passcode</Label>
            <Input
              id="unlock-passcode"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={passcode}
              onChange={(e) => handlePasscodeInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter" && passcode.length === 6) {
                  handleUnlock();
                }
              }}
              placeholder="••••••"
              className="text-center text-2xl tracking-widest"
              autoFocus
            />
          </div>
          <Button onClick={handleUnlock} className="w-full" disabled={passcode.length !== 6}>
            <Unlock className="w-4 h-4 mr-2" />
            Unlock
          </Button>
          <Button variant="outline" onClick={() => setIsSettingUp(true)} className="w-full">
            Change Passcode
          </Button>
          <Button variant="ghost" onClick={handleLogout} className="w-full">
            Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
