import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Wallet2, Plus, GripVertical, Trash2, ChevronDown, ChevronRight, Home, UtensilsCrossed, PiggyBank, Sparkles, Receipt, Landmark, CreditCard, Eye, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";

interface SalaryBudgetPlanningProps {
  userId: string;
}

interface BudgetSubcategory {
  id: string;
  name: string;
  amount: number;
}

interface BudgetCategory {
  id: string;
  name: string;
  amount: number;
  subcategories: BudgetSubcategory[];
}

const initialCategories: BudgetCategory[] = [
  {
    id: "housing",
    name: "Housing",
    amount: 1000,
    subcategories: [{ id: "rent", name: "Rent", amount: 1000 }],
  },
  {
    id: "bills",
    name: "Bills & Utilities",
    amount: 0,
    subcategories: [
      { id: "electricity", name: "Electricity", amount: 0 },
      { id: "internet", name: "Internet", amount: 0 },
      { id: "water", name: "Water", amount: 0 },
    ],
  },
  {
    id: "loans",
    name: "Loans & EMIs",
    amount: 0,
    subcategories: [
      { id: "home-loan", name: "Home Loan", amount: 0 },
      { id: "personal-loan", name: "Personal Loan", amount: 0 },
      { id: "education-loan", name: "Education Loan", amount: 0 },
    ],
  },
  {
    id: "food",
    name: "Food & Groceries",
    amount: 0,
    subcategories: [
      { id: "groceries", name: "Groceries", amount: 0 },
      { id: "dining", name: "Dining Out", amount: 0 },
    ],
  },
  {
    id: "savings",
    name: "Savings & Investments",
    amount: 0,
    subcategories: [
      { id: "emergency", name: "Emergency Fund", amount: 0 },
      { id: "retirement", name: "Retirement", amount: 0 },
    ],
  },
  {
    id: "lifestyle",
    name: "Lifestyle",
    amount: 0,
    subcategories: [
      { id: "entertainment", name: "Entertainment", amount: 0 },
      { id: "shopping", name: "Shopping", amount: 0 },
    ],
  },
];

const categoryColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

interface EditAllocationState {
  type: "category" | "subcategory" | null;
  categoryId: string | null;
  subcategoryId?: string | null;
}

