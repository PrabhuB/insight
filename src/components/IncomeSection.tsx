import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { IncomeData } from "@/types/tax";
import { IndianRupee } from "lucide-react";

interface IncomeSectionProps {
  income: IncomeData;
  onChange: (income: IncomeData) => void;
}

export const IncomeSection = ({ income, onChange }: IncomeSectionProps) => {
  const handleChange = (field: keyof IncomeData, value: string) => {
    onChange({
      ...income,
      [field]: parseFloat(value) || 0,
    });
  };

  const totalIncome = income.basicSalary + income.hra + income.otherAllowances;

  return (
    <Card>
      <CardHeader className="bg-accent/50">
        <CardTitle className="flex items-center gap-2">
          <IndianRupee className="h-5 w-5 text-primary" />
          Income Details
        </CardTitle>
        <CardDescription>Enter your annual income components</CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="basicSalary">Basic Salary (Annual)</Label>
            <Input
              id="basicSalary"
              type="number"
              value={income.basicSalary || ""}
              onChange={(e) => handleChange("basicSalary", e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hra">HRA Received (Annual)</Label>
            <Input
              id="hra"
              type="number"
              value={income.hra || ""}
              onChange={(e) => handleChange("hra", e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="otherAllowances">Other Allowances (Annual)</Label>
            <Input
              id="otherAllowances"
              type="number"
              value={income.otherAllowances || ""}
              onChange={(e) => handleChange("otherAllowances", e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="professionalTax">Professional Tax (Annual)</Label>
            <Input
              id="professionalTax"
              type="number"
              value={income.professionalTax || ""}
              onChange={(e) => handleChange("professionalTax", e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rentPaid">Rent Paid (Annual)</Label>
            <Input
              id="rentPaid"
              type="number"
              value={income.rentPaid || ""}
              onChange={(e) => handleChange("rentPaid", e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <div className="pt-4 border-t border-border">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Total Gross Income:</span>
            <span className="text-xl font-bold text-primary">
              ₹{totalIncome.toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
