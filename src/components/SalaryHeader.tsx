import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Wallet, Trash2, Lock, LogOut, MoreVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SalaryHeaderProps {
  onDataReset?: () => void;
  onLock?: () => void;
  onLogout?: () => void;
  onDisplayNameChange?: (name: string) => void;
}
 
interface Profile {
  full_name: string | null;
  job_title: string | null;
  location: string | null;
  bio: string | null;
}

export const SalaryHeader = ({ onDataReset, onLock, onLogout, onDisplayNameChange }: SalaryHeaderProps) => {
  const [isResetting, setIsResetting] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error("Error loading user for profile header:", userError);
        return;
      }

      setUserId(user.id);

      const emailName = user.email?.split("@")[0] ?? "User";

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, job_title, location, bio")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error loading profile:", error);
        setDisplayName(emailName);
        onDisplayNameChange?.(emailName);
        return;
      }
 
      if (data) {
        setProfile(data as Profile);
        const nameToUse = data.full_name || emailName;
        setDisplayName(nameToUse);
        onDisplayNameChange?.(nameToUse);
      } else {
        setDisplayName(emailName);
        onDisplayNameChange?.(emailName);
      }
    };

    loadProfile();
  }, []);

  const getInitials = (name: string) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  };

  const handleWipeData = async () => {
    try {
      setIsResetting(true);

      const [{ count: salaryCount, error: salaryCountError }, { count: templateCount, error: templateCountError }] =
        await Promise.all([
          supabase.from("salary_records").select("id", { count: "exact", head: true }),
          supabase.from("organization_templates").select("id", { count: "exact", head: true }),
        ]);

      if (salaryCountError) throw salaryCountError;
      if (templateCountError) throw templateCountError;

      const { error } = await supabase.rpc("wipe_all_salary_data");
      if (error) throw error;

      toast.success(
        `Cleared ${templateCount ?? 0} organization templates and ${salaryCount ?? 0} salary records (including all earnings and deductions).`,
      );
      onDataReset?.();
    } catch (error: any) {
      console.error("Error wiping data:", error);
      toast.error(error.message || "Failed to clear data");
    } finally {
      setIsResetting(false);
    }
  };

  const handleLockClick = () => {
    onLock?.();
  };

  const handleLogoutClick = async () => {
    try {
      await supabase.auth.signOut();
      onLogout?.();
      toast.success("Logged out successfully");
    } catch (error: any) {
      console.error("Error logging out:", error);
      toast.error(error.message || "Failed to log out");
    }
  };

  const handleProfileSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) return;

    const formData = new FormData(event.currentTarget);
    const full_name = (formData.get("full_name") as string) || null;
    const job_title = (formData.get("job_title") as string) || null;
    const location = (formData.get("location") as string) || null;
    const bio = (formData.get("bio") as string) || null;

    try {
      setSavingProfile(true);
      const { error } = await supabase.from("profiles").upsert({
        id: userId,
        full_name,
        job_title,
        location,
        bio,
      });

      if (error) throw error;

      const updated: Profile = { full_name, job_title, location, bio };
      setProfile(updated);
      const nameToUse = full_name || displayName || "User";
      setDisplayName(nameToUse);
      onDisplayNameChange?.(nameToUse);
      toast.success("Profile updated");
      setEditingProfile(false);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error(error.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <header className="glass-header sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-2xl">
      <div className="container mx-auto px-4 pt-[env(safe-area-inset-top)] py-2 md:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative h-9 w-9 md:h-10 md:w-10 rounded-2xl bg-gradient-to-br from-primary/90 via-primary to-secondary/80 flex items-center justify-center shadow-md overflow-hidden">
              <div className="absolute inset-px rounded-2xl bg-gradient-to-br from-background/40 via-background/10 to-background/0 mix-blend-screen" />
              <Wallet className="relative h-5 w-5 md:h-6 md:w-6 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-2xl font-semibold tracking-tight text-foreground">
                Salary Tracker
              </h1>
              <p className="hidden text-xs text-muted-foreground md:block">
                Manage your earnings &amp; deductions with clarity
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Desktop actions */}
            <div className="hidden items-center gap-2 sm:flex">
              <ThemeToggle />
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                type="button"
                onClick={handleLockClick}
              >
                <Lock className="h-4 w-4 text-foreground" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                type="button"
                onClick={handleLogoutClick}
              >
                <LogOut className="h-4 w-4 text-foreground" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 hover:bg-destructive/10"
                    disabled={isResetting}
                    type="button"
                    title="Reset all data"
                  >
                    <Trash2 className="h-4 w-4 text-foreground" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all salary data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all salary records, earnings, deductions, and organization
                      templates. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={handleWipeData}
                      disabled={isResetting}
                    >
                      Yes, delete everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Dialog open={editingProfile} onOpenChange={setEditingProfile}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    className="flex max-w-xs items-center gap-2"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarFallback>{getInitials(displayName || "User")}</AvatarFallback>
                    </Avatar>
                    <div className="hidden min-w-0 sm:flex items-center">
                      <span className="max-w-[140px] truncate text-sm font-medium">
                        {displayName || "User"}
                      </span>
                    </div>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit profile</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleProfileSave} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Full name</Label>
                      <Input id="full_name" name="full_name" defaultValue={profile?.full_name ?? ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="job_title">Job title</Label>
                      <Input id="job_title" name="job_title" defaultValue={profile?.job_title ?? ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input id="location" name="location" defaultValue={profile?.location ?? ""} />
                    </div>
                    <input type="hidden" name="bio" value={profile?.bio ?? ""} />
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEditingProfile(false)}
                        disabled={savingProfile}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={savingProfile}>
                        {savingProfile ? "Saving..." : "Save changes"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Mobile overflow menu */}
            <div className="flex items-center gap-2 sm:hidden">
              <Dialog open={editingProfile} onOpenChange={setEditingProfile}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon" type="button" className="h-8 w-8 rounded-full">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback>{getInitials(displayName || "User")}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit profile</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleProfileSave} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="mobile_full_name">Full name</Label>
                      <Input id="mobile_full_name" name="full_name" defaultValue={profile?.full_name ?? ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mobile_job_title">Job title</Label>
                      <Input id="mobile_job_title" name="job_title" defaultValue={profile?.job_title ?? ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mobile_location">Location</Label>
                      <Input id="mobile_location" name="location" defaultValue={profile?.location ?? ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mobile_bio">Short bio</Label>
                      <Input id="mobile_bio" name="bio" defaultValue={profile?.bio ?? ""} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEditingProfile(false)}
                        disabled={savingProfile}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={savingProfile}>
                        {savingProfile ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    type="button"
                    className="h-8 w-8 rounded-full"
                    aria-label="More actions"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLockClick}>
                    <Lock className="mr-2 h-4 w-4" />
                    <span>Lock app</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogoutClick}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <div className="flex w-full items-center justify-between">
                      <span className="text-sm">Theme</span>
                      <ThemeToggle />
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={handleWipeData}
                    disabled={isResetting}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Reset data</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