interface BudgetHistoryEntry {
  id: string;
  month: number;
  year: number;
  netIncome: number;
  totalAllocated: number;
  remaining: number;
  categories: BudgetCategory[];
  savedAt: string;
}

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function SalaryBudgetPlanning({ userId }: SalaryBudgetPlanningProps) {
  // Helper to create user-specific storage keys
  const getStorageKey = (key: string) => `salary_budget_${userId}_${key}`;

  const [netIncome, setNetIncome] = useState<number>(() => {
    if (typeof window !== "undefined" && userId) {
      const stored = window.localStorage.getItem(getStorageKey("net_income"));
      const parsed = stored ? parseInt(stored, 10) : NaN;
      if (!isNaN(parsed) && parsed >= 0) {
        return parsed;
      }
    }
    return 100000;
  });
  const [netIncomeInput, setNetIncomeInput] = useState<string>(() => netIncome.toString());
  const [isEditingNetIncome, setIsEditingNetIncome] = useState(false);
  
  // Load categories from localStorage for this specific user
  const [categories, setCategories] = useState<BudgetCategory[]>(() => {
    if (typeof window !== "undefined" && userId) {
      const stored = window.localStorage.getItem(getStorageKey("categories"));
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as BudgetCategory[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        } catch {
          // Fall through to default
        }
      }
    }
    return initialCategories;
  });

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addType, setAddType] = useState<"category" | "subcategory">("category");
  const [selectedCategoryForSub, setSelectedCategoryForSub] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editAllocation, setEditAllocation] = useState<EditAllocationState>({
    type: null,
    categoryId: null,
    subcategoryId: null,
  });
  const [editAmount, setEditAmount] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  
  // History state - loaded from database
  const [history, setHistory] = useState<BudgetHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Load history from database
  const loadHistory = useCallback(async () => {
    if (!userId) return;
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('budget_history')
        .select('*')
        .eq('user_id', userId)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(6);
      
      if (error) throw error;
      
      const entries: BudgetHistoryEntry[] = (data || []).map(row => ({
        id: row.id,
        month: row.month,
        year: row.year,
        netIncome: Number(row.net_income),
        totalAllocated: Number(row.total_allocated),
        remaining: Number(row.remaining),
        categories: (row.categories as unknown) as BudgetCategory[],
        savedAt: row.saved_at,
      }));
      
      setHistory(entries);
    } catch (error) {
      console.error('Error loading budget history:', error);
      toast.error('Failed to load budget history');
    } finally {
      setIsLoadingHistory(false);
    }
  }, [userId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Persist net income to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined" && userId) {
      window.localStorage.setItem(getStorageKey("net_income"), String(netIncome));
    }
  }, [netIncome, userId]);

  // Persist categories to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== "undefined" && userId) {
      window.localStorage.setItem(getStorageKey("categories"), JSON.stringify(categories));
    }
  }, [categories, userId]);

  // Calculate category amount from sum of subcategories
  const getCategoryTotal = (category: BudgetCategory) => {
    return category.subcategories.reduce((sum, sub) => sum + (sub.amount || 0), 0);
  };

  const totalAllocated = useMemo(
    () => categories.reduce((sum, cat) => sum + getCategoryTotal(cat), 0),
    [categories],
  );

  const remaining = useMemo(() => Math.max(netIncome - totalAllocated, 0), [netIncome, totalAllocated]);

  const handleNetIncomeBlur = () => {
    const value = parseInt(netIncomeInput.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(value) && value >= 0) {
      setNetIncome(value);
    }
    setIsEditingNetIncome(false);
  };

  const [activeHistoryEntry, setActiveHistoryEntry] = useState<BudgetHistoryEntry | null>(null);
  const [historyDialogMode, setHistoryDialogMode] = useState<"view" | "edit" | null>(null);
  const [historyEditNetIncome, setHistoryEditNetIncome] = useState<string>("");
  const [historyEditAllocated, setHistoryEditAllocated] = useState<string>("");
  const [historyEditCategories, setHistoryEditCategories] = useState<BudgetCategory[] | null>(null);

  const handleViewHistory = (entry: BudgetHistoryEntry) => {
    setActiveHistoryEntry(entry);
    setHistoryDialogMode("view");
    setHistoryEditNetIncome(entry.netIncome.toString());
    setHistoryEditAllocated(entry.totalAllocated.toString());
    setHistoryEditCategories(null);
  };

  const handleEditHistory = (entry: BudgetHistoryEntry) => {
    setActiveHistoryEntry(entry);
    setHistoryDialogMode("edit");
    setHistoryEditNetIncome(entry.netIncome.toString());
    setHistoryEditAllocated(entry.totalAllocated.toString());
    setHistoryEditCategories(entry.categories ? [...entry.categories] : []);
  };

  const handleDeleteHistory = async (id: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('budget_history')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setHistory(prev => prev.filter(entry => entry.id !== id));
      toast.success('Budget entry deleted');
    } catch (error) {
      console.error('Error deleting budget history:', error);
      toast.error('Failed to delete budget entry');
    }
  };

  const saveEditedHistory = async () => {
    if (!activeHistoryEntry) return;

    const net = parseInt(historyEditNetIncome.replace(/[^0-9]/g, ""), 10);

    if (isNaN(net) || net < 0) return;

    // If we have edited categories, recompute allocated from them; otherwise fall back to the input value
    let allocatedFromCategories = 0;
    if (historyEditCategories && historyEditCategories.length > 0) {
      allocatedFromCategories = historyEditCategories.reduce((catSum, cat) => {
        const catTotal = (cat.subcategories || []).reduce(
          (sum, sub) => sum + (sub.amount || 0),
          0,
        );
        return catSum + catTotal;
      }, 0);
    }

    const allocatedInput = parseInt(historyEditAllocated.replace(/[^0-9]/g, ""), 10);
    const allocated = allocatedFromCategories > 0 ? allocatedFromCategories : allocatedInput;

    if (isNaN(allocated) || allocated < 0) return;

    const updatedRemaining = Math.max(net - allocated, 0);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('budget_history')
        .update({
          net_income: net,
          total_allocated: allocated,
          remaining: updatedRemaining,
          categories: historyEditCategories && historyEditCategories.length > 0
            ? historyEditCategories
            : activeHistoryEntry.categories,
        })
        .eq('id', activeHistoryEntry.id);
      
      if (error) throw error;

      const updatedCategories = historyEditCategories && historyEditCategories.length > 0
        ? historyEditCategories
        : activeHistoryEntry.categories;

      setHistory(prev =>
        prev.map(entry =>
          entry.id === activeHistoryEntry.id
            ? { ...entry, netIncome: net, totalAllocated: allocated, remaining: updatedRemaining, categories: updatedCategories }
            : entry,
        ),
      );
      
      toast.success('Budget entry updated');
    } catch (error) {
      console.error('Error updating budget history:', error);
      toast.error('Failed to update budget entry');
    }

    setHistoryDialogMode(null);
    setActiveHistoryEntry(null);
    setHistoryEditCategories(null);
  };

  const openEditAllocation = (type: "category" | "subcategory", categoryId: string, subcategoryId?: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;
    const currentAmount =
      type === "category"
        ? category.amount
        : category.subcategories.find(s => s.id === subcategoryId)?.amount ?? 0;
    setEditAllocation({ type, categoryId, subcategoryId: subcategoryId ?? null });
    setEditAmount(currentAmount.toString());
  };

  const saveEditAllocation = () => {
    if (!editAllocation.type || !editAllocation.categoryId) return;
    const value = parseInt(editAmount.replace(/[^0-9]/g, ""), 10);
    if (isNaN(value) || value < 0) return;

    // Only handle subcategory edits - category amounts are auto-calculated
    if (editAllocation.type === "subcategory" && editAllocation.subcategoryId) {
      setCategories(prev =>
        prev.map(category => {
          if (category.id !== editAllocation.categoryId) return category;
          return {
            ...category,
            subcategories: category.subcategories.map(sub =>
              sub.id === editAllocation.subcategoryId ? { ...sub, amount: value } : sub,
            ),
          };
        }),
      );
    }

    setEditAllocation({ type: null, categoryId: null, subcategoryId: null });
    setEditAmount("");
  };

