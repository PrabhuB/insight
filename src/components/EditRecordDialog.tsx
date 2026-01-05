import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import type { SalaryRecord, Earning, Deduction } from "@/types/salary";

interface RecordWithDetails {
  id: string;
  user_id: string;
  organization: string | null;
  month: number;
  year: number;
  total_earnings: number;
  total_deductions: number;
  net_salary: number;
  gross_salary: number;
  created_at: string;
  updated_at: string;
  earnings: Earning[];
  deductions: Deduction[];
}

interface EditRecordDialogProps {
  record: RecordWithDetails;
  earnings: Earning[];
  deductions: Deduction[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const MONTHS = [
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

const MAX_AMOUNT = 100_000_000; // Upper bound to prevent extreme salary values

interface SimpleItem {
  id: string;
  category: string;
  amount: number;
}

export const EditRecordDialog = ({ record, earnings, deductions, open, onOpenChange, onSuccess }: EditRecordDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [organization, setOrganization] = useState(record.organization || "");
  const [month, setMonth] = useState(record.month);
  const [year, setYear] = useState(record.year);
  const [editedEarnings, setEditedEarnings] = useState<SimpleItem[]>(
    earnings.map((e) => ({ id: e.id, category: e.category, amount: e.amount })),
  );
  const [editedDeductions, setEditedDeductions] = useState<SimpleItem[]>(
    deductions.map((d) => ({ id: d.id, category: d.category, amount: d.amount })),
  );

  const handleSave = async () => {
    const monthNum = Number(month);
    const yearNum = Number(year);

    if (!Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) {
      toast.error("Please enter a valid month between 1 and 12.");
      return;
    }

    if (!Number.isFinite(yearNum) || yearNum < 2000 || yearNum > 2100) {
      toast.error("Please enter a valid year between 2000 and 2100.");
      return;
    }

    const invalidEarning = editedEarnings.find(
      (e) => !Number.isFinite(e.amount) || e.amount < 0 || e.amount > MAX_AMOUNT,
    );
    const invalidDeduction = editedDeductions.find(
      (d) => !Number.isFinite(d.amount) || d.amount < 0 || d.amount > MAX_AMOUNT,
    );

    if (invalidEarning || invalidDeduction) {
      toast.error("All earning and deduction amounts must be valid numbers between 0 and 100,000,000.");
      return;
    }

    setIsSubmitting(true);

    try {
      const totalEarnings = editedEarnings.reduce((sum, e) => sum + e.amount, 0);
      const totalDeductions = editedDeductions.reduce((sum, d) => sum + d.amount, 0);
      const netSalary = totalEarnings - totalDeductions;

      // Update salary record
      const { error: recordError } = await supabase
        .from("salary_records")
        .update({
          organization,
          month: monthNum,
          year: yearNum,
          total_earnings: totalEarnings,
          total_deductions: totalDeductions,
          net_salary: netSalary,
          gross_salary: totalEarnings,
        })
        .eq("id", record.id);

      if (recordError) throw recordError;

      // Delete existing earnings and deductions
      await supabase.from("earnings").delete().eq("salary_record_id", record.id);
      await supabase.from("deductions").delete().eq("salary_record_id", record.id);

      // Insert updated earnings
      if (editedEarnings.length > 0) {
        const { error: earningsError } = await supabase
          .from("earnings")
          .insert(
            editedEarnings.map((e) => ({
              salary_record_id: record.id,
              category: e.category,
              amount: e.amount,
            })),
          );
        if (earningsError) throw earningsError;
      }

      // Insert updated deductions
      if (editedDeductions.length > 0) {
        const { error: deductionsError } = await supabase
          .from("deductions")
          .insert(
            editedDeductions.map((d) => ({
              salary_record_id: record.id,
              category: d.category,
              amount: d.amount,
            })),
          );
        if (deductionsError) throw deductionsError;
      }

      toast.success("Record updated successfully!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Update error:", error);
      toast.error("Failed to update record");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Salary Record</DialogTitle>
          <DialogDescription>
            Update the details of this salary record
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Organization</Label>
              <Input
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={month.toString()} onValueChange={(val) => setMonth(parseInt(val))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, idx) => (
                    <SelectItem key={idx + 1} value={(idx + 1).toString()}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Earnings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold">Earnings</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setEditedEarnings([...editedEarnings, { 
                    id: crypto.randomUUID(), 
                    category: "", 
                    amount: 0 
                  }])}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-3">
                {editedEarnings.map((earning, idx) => (
                  <div key={earning.id} className="flex gap-2">
                    <Input
                      placeholder="Category"
                      value={earning.category}
                      onChange={(e) => {
                        const updated = [...editedEarnings];
                        updated[idx].category = e.target.value;
                        setEditedEarnings(updated);
                      }}
                    />
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={earning.amount}
                      onChange={(e) => {
                        const updated = [...editedEarnings];
                        updated[idx].amount = parseFloat(e.target.value) || 0;
                        setEditedEarnings(updated);
                      }}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditedEarnings(editedEarnings.filter((_, i) => i !== idx))}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Deductions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold">Deductions</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setEditedDeductions([...editedDeductions, { 
                    id: crypto.randomUUID(), 
                    category: "", 
                    amount: 0 
                  }])}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-3">
                {editedDeductions.map((deduction, idx) => (
                  <div key={deduction.id} className="flex gap-2">
                    <Input
                      placeholder="Category"
                      value={deduction.category}
                      onChange={(e) => {
                        const updated = [...editedDeductions];
                        updated[idx].category = e.target.value;
                        setEditedDeductions(updated);
                      }}
                    />
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={deduction.amount}
                      onChange={(e) => {
                        const updated = [...editedDeductions];
                        updated[idx].amount = parseFloat(e.target.value) || 0;
                        setEditedDeductions(updated);
                      }}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditedDeductions(editedDeductions.filter((_, i) => i !== idx))}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
