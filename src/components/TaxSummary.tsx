import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { IncomeData, DeductionEntry } from "@/types/tax";
import { TAX_SECTIONS } from "@/data/taxSections";
import { Badge } from "./ui/badge";

interface TaxSummaryProps {
  income: IncomeData;
  deductions: DeductionEntry[];
  regime: "old" | "new";
  onRegimeChange: (regime: "old" | "new") => void;
}

const calculateTax = (taxableIncome: number, regime: "old" | "new") => {
  let tax = 0;

  if (regime === "new") {
    // New Tax Regime Slabs (FY 2024-25)
    if (taxableIncome <= 300000) tax = 0;
    else if (taxableIncome <= 700000) tax = (taxableIncome - 300000) * 0.05;
    else if (taxableIncome <= 1000000) tax = 20000 + (taxableIncome - 700000) * 0.1;
    else if (taxableIncome <= 1200000) tax = 50000 + (taxableIncome - 1000000) * 0.15;
    else if (taxableIncome <= 1500000) tax = 80000 + (taxableIncome - 1200000) * 0.2;
    else tax = 140000 + (taxableIncome - 1500000) * 0.3;
  } else {
    // Old Tax Regime Slabs
    if (taxableIncome <= 250000) tax = 0;
    else if (taxableIncome <= 500000) tax = (taxableIncome - 250000) * 0.05;
    else if (taxableIncome <= 1000000) tax = 12500 + (taxableIncome - 500000) * 0.2;
    else tax = 112500 + (taxableIncome - 1000000) * 0.3;
  }

  // Add 4% cess
  return tax * 1.04;
};

const calculateHRA = (income: IncomeData) => {
  if (income.rentPaid === 0) return 0;
  
  const salary = income.basicSalary;
  const actual = income.hra;
  const rentExcess = income.rentPaid - (salary * 0.1);
  const metroPercent = salary * 0.5; // Assuming metro
  
  return Math.min(actual, rentExcess, metroPercent);
};

export const TaxSummary = ({ income, deductions, regime, onRegimeChange }: TaxSummaryProps) => {
  const totalIncome = income.basicSalary + income.hra + income.otherAllowances;
  const hraExemption = regime === "old" ? calculateHRA(income) : 0;
  
  const totalDeductions = deductions.reduce((sum, d) => {
    const section = TAX_SECTIONS.find(s => s.id === d.sectionId);
    const effectiveAmount = section && section.maxLimit > 0 
      ? Math.min(d.amount, section.maxLimit)
      : d.amount;
    return sum + effectiveAmount;
  }, 0);

  const standardDeduction = 50000;
  const professionalTax = income.professionalTax;
  
  const grossIncome = totalIncome - hraExemption;
  const deductionsApplied = regime === "old" ? totalDeductions : 0;
  const taxableIncome = Math.max(0, grossIncome - standardDeduction - professionalTax - deductionsApplied);
  
  const taxLiability = calculateTax(taxableIncome, regime);

  return (
    <Card className="sticky top-20">
      <CardHeader className="bg-primary/10">
        <CardTitle>Tax Summary</CardTitle>
        <CardDescription>Your estimated tax liability</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <Tabs value={regime} onValueChange={(v) => onRegimeChange(v as "old" | "new")}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="old">Old Regime</TabsTrigger>
            <TabsTrigger value="new">New Regime</TabsTrigger>
          </TabsList>
          
          <TabsContent value={regime} className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gross Income</span>
                <span className="font-medium">₹{totalIncome.toLocaleString("en-IN")}</span>
              </div>
              
              {hraExemption > 0 && (
                <div className="flex justify-between text-success">
                  <span>Less: HRA Exemption</span>
                  <span>-₹{hraExemption.toLocaleString("en-IN")}</span>
                </div>
              )}
              
              <div className="flex justify-between text-success">
                <span>Less: Standard Deduction</span>
                <span>-₹{standardDeduction.toLocaleString("en-IN")}</span>
              </div>
              
              {professionalTax > 0 && (
                <div className="flex justify-between text-success">
                  <span>Less: Professional Tax</span>
                  <span>-₹{professionalTax.toLocaleString("en-IN")}</span>
                </div>
              )}
              
              {regime === "old" && deductionsApplied > 0 && (
                <div className="flex justify-between text-success">
                  <span>Less: Total Deductions</span>
                  <span>-₹{deductionsApplied.toLocaleString("en-IN")}</span>
                </div>
              )}
              
              <div className="pt-3 border-t border-border flex justify-between">
                <span className="font-semibold">Taxable Income</span>
                <span className="font-semibold text-primary">
                  ₹{taxableIncome.toLocaleString("en-IN")}
                </span>
              </div>
              
              <div className="flex justify-between items-center pt-3 border-t border-border">
                <span className="font-semibold">Tax Liability</span>
                <span className="text-xl font-bold text-primary">
                  ₹{taxLiability.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </span>
              </div>
              
              {regime === "new" && totalDeductions > 0 && (
                <div className="mt-4 p-3 bg-warning/10 rounded-md">
                  <p className="text-xs text-warning-foreground">
                    <Badge variant="outline" className="mb-2">Note</Badge>
                    <br />
                    Most deductions not available in New Regime. Consider switching to Old Regime to claim ₹{totalDeductions.toLocaleString("en-IN")} in deductions.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