const categoryIconMap: Record<string, JSX.Element> = {
  housing: <Home className="h-3.5 w-3.5" />,
  bills: <Receipt className="h-3.5 w-3.5" />,
  loans: <Landmark className="h-3.5 w-3.5" />,
  food: <UtensilsCrossed className="h-3.5 w-3.5" />,
  savings: <PiggyBank className="h-3.5 w-3.5" />,
  lifestyle: <Sparkles className="h-3.5 w-3.5" />,
};

function getCategoryIcon(id: string, name: string) {
  const key = id.toLowerCase();
  if (categoryIconMap[key]) return categoryIconMap[key];
  if (name.toLowerCase().includes("loan")) return <Landmark className="h-3.5 w-3.5" />;
  if (name.toLowerCase().includes("bill")) return <Receipt className="h-3.5 w-3.5" />;
  if (name.toLowerCase().includes("food") || name.toLowerCase().includes("grocery")) {
    return <UtensilsCrossed className="h-3.5 w-3.5" />;
  }
  if (name.toLowerCase().includes("save") || name.toLowerCase().includes("invest")) {
    return <PiggyBank className="h-3.5 w-3.5" />;
  }
  return <CreditCard className="h-3.5 w-3.5" />;
}

  const handleReorderCategory = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= categories.length) return;
    setCategories(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const handleDeleteCategory = (id: string) => {
    setCategories(prev => prev.filter(cat => cat.id !== id));
  };

  const handleDeleteSubcategory = (categoryId: string, subId: string) => {
    setCategories(prev =>
      prev.map(cat =>
        cat.id === categoryId
          ? { ...cat, subcategories: cat.subcategories.filter(s => s.id !== subId) }
          : cat,
      ),
    );
  };

  const handleAddItem = () => {
    if (!newName.trim()) return;

    if (addType === "category") {
      const id = newName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      setCategories(prev => [
        ...prev,
        {
          id: `${id}-${Date.now()}`,
          name: newName.trim(),
          amount: 0,
          subcategories: [],
        },
      ]);
    } else if (addType === "subcategory" && selectedCategoryForSub) {
      setCategories(prev =>
        prev.map(cat =>
          cat.id === selectedCategoryForSub
            ? {
                ...cat,
                subcategories: [
                  ...cat.subcategories,
                  {
                    id: `${selectedCategoryForSub}-sub-${Date.now()}`,
                    name: newName.trim(),
                    amount: 0,
                  },
                ],
              }
            : cat,
        ),
      );
    }

    setNewName("");
    setSelectedCategoryForSub(null);
    setIsAddDialogOpen(false);
  };

  const chartData = useMemo(
    () => {
      const slices: { id: string; name: string; value: number }[] = [];
      categories.forEach(category => {
        const categoryTotal = getCategoryTotal(category);
        if (categoryTotal > 0) {
          slices.push({ id: category.id, name: category.name, value: categoryTotal });
        }
      });
      return slices;
    },
    [categories],
  );

  const subcategoryChartData = useMemo(
    () => {
      const slices: { name: string; value: number }[] = [];
      categories.forEach(category => {
        category.subcategories.forEach(sub => {
          if (sub.amount > 0) {
            slices.push({ name: sub.name, value: sub.amount });
          }
        });
      });
      return slices;
    },
    [categories],
  );

  const formatCurrency = (value: number) =>
    `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const percentageFor = (amount: number) =>
    netIncome > 0 ? Math.round((amount / netIncome) * 100) : 0;

  const handleSaveBudget = async () => {
    // Check if we already have 6 entries - if so, we need to delete the oldest
    if (history.length >= 6) {
      // Find the oldest entry (last in the sorted array)
      const oldestEntry = history[history.length - 1];
      
      // Check if we're updating an existing month/year or adding new
      const existingEntry = history.find(e => e.month === selectedMonth && e.year === selectedYear);
      
      if (!existingEntry) {
        // Need to delete oldest to make room
        try {
          await supabase
            .from('budget_history')
            .delete()
            .eq('id', oldestEntry.id);
        } catch (error) {
          console.error('Error removing oldest budget:', error);
        }
      }
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('budget_history')
        .upsert({
          user_id: userId,
          month: selectedMonth,
          year: selectedYear,
          net_income: netIncome,
          total_allocated: totalAllocated,
          remaining: remaining,
          categories: categories,
          saved_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,month,year',
        });
      
      if (error) throw error;
      
      // Reload history from database to get updated list
      await loadHistory();
      toast.success('Budget saved successfully');
    } catch (error) {
      console.error('Error saving budget:', error);
      toast.error('Failed to save budget');
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <header className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Wallet2 className="h-6 w-6 text-primary" />
            Salary Budget
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Plan your monthly salary across categories with a clear, interactive budget view.
          </p>
        </header>
        <div className="flex items-center gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Budget month</span>
            <select
              className="h-8 rounded-md border border-border bg-background px-2 text-xs sm:text-sm"
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
            >
              {monthNames.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Year</span>
            <select
              className="h-8 rounded-md border border-border bg-background px-2 text-xs sm:text-sm"
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
            >
              {Array.from({ length: 5 }).map((_, idx) => {
                const year = new Date().getFullYear() - 2 + idx;
                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                );
              })}
            </select>
          </div>
          <Button size="sm" onClick={handleSaveBudget}>
            Save Budget
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
        <Card className="relative overflow-hidden border-border/60 bg-background/70 backdrop-blur-md shadow-md">
          <CardHeader className="space-y-1 pb-3">
            <CardDescription className="uppercase text-[11px] tracking-wide text-muted-foreground">
              Monthly Net Income
            </CardDescription>
            <div className="flex items-baseline gap-2">
              {isEditingNetIncome ? (
                <Input
                  autoFocus
                  value={netIncomeInput}
                  type="number"
                  className="h-8 w-32 bg-background/80 text-lg font-semibold"
                  onBlur={handleNetIncomeBlur}
                  onChange={e => setNetIncomeInput(e.target.value)}
                />
              ) : (
                <button
                  type="button"
                  onDoubleClick={() => {
                    setNetIncomeInput(netIncome.toString());
                    setIsEditingNetIncome(true);
                  }}
                  className="text-2xl font-semibold hover:text-primary transition-colors"
                >
                  {formatCurrency(netIncome)}
                </button>
              )}
            </div>
          </CardHeader>
        </Card>

        <Card className="relative overflow-hidden border-primary/30 bg-primary/5 backdrop-blur-md shadow-md">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/20" />
          <CardHeader className="relative space-y-1 pb-3">
            <CardDescription className="uppercase text-[11px] tracking-wide text-muted-foreground">
              Allocated
            </CardDescription>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-semibold">{formatCurrency(totalAllocated)}</div>
              <span className="text-xs text-muted-foreground">
                {percentageFor(totalAllocated)}% of income
              </span>
            </div>
          </CardHeader>
        </Card>

        <Card className="relative overflow-hidden border-success/40 bg-success/5 backdrop-blur-md shadow-md">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-success/15 via-transparent to-accent/20" />
          <CardHeader className="relative space-y-1 pb-3">
            <CardDescription className="uppercase text-[11px] tracking-wide text-muted-foreground">
              Remaining
            </CardDescription>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-semibold">{formatCurrency(remaining)}</div>
              <span className="text-xs text-muted-foreground">
                {percentageFor(remaining)}% of income
              </span>
            </div>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Budget Categories - takes 2 columns */}
        <Card className="relative overflow-hidden border-border/60 bg-background/80 backdrop-blur-xl shadow-lg lg:col-span-2">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-background/60 to-secondary/10" />
          <CardHeader className="relative flex flex-row items-center justify-between gap-2 pb-3">
            <div>
              <CardTitle className="text-lg sm:text-xl">Budget Categories</CardTitle>
              <CardDescription>
                Tap amounts to fine-tune allocations. Drag handles to reorder categories.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="relative pt-0">
            <ScrollArea className="h-[450px] pr-3">
              <Accordion type="single" collapsible className="space-y-2">
                {categories.map((category, index) => {
                  const categoryTotal = getCategoryTotal(category);
                  const categoryPercent = percentageFor(categoryTotal);
                  return (
                    <AccordionItem
                      key={category.id}
                      value={category.id}
                      className="border border-border/70 rounded-xl bg-background/80 backdrop-blur-md px-3"
                    >
                      <AccordionTrigger className="flex items-center gap-2 py-3 [&>svg]:hidden">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                            {getCategoryIcon(category.id, category.name)}
                          </div>
                          <Input
                            value={category.name}
                            onChange={e =>
                              setCategories(prev =>
                                prev.map(cat =>
                                  cat.id === category.id ? { ...cat, name: e.target.value } : cat,
                                ),
                              )
                            }
                            className="h-8 border-0 bg-transparent px-1 text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          {/* Auto-calculated category total - not editable */}
                          <div
                            className="flex items-baseline gap-2 rounded-full bg-primary/5 px-3 py-1 text-xs sm:text-sm font-medium text-primary"
                            title="Auto-calculated from subcategories"
                          >
                            <span>{formatCurrency(categoryTotal)}</span>
                            <span className="text-muted-foreground">{categoryPercent}%</span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                handleReorderCategory(index, index - 1);
                              }}
                              className="p-1 rounded hover:bg-muted/60"
                              aria-label="Move up"
                            >
                              <ChevronUpIcon />
                            </button>
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                handleReorderCategory(index, index + 1);
                              }}
                              className="p-1 rounded hover:bg-muted/60"
                              aria-label="Move down"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              handleDeleteCategory(category.id);
                            }}
                            className="p-1 rounded-full hover:bg-destructive/10 text-destructive"
                            aria-label="Delete category"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <span className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                            <GripVertical className="h-4 w-4" />
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-3">
                        <div className="ml-8 flex flex-col gap-1">
                          {category.subcategories.map(sub => {
                            const subPercent = percentageFor(sub.amount);
                            return (
                              <div
                                key={sub.id}
                                className="flex h-11 items-center rounded-lg px-2 hover:bg-muted/60 transition-colors"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className="h-4 w-4 rounded-full bg-primary/10" />
                                  <Input
                                    value={sub.name}
                                    onChange={e =>
                                      setCategories(prev =>
                                        prev.map(cat =>
                                          cat.id === category.id
                                            ? {
                                                ...cat,
                                                subcategories: cat.subcategories.map(s =>
                                                  s.id === sub.id ? { ...s, name: e.target.value } : s,
                                                ),
                                              }
                                            : cat,
                                        ),
                                      )
                                    }
                                    className="h-8 border-0 bg-transparent px-1 text-xs sm:text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openEditAllocation("subcategory", category.id, sub.id)}
                                  className="flex items-baseline gap-2 rounded-full bg-primary/5 px-3 py-1 text-xs sm:text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
                                >
                                  <span>{formatCurrency(sub.amount)}</span>
                                  <span className="text-muted-foreground">{subPercent}%</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSubcategory(category.id, sub.id)}
                                  className="ml-2 p-1 rounded-full hover:bg-destructive/10 text-destructive"
                                  aria-label="Delete subcategory"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            );
                          })}
                          {/* Add Subcategory Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setAddType("subcategory");
                              setSelectedCategoryForSub(category.id);
                              setIsAddDialogOpen(true);
                            }}
                            className="flex h-10 items-center gap-2 rounded-lg px-2 text-xs sm:text-sm text-muted-foreground hover:bg-muted/60 hover:text-primary transition-colors border border-dashed border-border/60 mt-2"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Add Subcategory</span>
                          </button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Budget Overview - takes 1 column */}
        <Card className="relative overflow-hidden border-border/60 bg-background/80 backdrop-blur-xl shadow-lg">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/40 via-primary/5 to-secondary/15" />
          <CardHeader className="relative pb-2">
            <CardTitle className="text-lg sm:text-xl">Budget Overview</CardTitle>
            <CardDescription>See how your planned allocations stack up.</CardDescription>
          </CardHeader>
          <CardContent className="relative pt-0 space-y-4">
            <div className="space-y-4">
              <div className="h-48 sm:h-52 rounded-2xl border border-border/70 bg-background/70 shadow-inner flex flex-col justify-center p-4">
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">Allocation by Category</h3>
                {chartData.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Start by allocating amounts to categories to see the drill-down chart.
                  </p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="65%">
                      <BarChart
                        data={chartData}
                        margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis
                          dataKey="name"
                          stroke="hsl(var(--muted-foreground))"
                          tickLine={false}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          tickLine={false}
                          tickFormatter={(v) => `₹${Math.round((v as number) / 1000)}k`}
                        />
                        <Tooltip
                          formatter={(value: number, _name, props: any) => [
                            formatCurrency(value),
                            (props?.payload as any)?.name,
                          ]}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            borderRadius: 12,
                            border: "1px solid hsl(var(--border))",
                            boxShadow: "var(--shadow-md)",
                            color: "hsl(var(--foreground))",
                          }}
                          labelStyle={{ color: "hsl(var(--foreground))" }}
                          itemStyle={{ color: "hsl(var(--foreground))" }}
                        />
                        <Bar
                          dataKey="value"
                          name="Allocated amount"
                          fill="hsl(var(--chart-1))"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-2 flex flex-wrap justify-center gap-1.5 text-[10px]">
                      {chartData.slice(0, 4).map((entry, index) => (
                        <div
                          key={entry.name}
                          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: categoryColors[index % categoryColors.length] }}
                          />
                          <span className="truncate max-w-[60px]">{entry.name}</span>
                        </div>
                      ))}
                      {chartData.length > 4 && (
                        <span className="text-muted-foreground">+{chartData.length - 4} more</span>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="h-48 sm:h-52 rounded-2xl border border-border/70 bg-background/70 shadow-inner flex flex-col justify-center p-4">
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">Allocation by Subcategory</h3>
                {subcategoryChartData.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Start by allocating amounts to subcategories to see the sunburst chart.
                  </p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="65%">
                      <PieChart>
                        {/* Inner ring: categories */}
                        {(() => {
                          const categoriesWithTotals = categories
                            .map(cat => ({
                              id: cat.id,
                              name: cat.name,
                              total: getCategoryTotal(cat),
                            }))
                            .filter(cat => cat.total > 0);

                          const subSlices = categories.flatMap(cat =>
                            cat.subcategories
                              .filter(sub => sub.amount > 0)
                              .map(sub => ({
                                categoryId: cat.id,
                                name: sub.name,
                                value: sub.amount,
                              })),
                          );

                          return (
                            <>
                              <Pie
                                data={categoriesWithTotals}
                                dataKey="total"
                                nameKey="name"
                                innerRadius={12}
                                outerRadius={40}
                                paddingAngle={2}
                                strokeWidth={2}
                              >
                                {categoriesWithTotals.map((entry, index) => (
                                  <Cell
                                    key={entry.id}
                                    fill={categoryColors[index % categoryColors.length]}
                                  />
                                ))}
                              </Pie>
                              <Pie
                                data={subSlices}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={46}
                                outerRadius={70}
                                paddingAngle={2}
                                strokeWidth={2}
                              >
                                {subSlices.map((entry, index) => {
                                  const categoryIndex = categoriesWithTotals.findIndex(
                                    cat => cat.id === entry.categoryId,
                                  );
                                  const colorIndex =
                                    categoryIndex >= 0 ? categoryIndex : index;
                                  return (
                                    <Cell
                                      key={`${entry.categoryId}-${entry.name}`}
                                      fill={categoryColors[colorIndex % categoryColors.length]}
                                    />
                                  );
                                })}
                              </Pie>
                              <Tooltip
                                formatter={(value: number, _name, props: any) => [
                                  formatCurrency(value),
                                  (props?.payload as any)?.name,
                                ]}
                                contentStyle={{
                                  backgroundColor: "hsl(var(--card))",
                                  borderRadius: 12,
                                  border: "1px solid hsl(var(--border))",
                                  boxShadow: "var(--shadow-md)",
                                  color: "hsl(var(--foreground))",
                                }}
                                labelStyle={{ color: "hsl(var(--foreground))" }}
                                itemStyle={{ color: "hsl(var(--foreground))" }}
                              />
                            </>
                          );
                        })()}
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-2 flex flex-wrap justify-center gap-1.5 text-[10px]">
                      {subcategoryChartData.slice(0, 4).map((entry, index) => (
                        <div
                          key={entry.name}
                          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{
                              backgroundColor:
                                categoryColors[index % categoryColors.length],
                            }}
                          />
                          <span className="truncate max-w-[60px]">{entry.name}</span>
                        </div>
                      ))}
                      {subcategoryChartData.length > 4 && (
                        <span className="text-muted-foreground">+{subcategoryChartData.length - 4} more</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Budget History - spans full width */}
        <Card className="relative overflow-hidden border-border/60 bg-background/80 backdrop-blur-xl shadow-lg lg:col-span-3">
          <CardHeader className="relative pb-2">
            <CardTitle className="text-lg sm:text-xl">Budget History</CardTitle>
            <CardDescription>Previously saved monthly budgets.</CardDescription>
          </CardHeader>
          <CardContent className="relative pt-0">
            {isLoadingHistory ? (
              <p className="text-xs text-muted-foreground">Loading budget history...</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-muted-foreground">No saved budgets yet. Save a budget to see it here. (Maximum 6 entries)</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-64 overflow-y-auto pr-1">
                {history.map(entry => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg border border-border/70 bg-background/80 px-3 py-2 text-xs sm:text-sm"
                  >
                    <div className="space-y-0.5">
                      <div className="font-medium">
                        {monthNames[entry.month - 1]} {entry.year}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex flex-wrap gap-2">
                        <span>Net {formatCurrency(entry.netIncome)}</span>
                        <span>Allocated {formatCurrency(entry.totalAllocated)}</span>
                        <span>Remaining {formatCurrency(entry.remaining)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => handleViewHistory(entry)}
                        aria-label="View budget entry"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        onClick={() => handleEditHistory(entry)}
                        aria-label="Edit budget entry"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteHistory(entry.id)}
                        aria-label="Delete budget entry"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to Budget</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex gap-2 rounded-full bg-muted/60 p-1 text-xs sm:text-sm">
              <button
                type="button"
                onClick={() => setAddType("category")}
                className={cn(
                  "flex-1 rounded-full px-3 py-1.5 transition-colors",
                  addType === "category" ? "bg-background text-primary shadow-sm" : "text-muted-foreground",
                )}
              >
                Add Category
              </button>
              <button
                type="button"
                onClick={() => setAddType("subcategory")}
                className={cn(
                  "flex-1 rounded-full px-3 py-1.5 transition-colors",
                  addType === "subcategory" ? "bg-background text-primary shadow-sm" : "text-muted-foreground",
                )}
              >
                Add Subcategory
              </button>
            </div>

            {addType === "subcategory" && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Parent category</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategoryForSub(cat.id)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs sm:text-sm transition-colors",
                        selectedCategoryForSub === cat.id
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border bg-background text-foreground hover:bg-muted/60",
                      )}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Name</p>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder={addType === "category" ? "e.g. Health" : "e.g. Gym"}
              />
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                setNewName("");
                setSelectedCategoryForSub(null);
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleAddItem} disabled={!newName.trim() || (addType === "subcategory" && !selectedCategoryForSub)}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editAllocation.type}
        onOpenChange={open => {
          if (!open) {
            setEditAllocation({ type: null, categoryId: null, subcategoryId: null });
            setEditAmount("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Allocation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground">
              Enter the planned monthly amount for this {editAllocation.type ?? ""}.
            </p>
            <Input
              type="number"
              value={editAmount}
              onChange={e => setEditAmount(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditAllocation({ type: null, categoryId: null, subcategoryId: null });
                setEditAmount("");
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={saveEditAllocation} disabled={!editAmount.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!historyDialogMode}
        onOpenChange={open => {
          if (!open) {
            setHistoryDialogMode(null);
            setActiveHistoryEntry(null);
            setHistoryEditCategories(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {historyDialogMode === "edit" ? "Edit Budget Entry" : "Budget Entry Details"}
            </DialogTitle>
          </DialogHeader>
          {activeHistoryEntry && (
            <div className="space-y-4 pt-2 text-sm flex-1 overflow-hidden flex flex-col">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Month</p>
                <p className="font-medium">
                  {monthNames[activeHistoryEntry.month - 1]} {activeHistoryEntry.year}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Net Income</p>
                  {historyDialogMode === "edit" ? (
                    <Input
                      type="number"
                      value={historyEditNetIncome}
                      onChange={e => setHistoryEditNetIncome(e.target.value)}
                    />
                  ) : (
                    <p className="font-semibold text-primary">{formatCurrency(activeHistoryEntry.netIncome)}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Allocated</p>
                  {historyDialogMode === "edit" ? (
                    <Input
                      type="number"
                      value={historyEditAllocated}
                      onChange={e => setHistoryEditAllocated(e.target.value)}
                    />
                  ) : (
                    <p className="font-semibold">{formatCurrency(activeHistoryEntry.totalAllocated)}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Remaining</p>
                  <p className="font-semibold text-green-600">{formatCurrency(activeHistoryEntry.remaining)}</p>
                </div>
              </div>
              
              {/* Categories & Subcategories */}
              <div className="space-y-2 flex-1 overflow-hidden">
                <p className="text-xs font-medium text-muted-foreground">Budget Breakdown</p>
                <ScrollArea className="h-[280px] pr-2">
                  <div className="space-y-3">
                    {(historyDialogMode === "edit" ? historyEditCategories : activeHistoryEntry.categories) &&
                    (historyDialogMode === "edit" ? historyEditCategories : activeHistoryEntry.categories)!.length > 0 ? (
                      (historyDialogMode === "edit" ? historyEditCategories : activeHistoryEntry.categories)!.map((category: BudgetCategory) => {
                        const categoryTotal = (category.subcategories || []).reduce(
                          (sum, sub) => sum + (sub.amount || 0),
                          0,
                        );
                        return (
                          <div key={category.id} className="rounded-lg border border-border/70 bg-muted/30 p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                                  {getCategoryIcon(category.id, category.name)}
                                </div>
                                <span className="font-medium">{category.name}</span>
                              </div>
                              <span className="font-semibold text-primary">{formatCurrency(categoryTotal)}</span>
                            </div>
                            {category.subcategories && category.subcategories.length > 0 && (
                              <div className="ml-8 space-y-1.5">
                                {category.subcategories.map((sub: BudgetSubcategory) => (
                                  <div key={sub.id} className="flex items-center justify-between text-xs gap-2">
                                    <span className="text-muted-foreground flex-1">{sub.name}</span>
                                    {historyDialogMode === "edit" ? (
                                      <Input
                                        type="number"
                                        className="w-24 h-7 text-right"
                                        value={sub.amount?.toString() ?? "0"}
                                        onChange={e => {
                                          const raw = e.target.value.replace(/[^0-9]/g, "");
                                          const value = raw ? parseInt(raw, 10) : 0;
                                          setHistoryEditCategories(prev => {
                                            if (!prev) return prev;
                                            const updated = prev.map(cat => {
                                              if (cat.id !== category.id) return cat;
                                              return {
                                                ...cat,
                                                subcategories: cat.subcategories.map(s =>
                                                  s.id === sub.id ? { ...s, amount: value } : s,
                                                ),
                                              };
                                            });

                                            const newAllocated = updated.reduce((catSum, cat) => {
                                              const catTotal = (cat.subcategories || []).reduce(
                                                (sum, s) => sum + (s.amount || 0),
                                                0,
                                              );
                                              return catSum + catTotal;
                                            }, 0);
                                            setHistoryEditAllocated(newAllocated.toString());

                                            return updated;
                                          });
                                        }}
                                      />
                                    ) : (
                                      <span>{formatCurrency(sub.amount || 0)}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-muted-foreground">No category data available for this entry.</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setHistoryDialogMode(null);
                setActiveHistoryEntry(null);
              }}
            >
              Close
            </Button>
            {historyDialogMode === "edit" && (
              <Button type="button" onClick={saveEditedHistory} disabled={!historyEditNetIncome.trim() || !historyEditAllocated.trim()}>
                Save Changes
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button
        type="button"
        size="icon"
        className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-2xl bg-primary text-primary-foreground hover:bg-primary/90"
        onClick={() => setIsAddDialogOpen(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>
    </section>
  );
}

function ChevronUpIcon() {
  return <ChevronRight className="h-4 w-4 rotate-[-90deg]" />;
}
