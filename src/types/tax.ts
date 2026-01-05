export interface TaxSection {
  id: string;
  name: string;
  maxLimit: number;
  description: string;
  criteria: string[];
  proofs: string[];
}

export interface DeductionEntry {
  sectionId: string;
  amount: number;
  description?: string;
}

export interface IncomeData {
  basicSalary: number;
  hra: number;
  otherAllowances: number;
  professionalTax: number;
  rentPaid: number;
}

export interface TaxData {
  income: IncomeData;
  deductions: DeductionEntry[];
  regime: 'old' | 'new';
}
