export interface SalaryRecord {
  id: string;
  user_id: string;
  month: number;
  year: number;
  organization?: string;
  payslip_url?: string;
  gross_salary: number;
  net_salary: number;
  total_earnings: number;
  total_deductions: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Earning {
  id: string;
  salary_record_id: string;
  category: string;
  amount: number;
  description?: string;
  created_at: string;
}

export interface Deduction {
  id: string;
  salary_record_id: string;
  category: string;
  amount: number;
  description?: string;
  created_at: string;
}

export interface SalaryRecordWithDetails extends SalaryRecord {
  earnings: Earning[];
  deductions: Deduction[];
}

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const EARNING_CATEGORIES = [
  "Basic Salary",
  "Basic Pay",
  "Base Salary",
  "Basic",
  "HRA",
  "Conveyance Allowance",
  "Conveyance Taxable",
  "Conveyance Non Taxable",
  "Medical Allowance",
  "Sundry Medical",
  "Special Allowance",
  "Location Premium Alllownace",
  "LTA",
  "Personal Allowance",
  "Miscellaneous",
  "City Allowance",
  "Performance Bonus",
  "Performance Pay",
  "Statutory Bonus",
  "Oncall Allowance",
  "National Holiday Pay",
  "Ovation Award",
  "Leave Encashment",
  "Vaccine Payout",
  "Shift Allowance",
  "Holiday Pay",
  "Citi Gratitude Bonus",
  "Award",
  "Share SIS Award",
  "Overtime",
  "Other Earnings",
];

export const DEDUCTION_CATEGORIES = [
  "Provident Fund (PF)",
  "Provident Fund",
  "Professional Tax",
  "Income Tax (TDS)",
  "Income Tax",
  "ESI",
  "Health Insurance Scheme Premium",
  "Hospitalisation Insurance",
  "Mediclaim Premium",
  "Mediclaim Insurance Dependent",
  "Citi Gratitude Deductions",
  "Insurance OPD Recovery",
  "Labour Welfare",
  "Labour Welfare Fund",
  "Transport Recovery",
  "TCS Welfar Trust",
  "Earlier Payout",
  "Principal Loan Amount",
  "Hospitalisation Imsurance",
  "VPCP Father",
  "VPCP Mother",
  "Life Insurance Topup",
  "VPCP Topup Father",
  "Voluntary PF",
  "VPC Father",
  "VPC Mother",
  "VPC Topup Father",
  "VPC Topup Mother",
  "Share SIS Award",
  "LOP",
  "Advance Deduction",
  "Other Deductions",
];
