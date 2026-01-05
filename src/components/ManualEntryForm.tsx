import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { MONTHS, EARNING_CATEGORIES, DEDUCTION_CATEGORIES } from "@/types/salary";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface EarningEntry {
  category: string;
  amount: string;
  description: string;
}

interface DeductionEntry {
  category: string;
  amount: string;
  description: string;
}

interface ManualEntryFormProps {
  userId: string;
  onSubmitSuccess: () => void;
}

interface OrganizationTemplate {
  id: string;
  name: string;
}

export const ManualEntryForm = ({ userId, onSubmitSuccess }: ManualEntryFormProps) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const MAX_AMOUNT = 100_000_000; // Upper bound to prevent extreme salary values

  const [templates, setTemplates] = useState<OrganizationTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [organization, setOrganization] = useState("");
  const [month, setMonth] = useState<string>(currentMonth.toString());
  const [year, setYear] = useState<string>(currentYear.toString());
  const [earnings, setEarnings] = useState<EarningEntry[]>([
    { category: "Basic Salary", amount: "0", description: "" },
  ]);
  const [deductions, setDeductions] = useState<DeductionEntry[]>([
    { category: "Provident Fund (PF)", amount: "0", description: "" },
  ]);
  const [templateEarningCategories, setTemplateEarningCategories] = useState<string[]>([]);
  const [templateDeductionCategories, setTemplateDeductionCategories] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const latestTemplateIdRef = useRef<string | null>(null);

  const earningCategoryOptions =
    templateEarningCategories.length > 0 ? templateEarningCategories : EARNING_CATEGORIES;

  const deductionCategoryOptions =
    templateDeductionCategories.length > 0 ? templateDeductionCategories : DEDUCTION_CATEGORIES;

  // Fetch organization templates
  useEffect(() => {
    const fetchTemplates = async () => {
      const { data, error } = await supabase
        .from("organization_templates")
        .select("id, name")
        .eq("user_id", userId)
        .order("name");

      if (error) {
        console.error("Error fetching templates:", error);
        return;
      }

      setTemplates(data || []);
    };

    fetchTemplates();
  }, [userId]);

  // Load template when selected
  const handleTemplateSelect = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    latestTemplateIdRef.current = templateId;
 
    if (templateId === "none") {
      // Reset to defaults
      setOrganization("");
      setEarnings([{ category: "Basic Salary", amount: "0", description: "" }]);
      setDeductions([{ category: "Provident Fund (PF)", amount: "0", description: "" }]);
      setTemplateEarningCategories([]);
      setTemplateDeductionCategories([]);
      return;
    }
 
    // Find template name
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setOrganization(template.name);
    }
 
    // Capture the templateId for this request to avoid race conditions
    const currentTemplateId = templateId;
 
    // Fetch template earnings
    const { data: earningsData, error: earningsError } = await supabase
      .from("template_earnings")
      .select("category")
      .eq("template_id", templateId)
      .order("created_at", { ascending: true });
 
    if (earningsError) {
      console.error("Error fetching template earnings:", earningsError);
      toast.error("Failed to load template earnings");
      return;
    }
 
    // Fetch template deductions
    const { data: deductionsData, error: deductionsError } = await supabase
      .from("template_deductions")
      .select("category")
      .eq("template_id", templateId)
      .order("created_at", { ascending: true });
 
    if (deductionsError) {
      console.error("Error fetching template deductions:", deductionsError);
      toast.error("Failed to load template deductions");
      return;
    }
 
    // If user switched templates while we were loading, ignore this response
    if (latestTemplateIdRef.current !== currentTemplateId) {
      return;
    }
 
    // Populate form
    if (earningsData && earningsData.length > 0) {
      const templateEarnings = earningsData.map((e) => e.category);
      setEarnings(
        templateEarnings.map((category) => ({
          category,
          amount: "0",
          description: "",
        })),
      );
      setTemplateEarningCategories(templateEarnings);
    } else {
      // Fall back to default single earning row
      setEarnings([{ category: "Basic Salary", amount: "", description: "" }]);
      setTemplateEarningCategories([]);
    }
 
    if (deductionsData && deductionsData.length > 0) {
      const templateDeductions = deductionsData.map((d) => d.category);
      setDeductions(
        templateDeductions.map((category) => ({
          category,
          amount: "0",
          description: "",
        })),
      );
      setTemplateDeductionCategories(templateDeductions);
    } else {
      // Fall back to default single deduction row
      setDeductions([{ category: "Provident Fund (PF)", amount: "", description: "" }]);
      setTemplateDeductionCategories([]);
    }
 
    toast.success("Template loaded! Now fill in the amounts.");
  };

  const addEarning = () => {
    const baseCategory =
      templateEarningCategories.length > 0 ? templateEarningCategories[0] : EARNING_CATEGORIES[0];
    const last = earnings[earnings.length - 1];
    setEarnings([
      ...earnings,
      {
        category: last?.category || baseCategory,
        amount: last?.amount || "0",
        description: last?.description || "",
      },
    ]);
  };

  const removeEarning = (index: number) => {
    setEarnings(earnings.filter((_, i) => i !== index));
  };

  const updateEarning = (index: number, field: keyof EarningEntry, value: string) => {
    const updated = [...earnings];
    updated[index][field] = value;
    setEarnings(updated);
  };

  const addDeduction = () => {
    const baseCategory =
      templateDeductionCategories.length > 0
        ? templateDeductionCategories[0]
        : DEDUCTION_CATEGORIES[0];
    const last = deductions[deductions.length - 1];
    setDeductions([
      ...deductions,
      {
        category: last?.category || baseCategory,
        amount: last?.amount || "0",
        description: last?.description || "",
      },
    ]);
  };

  const removeDeduction = (index: number) => {
    setDeductions(deductions.filter((_, i) => i !== index));
  };

  const updateDeduction = (index: number, field: keyof DeductionEntry, value: string) => {
    const updated = [...deductions];
    updated[index][field] = value;
    setDeductions(updated);
  };

  const totalEarnings = earnings.reduce((sum, e) => sum + (parseFloat(e.amount || "0") || 0), 0);
  const totalDeductions = deductions.reduce((sum, d) => sum + (parseFloat(d.amount || "0") || 0), 0);
  const netPay = totalEarnings - totalDeductions;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);

    if (!Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) {
      toast.error("Please enter a valid month between 1 and 12.");
      return;
    }

    if (!Number.isFinite(yearNum) || yearNum < 2000 || yearNum > 2100) {
      toast.error("Please enter a valid year between 2000 and 2100.");
      return;
    }

    if (
      !Number.isFinite(totalEarnings) ||
      !Number.isFinite(totalDeductions) ||
      totalEarnings < 0 ||
      totalDeductions < 0 ||
      totalEarnings > MAX_AMOUNT ||
      totalDeductions > MAX_AMOUNT
    ) {
      toast.error("Please review earnings and deductions amounts. They must be between 0 and 100,000,000.");
      return;
    }

    const earningsData = earnings.map((e) => ({
      raw: e,
      amount: parseFloat(e.amount || "0"),
    }));
    const deductionsData = deductions.map((d) => ({
      raw: d,
      amount: parseFloat(d.amount || "0"),
    }));

    if (
      earningsData.some(({ amount }) => !Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) ||
      deductionsData.some(({ amount }) => !Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT)
    ) {
      toast.error("All earning and deduction amounts must be valid numbers between 0 and 100,000,000.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: salaryRecord, error: recordError } = await supabase
        .from("salary_records")
        .insert({
          user_id: userId,
          month: monthNum,
          year: yearNum,
          organization: organization || null,
          gross_salary: totalEarnings,
          net_salary: netPay,
          total_earnings: totalEarnings,
          total_deductions: totalDeductions,
        })
        .select()
        .single();

      if (recordError) throw recordError;

      const earningsRows = earningsData
        .filter(({ amount }) => amount > 0)
        .map(({ raw, amount }) => ({
          salary_record_id: salaryRecord.id,
          category: raw.category,
          amount,
          description: raw.description || null,
        }));

      const deductionRows = deductionsData
        .filter(({ amount }) => amount > 0)
        .map(({ raw, amount }) => ({
          salary_record_id: salaryRecord.id,
          category: raw.category,
          amount,
          description: raw.description || null,
        }));

      if (earningsRows.length > 0) {
        const { error: earningsError } = await supabase.from("earnings").insert(earningsRows);
        if (earningsError) throw earningsError;
      }

      if (deductionRows.length > 0) {
        const { error: deductionsError } = await supabase.from("deductions").insert(deductionRows);
        if (deductionsError) throw deductionsError;
      }

      toast.success("Salary record saved successfully!");

      setOrganization("");
      setMonth(currentMonth.toString());
      setYear(currentYear.toString());
      setEarnings([{ category: "Basic Salary", amount: "0", description: "" }]);
      setDeductions([{ category: "Provident Fund (PF)", amount: "0", description: "" }]);
      setTemplateEarningCategories([]);
      setTemplateDeductionCategories([]);

      onSubmitSuccess();
    } catch (error: any) {
      console.error("Submit error:", error);
      if (error.message?.includes("duplicate")) {
        toast.error("A record for this month already exists");
      } else {
        toast.error(error.message || "Failed to save salary record");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="animate-fade-in">

        <Card className="border-primary/40 bg-card/95 shadow-xl w-full">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold tracking-tight">Add Salary Record</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Select an organization template and key in values exactly as they appear on your payslip
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-0 pb-5 md:px-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Template & Organization Selection */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Organization Template</Label>
                  <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Manual Entry)</SelectItem>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Organization</Label>
                  <Input
                    className="h-9 text-sm"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="Company name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Month</Label>
                    <Select value={month} onValueChange={setMonth}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m, i) => (
                          <SelectItem key={i} value={(i + 1).toString()}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Year</Label>
                    <Select value={year} onValueChange={setYear}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 5 }, (_, i) => currentYear - i).map((y) => (
                          <SelectItem key={y} value={y.toString()}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedTemplateId && selectedTemplateId !== "none" && (
                  <div className="md:col-span-4 mt-1 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2.5 space-y-2 animate-fade-in">
                    <p className="text-[11px] text-muted-foreground">
                      Template sections loaded from your payslip. Use them as-is to keep reporting consistent.
                    </p>
                    <div className="grid md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="mb-1 font-medium text-primary text-[11px]">Earning sections</p>
                        <div className="flex flex-wrap gap-1.5">
                          {templateEarningCategories.map((cat) => (
                            <Tooltip key={cat}>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className="hover-scale text-[11px] px-2 py-0.5 border-primary/50 bg-background/40"
                                >
                                  {cat}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                <span>Payslip earning header: {cat}</span>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 font-medium text-destructive text-[11px]">Deduction sections</p>
                        <div className="flex flex-wrap gap-1.5">
                          {templateDeductionCategories.map((cat) => (
                            <Tooltip key={cat}>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className="hover-scale text-[11px] px-2 py-0.5 border-destructive/60 text-destructive bg-background/40"
                                >
                                  {cat}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                <span>Payslip deduction header: {cat}</span>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Separator className="my-1" />

              {/* Earnings and Deductions Side by Side */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Earnings Column */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold tracking-wide text-primary uppercase">
                      Earnings
                    </Label>
                    <Button type="button" size="sm" variant="outline" onClick={addEarning} className="h-8 px-2">
                      <Plus className="w-3 h-3 mr-1" />
                      <span className="text-xs">Add</span>
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    {earnings.map((earning, index) => (
                      <div
                        key={index}
                        className="flex gap-2 items-start bg-primary/5 px-2 py-1.5 rounded-lg border border-primary/20"
                      >
                        <div className="flex-1 space-y-1">
                          <Select
                            value={earning.category}
                            onValueChange={(value) => updateEarning(index, "category", value)}
                          >
                            <SelectTrigger className="h-8 text-[11px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {earningCategoryOptions.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            className="h-8 text-[11px]"
                            value={earning.description}
                            onChange={(e) => updateEarning(index, "description", e.target.value)}
                            placeholder="Description (optional)"
                          />
                        </div>
                        <Input
                          className="w-24 h-8 text-xs text-right"
                          type="number"
                          step="0.01"
                          value={earning.amount}
                          onChange={(e) => updateEarning(index, "amount", e.target.value)}
                          placeholder="₹"
                          required
                        />
                        {earnings.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            onClick={() => removeEarning(index)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center px-3 py-2 bg-primary/10 rounded-lg text-sm">
                    <span className="font-medium text-primary">Total Earnings</span>
                    <span className="font-semibold text-primary">
                      ₹{totalEarnings.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Deductions Column */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold tracking-wide text-destructive uppercase">
                      Deductions
                    </Label>
                    <Button type="button" size="sm" variant="outline" onClick={addDeduction} className="h-8 px-2">
                      <Plus className="w-3 h-3 mr-1" />
                      <span className="text-xs">Add</span>
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    {deductions.map((deduction, index) => (
                      <div
                        key={index}
                        className="flex gap-2 items-start bg-destructive/5 px-2 py-1.5 rounded-lg border border-destructive/20"
                      >
                        <div className="flex-1 space-y-1">
                          <Select
                            value={deduction.category}
                            onValueChange={(value) => updateDeduction(index, "category", value)}
                          >
                            <SelectTrigger className="h-8 text-[11px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {deductionCategoryOptions.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            className="h-8 text-[11px]"
                            value={deduction.description}
                            onChange={(e) => updateDeduction(index, "description", e.target.value)}
                            placeholder="Description (optional)"
                          />
                        </div>
                        <Input
                          className="w-24 h-8 text-xs text-right"
                          type="number"
                          step="0.01"
                          value={deduction.amount}
                          onChange={(e) => updateDeduction(index, "amount", e.target.value)}
                          placeholder="₹"
                          required
                        />
                        {deductions.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            onClick={() => removeDeduction(index)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center px-3 py-2 bg-destructive/10 rounded-lg text-sm">
                    <span className="font-medium text-destructive">Total Deductions</span>
                    <span className="font-semibold text-destructive">
                      ₹{totalDeductions.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <Separator className="my-1" />

              {/* Net Pay Details */}
              <Card className="border border-primary/40 bg-gradient-to-br from-primary/15 to-secondary/10">
                <CardContent className="pt-4 pb-4">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-center tracking-wide uppercase text-muted-foreground">
                      Net Pay Summary
                    </h3>
                    <div className="grid grid-cols-3 gap-4 text-center text-sm">
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-1">Gross Earnings</p>
                        <p className="text-base font-semibold text-primary">
                          ₹{totalEarnings.toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-1">Total Deductions</p>
                        <p className="text-base font-semibold text-destructive">
                          -₹{totalDeductions.toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-1">Net Pay</p>
                        <p className="text-xl font-bold text-success">
                          ₹{netPay.toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button type="submit" className="w-full h-10 text-sm" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "Saving..." : "Save Salary Record"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};
