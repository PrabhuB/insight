import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { TaxSection } from "@/types/tax";
import { Badge } from "./ui/badge";
import { Info } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { useState } from "react";
import { Button } from "./ui/button";

interface DeductionCardProps {
  section: TaxSection;
  amount: number;
  onChange: (amount: number) => void;
}

export const DeductionCard = ({ section, amount, onChange }: DeductionCardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const percentage = section.maxLimit > 0 ? (amount / section.maxLimit) * 100 : 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{section.name}</CardTitle>
            <CardDescription className="text-sm mt-1">{section.description}</CardDescription>
          </div>
          {section.maxLimit > 0 && (
            <Badge variant="outline" className="ml-2">
              Max: ₹{section.maxLimit.toLocaleString("en-IN")}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor={section.id}>Amount Claimed</Label>
          <Input
            id={section.id}
            type="number"
            value={amount || ""}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            placeholder="0"
            max={section.maxLimit || undefined}
          />
          {section.maxLimit > 0 && amount > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Utilized</span>
                <span>{percentage.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    percentage > 100 ? "bg-destructive" : "bg-success"
                  }`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
              {amount > section.maxLimit && (
                <p className="text-xs text-destructive">Exceeds maximum limit</p>
              )}
            </div>
          )}
        </div>

        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full">
              <Info className="h-4 w-4 mr-2" />
              {isOpen ? "Hide" : "Show"} Details
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3">
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-primary" />
                Eligibility Criteria
              </h4>
              <ul className="text-xs space-y-1 text-muted-foreground">
                {section.criteria.map((criterion, idx) => (
                  <li key={idx} className="pl-3">
                    • {criterion}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-secondary" />
                Required Proofs
              </h4>
              <ul className="text-xs space-y-1 text-muted-foreground">
                {section.proofs.map((proof, idx) => (
                  <li key={idx} className="pl-3">
                    • {proof}
                  </li>
                ))}
              </ul>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};
