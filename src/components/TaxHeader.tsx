import { Calculator, Download, Save } from "lucide-react";
import { Button } from "./ui/button";

interface TaxHeaderProps {
  onSave: () => void;
  onExport: () => void;
}

export const TaxHeader = ({ onSave, onExport }: TaxHeaderProps) => {
  return (
    <header className="border-b border-border bg-card sticky top-0 z-10 shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg">
              <Calculator className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Income Tax Planner</h1>
              <p className="text-sm text-muted-foreground">India - FY 2024-25</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={onSave} variant="outline" size="sm">
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button onClick={onExport} size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
