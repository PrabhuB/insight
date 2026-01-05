import { useState } from "react";
import { SalaryHeader } from "@/components/SalaryHeader";
import { ManualEntryForm } from "@/components/ManualEntryForm";
import { SalaryHistory } from "@/components/SalaryHistory";
import { OrganizationTemplates } from "@/components/OrganizationTemplates";
import { BulkImport } from "@/components/BulkImport";
import { SalaryDataTable } from "@/components/SalaryDataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { PasscodeLock } from "@/components/PasscodeLock";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { AdminPanel } from "@/components/AdminPanel";
import { cn } from "@/lib/utils";
import { SalaryBudgetPlanning } from "@/components/SalaryBudgetPlanning";
import { Database, LayoutTemplate, PenSquare, CalendarDays, BarChart3, Shield, PieChart, MoreHorizontal } from "lucide-react";
 
const Index = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isUnlocked, setIsUnlocked] = useState(true);
  const [userDisplayName, setUserDisplayName] = useState("");
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole(user?.id);
  const [activeTab, setActiveTab] = useState<string>("import");
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const handleDataChange = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/10 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!isUnlocked) {
    return <PasscodeLock userId={user.id} onUnlock={() => setIsUnlocked(true)} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <SalaryHeader
        onDataReset={handleDataChange}
        onLock={() => setIsUnlocked(false)}
        onLogout={() => {
          navigate("/auth");
        }}
        onDisplayNameChange={setUserDisplayName}
      />
      
      <main className="container mx-auto px-4 py-4 space-y-6 max-w-7xl">
        {/* Mobile greeting */}
        <div className="md:hidden flex flex-col gap-1 pt-1">
          <p className="text-base font-semibold">
            Hi{userDisplayName ? `, ${userDisplayName}` : ", Prabhu"} 👋
          </p>
          <p className="text-xs text-muted-foreground truncate">
            Track your salary and budget in one place.
          </p>
        </div>

        {/* Desktop hero */}
        <div className="hidden md:block text-center space-y-2">
          <h2 className="text-3xl font-bold">
            Welcome to Your Salary Tracker{userDisplayName ? `, ${userDisplayName}` : ""}
          </h2>
          <p className="text-muted-foreground">
            Track your earnings, manage deductions, and visualize your salary trends
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 pb-28">
          <TabsList
            className={cn(
              "mx-auto hidden w-full gap-2 md:grid",
              isAdmin ? "md:grid-cols-7" : "md:grid-cols-6",
            )}
          >
            <TabsTrigger
              value="import"
              className="flex flex-col items-center justify-center gap-1"
            >
              <Database className="h-5 w-5" />
              <span className="text-xs sm:text-sm">Data</span>
            </TabsTrigger>
            <TabsTrigger
              value="templates"
              className="flex flex-col items-center justify-center gap-1"
            >
              <LayoutTemplate className="h-5 w-5" />
              <span className="text-xs sm:text-sm">Templates</span>
            </TabsTrigger>
            <TabsTrigger
              value="entry"
              className="flex flex-col items-center justify-center gap-1"
            >
              <PenSquare className="h-5 w-5" />
              <span className="text-xs sm:text-sm">Add Salary</span>
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="flex flex-col items-center justify-center gap-1"
            >
              <CalendarDays className="h-5 w-5" />
              <span className="text-xs sm:text-sm">History</span>
            </TabsTrigger>
            <TabsTrigger
              value="data"
              className="flex flex-col items-center justify-center gap-1"
            >
              <BarChart3 className="h-5 w-5" />
              <span className="text-xs sm:text-sm">Summary</span>
            </TabsTrigger>
            <TabsTrigger
              value="budget"
              className="flex flex-col items-center justify-center gap-1"
            >
              <PieChart className="h-5 w-5" />
              <span className="text-xs sm:text-sm">Budget</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger
                value="admin"
                className="flex flex-col items-center justify-center gap-1"
              >
                <Shield className="h-5 w-5" />
                <span className="text-xs sm:text-sm">Admin</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="import" className="space-y-6">
            <BulkImport />
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            <OrganizationTemplates userId={user.id} />
          </TabsContent>

          <TabsContent value="entry" className="space-y-6">
            <ManualEntryForm
              userId={user.id}
              onSubmitSuccess={handleDataChange}
            />
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <SalaryHistory
              userId={user.id}
              refreshTrigger={refreshTrigger}
            />
          </TabsContent>

          <TabsContent value="data" className="space-y-6">
            <SalaryDataTable userId={user.id} refreshTrigger={refreshTrigger} />
          </TabsContent>

          <TabsContent value="budget" className="space-y-6">
            <SalaryBudgetPlanning userId={user.id} />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="admin" className="space-y-6">
              <AdminPanel currentUserId={user.id} />
            </TabsContent>
          )}
        </Tabs>

        {/* Mobile bottom navigation */}
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] md:hidden">
          <nav className="pointer-events-auto glass-surface mx-4 mb-4 flex max-w-md flex-1 items-center justify-around rounded-xl border border-border/70 bg-background/80 backdrop-blur-xl shadow-lg">
            <button
              type="button"
              onClick={() => setActiveTab("import")}
              className={cn(
                "flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0 rounded-xl px-2 py-2 text-[11px] font-medium text-muted-foreground transition-transform duration-150 active:scale-95",
                activeTab === "import" &&
                  "bg-primary/15 text-primary shadow-[0_6px_16px_rgba(0,0,0,0.35)]",
              )}
            >
              <Database className="h-5 w-5" />
              {activeTab === "import" && <span>Data</span>}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={cn(
                "flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0 rounded-xl px-2 py-2 text-[11px] font-medium text-muted-foreground transition-transform duration-150 active:scale-95",
                activeTab === "history" &&
                  "bg-primary/15 text-primary shadow-[0_6px_16px_rgba(0,0,0,0.35)]",
              )}
            >
              <CalendarDays className="h-5 w-5" />
              {activeTab === "history" && <span>History</span>}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("entry")}
              className={cn(
                "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0 rounded-xl px-3 py-2 text-[11px] font-semibold text-muted-foreground transition-transform duration-150 active:scale-95",
                activeTab === "entry"
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/40"
                  : "bg-primary/10 text-primary",
              )}
            >
              <PenSquare className="h-[22px] w-[22px]" />
              {activeTab === "entry" && <span>Add</span>}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("data")}
              className={cn(
                "flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0 rounded-xl px-2 py-2 text-[11px] font-medium text-muted-foreground transition-transform duration-150 active:scale-95",
                activeTab === "data" &&
                  "bg-primary/15 text-primary shadow-[0_6px_16px_rgba(0,0,0,0.35)]",
              )}
            >
              <BarChart3 className="h-5 w-5" />
              {activeTab === "data" && <span>Summary</span>}
            </button>

            <button
              type="button"
              onClick={() => setIsMoreOpen((prev) => !prev)}
              className={cn(
                "flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0 rounded-xl px-2 py-2 text-[11px] font-medium text-muted-foreground transition-transform duration-150 active:scale-95",
                ["templates", "budget", "admin"].includes(activeTab) &&
                  "bg-primary/15 text-primary shadow-[0_6px_16px_rgba(0,0,0,0.35)]",
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              {["templates", "budget", "admin"].includes(activeTab) && <span>More</span>}
            </button>
          </nav>

          {isMoreOpen && (
            <div className="pointer-events-auto mb-2 flex justify-center">
              <div className="glass-surface w-full max-w-md rounded-xl border border-border/70 bg-background/95 p-2 shadow-lg">
                <div className="flex flex-col gap-1 text-sm">
                  <button
                    type="button"
                    className="flex min-h-[40px] items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-primary/10"
                    onClick={() => {
                      setActiveTab("templates");
                      setIsMoreOpen(false);
                    }}
                  >
                    <span>Templates</span>
                    <LayoutTemplate className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="flex min-h-[40px] items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-primary/10"
                    onClick={() => {
                      setActiveTab("budget");
                      setIsMoreOpen(false);
                    }}
                  >
                    <span>Budget</span>
                    <PieChart className="h-4 w-4" />
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      className="flex min-h-[40px] items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-primary/10"
                      onClick={() => {
                        setActiveTab("admin");
                        setIsMoreOpen(false);
                      }}
                    >
                      <span>Admin</span>
                      <Shield className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
 
export default Index;
