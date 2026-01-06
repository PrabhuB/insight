import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { MONTHS } from "@/types/salary";
import { toast } from "sonner";
import { FileUp, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { useAuth } from "@/hooks/useAuth";

interface ParsedRecord {
  organization: string;
  month: number;
  year: number;
  earnings: { category: string; amount: number }[];
  deductions: { category: string; amount: number }[];
  totalEarnings: number;
  totalDeductions: number;
  netSalary: number;
}

interface InvalidRow {
  sheetName: string;
  excelRowNumber: number;
  reason: string;
}

interface SheetPlan {
  sheetName: string;
  records: ParsedRecord[];
  skippedRows: number;
}

interface ImportPlan {
  sheets: SheetPlan[];
  totalRecordsToImport: number;
  totalSkippedRows: number;
  invalidRows: InvalidRow[];
}

interface ImportSummarySheet {
  sheetName: string;
  recordsImported: number;
  skippedRows: number;
}

interface ImportSummary {
  totalTemplates: number;
  totalRecords: number;
  totalSkippedRows: number;
  sheets: ImportSummarySheet[];
}

const ORG_EARNINGS: Record<string, string[]> = {
  TCS: [
    "Basic Salary",
    "BoB Kitty Allowance",
    "Conveyance Taxable",
    "Conveyance Non Taxable",
    "HRA",
    "Sundry Medical",
    "LTA",
    "Personal Allowance",
    "Miscellaneous",
    "City Allowance",
    "Performance Pay",
    "Leave Encashment",
  ],
  RBS: [
    "Basic Pay",
    "Supplementary Allowance",
    "HRA",
    "Statutory Bonus",
    "Oncall Allowance",
    "National Holiday Pay",
    "Ovation Award",
    "Leave Encashment",
    "Vaccine Payout",
    "Shift Allowance",
  ],
  CITI: [
    "Basic",
    "HRA",
    "Special Allowance",
    "Location Premium Alllownace",
    "Holiday Pay",
    "Citi Gratitude Bonus",
    "Award",
  ],
  NATWEST: [
    "Base Salary",
    "Supplementary Allowance",
    "HRA",
    "Shift Allowance",
    "Oncall Allowance",
    "Bonus",
    "Telephone Unclaimed",
    "Compulsory Holiday Pay",
    "Share SIS Award",
  ],
};

const ORG_DEDUCTIONS: Record<string, string[]> = {
  TCS: [
    "Provident Fund",
    "Income Tax",
    "Health Insurance Scheme Premium",
    "Professional Tax",
    "Labour Welfare",
    "Transport Recovery",
    "TCS Welfar Trust",
    "Earlier Payout",
    "Principal Loan Amount",
  ],
  RBS: [
    "Income Tax",
    "Provident Fund",
    "Professional Tax",
    "Hospitalisation Insurance",
    "VPCP Father",
    "VPCP Mother",
    "Life Insurance Topup",
    "VPCP Topup Father",
    "Voluntary PF",
    "Labour Welfare Fund",
  ],
  CITI: [
    "Income Tax",
    "Provident Fund",
    "Mediclaim Premium",
    "Mediclaim Insurance Dependent",
    "Professional Tax",
    "Citi Gratitude Deductions",
    "Insurance OPD Recovery",
  ],
  NATWEST: [
    "Income Tax",
    "Provident Fund",
    "Professional Tax",
    "Hospitalisation Insurance",
    "VPC Father",
    "VPC Mother",
    "VPC Topup Father",
    "VPC Topup Mother",
    "Labour Welfare Fund",
    "Share SIS Award",
  ],
};

const parseMonthYear = (monthYearStr: string): { month: number; year: number } | null => {
  const parts = monthYearStr.trim().split(" ");
  if (parts.length !== 2) return null;

  const monthMap: { [key: string]: number } = {
    JAN: 1,
    FEB: 2,
    MAR: 3,
    APR: 4,
    MAY: 5,
    JUN: 6,
    JUL: 7,
    AUG: 8,
    SEP: 9,
    OCT: 10,
    NOV: 11,
    DEC: 12,
  };

  const month = monthMap[parts[0].toUpperCase()];
  const year = parseInt(parts[1]);

  if (!month || Number.isNaN(year)) return null;
  return { month, year };
};

const processSheet = (
  sheet: XLSX.WorkSheet,
  organization: string,
): { records: ParsedRecord[]; skippedRows: number; invalidRows: InvalidRow[] } => {
  const data = XLSX.utils.sheet_to_json(sheet);
  if (data.length === 0) return { records: [], skippedRows: 0, invalidRows: [] };

  const records: ParsedRecord[] = [];
  const invalidRows: InvalidRow[] = [];
  let skippedRows = 0;

  const firstRow: any = data[0];
  const headers = Object.keys(firstRow);

  const monthYearHeader = headers.find((h) => h.toLowerCase().includes("month") && h.toLowerCase().includes("year")) ?? headers[0];

  const TOTAL_EARNINGS_HEADER = "Total Earnings";
  const TOTAL_DEDUCTIONS_HEADER = "Total Deductions";
  const NET_SALARY_HEADER = "Net Salary";

  const RESERVED_HEADERS = new Set<string>([
    monthYearHeader,
    TOTAL_EARNINGS_HEADER,
    TOTAL_DEDUCTIONS_HEADER,
    NET_SALARY_HEADER,
  ]);

  const orgEarnings = ORG_EARNINGS[organization] ?? [];
  const orgDeductions = ORG_DEDUCTIONS[organization] ?? [];

  const isDeductionHeader = (header: string): boolean => {
    const h = header.toLowerCase();

    const deductionKeywords = [
      "tax",
      "pf",
      "provident",
      "esi",
      "insurance",
      "professional",
      "labour",
      "welfare",
      "recovery",
      "loan",
      "tcs",
      "earlier payout",
      "principal",
    ];

    return deductionKeywords.some((kw) => h.includes(kw));
  };

  for (let i = 0; i < data.length; i++) {
    const row: any = data[i];
    const monthYearStr = row[monthYearHeader];
    const excelRowNumber = i + 2;

    if (!monthYearStr) {
      skippedRows++;
      invalidRows.push({
        sheetName: organization,
        excelRowNumber,
        reason: "Missing Month/Year value",
      });
      continue;
    }

    const parsed = parseMonthYear(String(monthYearStr));
    if (!parsed) {
      skippedRows++;
      invalidRows.push({
        sheetName: organization,
        excelRowNumber,
        reason: `Invalid Month/Year format: ${String(monthYearStr)}`,
      });
      continue;
    }

    const earnings: { category: string; amount: number }[] = [];
    const deductions: { category: string; amount: number }[] = [];

    let earningsTotal = 0;
    let deductionsTotal = 0;
    let netSalary = 0;

    for (const headerKey of headers) {
      const val = row[headerKey];

      let numVal: number | null = null;
      if (typeof val === "number") {
        numVal = val;
      } else if (typeof val === "string") {
        const cleaned = val.replace(/[^0-9.+-]/g, "");
        if (cleaned.length > 0) {
          const parsedNum = parseFloat(cleaned);
          if (!Number.isNaN(parsedNum)) {
            numVal = parsedNum;
          }
        }
      }

      if (headerKey === TOTAL_EARNINGS_HEADER && numVal !== null) {
        earningsTotal = numVal;
        continue;
      }

      if (headerKey === TOTAL_DEDUCTIONS_HEADER && numVal !== null) {
        deductionsTotal = numVal;
        continue;
      }

      if (headerKey === NET_SALARY_HEADER && numVal !== null) {
        netSalary = numVal;
        continue;
      }

      if (RESERVED_HEADERS.has(headerKey) || numVal === null || numVal === 0) {
        continue;
      }

      if (orgEarnings.includes(headerKey)) {
        earnings.push({ category: headerKey, amount: numVal });
        continue;
      }

      if (orgDeductions.includes(headerKey)) {
        deductions.push({ category: headerKey, amount: numVal });
        continue;
      }

      if (isDeductionHeader(headerKey)) {
        deductions.push({ category: headerKey, amount: numVal });
      } else {
        earnings.push({ category: headerKey, amount: numVal });
      }
    }

    records.push({
      organization,
      month: parsed.month,
      year: parsed.year,
      earnings,
      deductions,
      totalEarnings: earningsTotal,
      totalDeductions: deductionsTotal,
      netSalary,
    });
  }

  return { records, skippedRows, invalidRows };
};

export const BulkImport = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [processedRecords, setProcessedRecords] = useState(0);
  const [importPlan, setImportPlan] = useState<ImportPlan | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isBackupExporting, setIsBackupExporting] = useState(false);
  const [isBackupImporting, setIsBackupImporting] = useState(false);
  const [backupImportTotal, setBackupImportTotal] = useState(0);
  const [backupImportProcessed, setBackupImportProcessed] = useState(0);
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);
  const [exportYearFrom, setExportYearFrom] = useState<string>("");
  const [exportYearTo, setExportYearTo] = useState<string>("");
  const [includeRareEarningCategories, setIncludeRareEarningCategories] = useState(true);
  const [includeRareDeductionCategories, setIncludeRareDeductionCategories] = useState(true);
  const [backupConfirmOpen, setBackupConfirmOpen] = useState(false);
  const [pendingBackupData, setPendingBackupData] = useState<any | null>(null);
  const [pendingBackupCounts, setPendingBackupCounts] = useState<{
    totalTemplates: number;
    totalSalaryRecords: number;
    totalEmploymentHistory: number;
    totalProfileEntries: number;
    totalBudgetHistory: number;
    totalImportItems: number;
  } | null>(null);
  const [backupImportSummary, setBackupImportSummary] = useState<{
    totalTemplates: number;
    totalSalaryRecords: number;
    totalEmploymentHistory: number;
    totalProfileEntries: number;
    totalBudgetHistory: number;
  } | null>(null);

  const MAX_AMOUNT = 100_000_000; // Upper bound to prevent extreme salary values
  const MIN_YEAR = 2000;
  const MAX_YEAR = 2100;

  if (!user) {
    return null;
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setIsProcessing(true);
    setProcessedRecords(0);
    setTotalRecords(0);
    setImportSummary(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);

      const sheets: SheetPlan[] = [];
      let totalRecordsToImport = 0;
      let totalSkippedRows = 0;
      let invalidRows: InvalidRow[] = [];

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const { records, skippedRows, invalidRows: sheetInvalid } = processSheet(sheet, sheetName);

        if (records.length === 0 && sheetInvalid.length === 0) continue;

        sheets.push({ sheetName, records, skippedRows });
        totalRecordsToImport += records.length;
        totalSkippedRows += skippedRows;
        invalidRows = invalidRows.concat(sheetInvalid);
      }

      if (sheets.length === 0) {
        toast.error("No data found in the uploaded file.");
        setIsProcessing(false);
        return;
      }

      if (totalRecordsToImport === 0) {
        setImportSummary({
          totalTemplates: 0,
          totalRecords: 0,
          totalSkippedRows,
          sheets: sheets.map(({ sheetName, records, skippedRows }) => ({
            sheetName,
            recordsImported: records.length,
            skippedRows,
          })),
        });
        setImportPlan({ sheets, totalRecordsToImport, totalSkippedRows, invalidRows });
        setShowConfirm(true);
        setIsProcessing(false);
        return;
      }

      setTotalRecords(totalRecordsToImport);
      setImportPlan({ sheets, totalRecordsToImport, totalSkippedRows, invalidRows });
      setShowConfirm(true);
      setIsProcessing(false);
    } catch (error: any) {
      console.error("Error reading Excel:", error);
      toast.error(`Failed to read Excel file: ${error.message ?? "Unknown error"}`);
      setIsProcessing(false);
    }
  };

  const performImport = async () => {
    if (!importPlan || !user) return;

    setIsProcessing(true);
    setShowConfirm(false);
    setProcessedRecords(0);

    const { sheets, totalRecordsToImport, totalSkippedRows } = importPlan;
    setTotalRecords(totalRecordsToImport);

    let totalRecordsImported = 0;
    let totalTemplates = 0;

      try {
        for (const { sheetName, records } of sheets) {
          if (records.length === 0) continue;

          const allEarningsCategories = new Set<string>();
          const allDeductionsCategories = new Set<string>();

          records.forEach((record) => {
            record.earnings.forEach((e) => allEarningsCategories.add(e.category));
            record.deductions.forEach((d) => allDeductionsCategories.add(d.category));
          });

          const { data: existingTemplate, error: existingTemplateError } = await supabase
            .from("organization_templates")
            .select("*")
            .eq("user_id", user.id)
            .eq("name", sheetName)
            .maybeSingle();

          if (existingTemplateError) throw existingTemplateError;

          let template = existingTemplate;

          if (!template) {
            const { data: newTemplate, error: templateError } = await supabase
              .from("organization_templates")
              .insert({ name: sheetName, user_id: user.id })
              .select()
              .single();

            if (templateError) throw templateError;
            template = newTemplate;
          } else {
            const { error: deleteEarningsError } = await supabase
              .from("template_earnings")
              .delete()
              .eq("template_id", template.id);
            if (deleteEarningsError) throw deleteEarningsError;

            const { error: deleteDeductionsError } = await supabase
              .from("template_deductions")
              .delete()
              .eq("template_id", template.id);
            if (deleteDeductionsError) throw deleteDeductionsError;
          }

          totalTemplates++;

          const earningsInserts = Array.from(allEarningsCategories).map((category) => ({
            template_id: template.id,
            category,
          }));

          if (earningsInserts.length > 0) {
            const { error: earningsError } = await supabase.from("template_earnings").insert(earningsInserts);
            if (earningsError) throw earningsError;
          }

          const deductionsInserts = Array.from(allDeductionsCategories).map((category) => ({
            template_id: template.id,
            category,
          }));

          if (deductionsInserts.length > 0) {
            const { error: deductionsError } = await supabase.from("template_deductions").insert(deductionsInserts);
            if (deductionsError) throw deductionsError;
          }

          for (const record of records) {
            const { month, year, totalEarnings, totalDeductions, netSalary } = record;

            if (
              !Number.isFinite(month) ||
              month < 1 ||
              month > 12 ||
              !Number.isFinite(year) ||
              year < MIN_YEAR ||
              year > MAX_YEAR
            ) {
              console.warn("Skipping record with invalid month/year", { sheetName, record });
              continue;
            }

            if (
              !Number.isFinite(totalEarnings) ||
              !Number.isFinite(totalDeductions) ||
              !Number.isFinite(netSalary) ||
              totalEarnings < 0 ||
              totalDeductions < 0 ||
              totalEarnings > MAX_AMOUNT ||
              totalDeductions > MAX_AMOUNT
            ) {
              console.warn("Skipping record with invalid totals", { sheetName, record });
              continue;
            }

            const hasInvalidLineItem =
              record.earnings.some(
                (e) => !Number.isFinite(e.amount) || e.amount < 0 || e.amount > MAX_AMOUNT,
              ) ||
              record.deductions.some(
                (d) => !Number.isFinite(d.amount) || d.amount < 0 || d.amount > MAX_AMOUNT,
              );

            if (hasInvalidLineItem) {
              console.warn("Skipping record with invalid earning/deduction item", { sheetName, record });
              continue;
            }

            const { data: salaryRecord, error: recordError } = await supabase
              .from("salary_records")
              .upsert(
                {
                  user_id: user.id,
                  organization: record.organization,
                  month,
                  year,
                  total_earnings: totalEarnings,
                  total_deductions: totalDeductions,
                  net_salary: netSalary,
                  gross_salary: totalEarnings,
                },
                { onConflict: "user_id,month,year" },
              )
              .select()
              .single();

            if (recordError) throw recordError;
            totalRecordsImported++;
            setProcessedRecords((prev) => prev + 1);

            if (record.earnings.length > 0) {
              const { error: earningsError } = await supabase.from("earnings").insert(
                record.earnings.map((e) => ({
                  salary_record_id: salaryRecord.id,
                  category: e.category,
                  amount: e.amount,
                })),
              );
              if (earningsError) throw earningsError;
            }

            if (record.deductions.length > 0) {
              const { error: deductionsError } = await supabase.from("deductions").insert(
                record.deductions.map((d) => ({
                  salary_record_id: salaryRecord.id,
                  category: d.category,
                  amount: d.amount,
                })),
              );
              if (deductionsError) throw deductionsError;
            }
          }
        }

        setImportSummary({
          totalTemplates,
          totalRecords: totalRecordsImported,
          totalSkippedRows,
          sheets: sheetsFromPlan(importPlan),
        });

        toast.success(`Imported ${totalTemplates} templates and ${totalRecordsImported} salary records!`);
      } catch (error: any) {
        console.error("Import error:", error);
        toast.error(`Failed to import: ${error.message ?? "Unknown error"}`);
      } finally {
        setIsProcessing(false);
      }
    };

  const sheetsFromPlan = (plan: ImportPlan): ImportSummarySheet[] =>
    plan.sheets.map(({ sheetName, records, skippedRows }) => ({
      sheetName,
      recordsImported: records.length,
      skippedRows,
    }));

  const invalidRowsPreview = importPlan?.invalidRows.slice(0, 20) ?? [];

  const handleExportToExcel = async () => {
    if (!user) return;

    const RARE_CATEGORY_THRESHOLD = 3;

    const normalizeOrgName = (rawOrg: string | null): string => {
      const trimmed = (rawOrg || "").trim();
      if (!trimmed) return "Not specified";

      const upper = trimmed.toUpperCase();

      if (upper.includes("TATA CONSULTANCY") || upper === "TCS") {
        return "TCS";
      }

      if (upper.includes("NATWEST") || upper.includes("NATIONAL WESTMINSTER")) {
        return "NATWEST";
      }

      if (upper.includes("RBS") || upper.includes("ROYAL BANK OF SCOTLAND")) {
        return "RBS";
      }

      if (upper.includes("CITI") || upper.includes("CITIBANK")) {
        return "CITI";
      }

      return trimmed;
    };

    try {
      setIsExporting(true);

      const { data, error } = await supabase
        .from("salary_records")
        .select(
          `id, month, year, organization, total_earnings, total_deductions, net_salary,
           earnings (category, amount),
           deductions (category, amount)`
        )
        .eq("user_id", user.id);

      if (error) throw error;

      const salaryRecords = (data || []) as any[];
      if (salaryRecords.length === 0) {
        toast.error("No salary records available to export");
        return;
      }

      let filteredRecords = salaryRecords;

      if (exportYearFrom) {
        const fromYear = Number(exportYearFrom);
        filteredRecords = filteredRecords.filter((record) => record.year >= fromYear);
      }

      if (exportYearTo) {
        const toYear = Number(exportYearTo);
        filteredRecords = filteredRecords.filter((record) => record.year <= toYear);
      }

      if (filteredRecords.length === 0) {
        toast.error("No salary records found for the selected year range");
        return;
      }

      type OrgExportData = {
        records: any[];
        earningCategories: Set<string>;
        deductionCategories: Set<string>;
        earningCounts: Map<string, number>;
        deductionCounts: Map<string, number>;
      };

      const orgMap = new Map<string, OrgExportData>();

      filteredRecords.forEach((record) => {
        const orgName = normalizeOrgName(record.organization || "Not specified");
        if (!orgMap.has(orgName)) {
          orgMap.set(orgName, {
            records: [],
            earningCategories: new Set<string>(),
            deductionCategories: new Set<string>(),
            earningCounts: new Map<string, number>(),
            deductionCounts: new Map<string, number>(),
          });
        }

        const orgData = orgMap.get(orgName)!;
        orgData.records.push(record);

        (record.earnings || []).forEach((e: any) => {
          orgData.earningCategories.add(e.category);
          orgData.earningCounts.set(e.category, (orgData.earningCounts.get(e.category) || 0) + 1);
        });
        (record.deductions || []).forEach((d: any) => {
          orgData.deductionCategories.add(d.category);
          orgData.deductionCounts.set(d.category, (orgData.deductionCounts.get(d.category) || 0) + 1);
        });
      });

      const workbook = XLSX.utils.book_new();

      orgMap.forEach((orgData, orgName) => {
        let earningCategories = Array.from(orgData.earningCategories).sort();
        let deductionCategories = Array.from(orgData.deductionCategories).sort();

        if (!includeRareEarningCategories) {
          earningCategories = earningCategories.filter(
            (cat) => (orgData.earningCounts.get(cat) || 0) >= RARE_CATEGORY_THRESHOLD,
          );
        }

        if (!includeRareDeductionCategories) {
          deductionCategories = deductionCategories.filter(
            (cat) => (orgData.deductionCounts.get(cat) || 0) >= RARE_CATEGORY_THRESHOLD,
          );
        }

        const headers: (string | number)[] = [
          "Month Year",
          ...earningCategories,
          ...deductionCategories,
          "Total Earnings",
          "Total Deductions",
          "Net Pay",
        ];

        const rows = orgData.records
          .sort((a, b) => {
            if (a.year === b.year) return a.month - b.month;
            return a.year - b.year;
          })
          .map((record) => {
            const monthLabel = `${MONTHS[record.month - 1].slice(0, 3).toUpperCase()} ${record.year}`;

            const earningValues = earningCategories.map((cat) => {
              const entry = (record.earnings || []).find((e: any) => e.category === cat);
              return entry ? Number(entry.amount) : 0;
            });

            const deductionValues = deductionCategories.map((cat) => {
              const entry = (record.deductions || []).find((d: any) => d.category === cat);
              return entry ? Number(entry.amount) : 0;
            });

            return [
              monthLabel,
              ...earningValues,
              ...deductionValues,
              Number(record.total_earnings) || 0,
              Number(record.total_deductions) || 0,
              Number(record.net_salary) || 0,
            ];
          });

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const safeSheetName = orgName.substring(0, 31) || "Organisation";
        XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
      });

      XLSX.writeFile(workbook, "salary-data-export.xlsx");
      toast.success("Salary data exported successfully");
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error(error.message || "Failed to export salary data");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportBackup = async () => {
    if (!user) return;

    try {
      setIsBackupExporting(true);

      const [salaryResult, templatesResult, employmentResult, profileResult, budgetResult] = await Promise.all([
        supabase
          .from("salary_records")
          .select(
            `id, month, year, organization, total_earnings, total_deductions, net_salary, gross_salary, notes, payslip_url,
             earnings (*),
             deductions (*)`
          )
          .eq("user_id", user.id),
        supabase
          .from("organization_templates")
          .select(`id, name, created_at, updated_at,
             template_earnings (*),
             template_deductions (*)`)
          .eq("user_id", user.id),
        supabase.from("employment_history").select("*").eq("user_id", user.id),
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("budget_history").select("*").eq("user_id", user.id),
      ]);

      if (salaryResult.error) throw salaryResult.error;
      if (templatesResult.error) throw templatesResult.error;
      if (employmentResult.error) throw employmentResult.error;
      if (profileResult.error) throw profileResult.error;
      if (budgetResult.error) throw budgetResult.error;

      const backupPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        userId: user.id,
        salaryRecords: salaryResult.data ?? [],
        organizationTemplates: templatesResult.data ?? [],
        employmentHistory: employmentResult.data ?? [],
        profile: profileResult.data ?? null,
        budgetHistory: budgetResult.data ?? [],
      };

      const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "salary-tracker-backup.json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Backup exported successfully");
    } catch (error: any) {
      console.error("Backup export error:", error);
      toast.error(error.message || "Failed to export backup");
    } finally {
      setIsBackupExporting(false);
    }
  };

  const handleImportBackupFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

    try {
      if (file.size > MAX_FILE_SIZE) {
        throw new Error("Backup file is too large (max 10MB)");
      }

      const text = await file.text();

      let rawData: unknown;
      try {
        rawData = JSON.parse(text);
      } catch {
        throw new Error("Invalid backup file format");
      }

      if (!rawData || typeof rawData !== "object" || (rawData as any).version !== 1) {
        throw new Error("Invalid backup file format");
      }

      const data: any = rawData;

      const totalTemplates = Array.isArray(data.organizationTemplates) ? data.organizationTemplates.length : 0;
      const totalSalaryRecords = Array.isArray(data.salaryRecords) ? data.salaryRecords.length : 0;
      const totalEmploymentHistory = Array.isArray(data.employmentHistory) ? data.employmentHistory.length : 0;
      const totalProfileEntries = data.profile && typeof data.profile === "object" ? 1 : 0;
      const totalBudgetHistory = Array.isArray(data.budgetHistory) ? data.budgetHistory.length : 0;
      const totalImportItems =
        totalTemplates + totalSalaryRecords + totalEmploymentHistory + totalProfileEntries + totalBudgetHistory;

      setPendingBackupData(data);
      setPendingBackupCounts({
        totalTemplates,
        totalSalaryRecords,
        totalEmploymentHistory,
        totalProfileEntries,
        totalBudgetHistory,
        totalImportItems,
      });
      setBackupImportSummary(null);
      setBackupConfirmOpen(true);
    } catch (error: any) {
      console.error("Backup file parse error:", error);
      toast.error(error.message || "Failed to read backup file");
      if (backupFileInputRef.current) {
        backupFileInputRef.current.value = "";
      }
    }
  };

  const performBackupImport = async () => {
    if (!user || !pendingBackupData || !pendingBackupCounts) return;

    try {
      setIsBackupImporting(true);
      setBackupImportTotal(pendingBackupCounts.totalImportItems);
      setBackupImportProcessed(0);
      setBackupConfirmOpen(false);

      const data = pendingBackupData;

      // Clear existing user data before restoring from backup
      const { error: wipeError } = await supabase.rpc("wipe_all_salary_data");
      if (wipeError) throw wipeError;

      const { error: budgetDeleteError } = await supabase.from("budget_history").delete().eq("user_id", user.id);
      if (budgetDeleteError) throw budgetDeleteError;

      // Restore templates
      if (Array.isArray(data.organizationTemplates)) {
        for (const template of data.organizationTemplates) {
          const { id, name, template_earnings, template_deductions } = template;

          const { data: insertedTemplate, error: templateError } = await supabase
            .from("organization_templates")
            .insert({
              id,
              name,
              user_id: user.id,
            })
            .select()
            .single();

          if (templateError) throw templateError;

          if (Array.isArray(template_earnings) && template_earnings.length > 0) {
            const { error: earningsError } = await supabase.from("template_earnings").insert(
              template_earnings.map((e: any) => ({
                template_id: insertedTemplate.id,
                category: e.category,
              })),
            );
            if (earningsError) throw earningsError;
          }

          if (Array.isArray(template_deductions) && template_deductions.length > 0) {
            const { error: deductionsError } = await supabase.from("template_deductions").insert(
              template_deductions.map((d: any) => ({
                template_id: insertedTemplate.id,
                category: d.category,
              })),
            );
            if (deductionsError) throw deductionsError;
          }

          setBackupImportProcessed((prev) => prev + 1);
        }
      }

      // Restore salary records with earnings and deductions
      if (Array.isArray(data.salaryRecords)) {
        for (const record of data.salaryRecords) {
          const {
            month,
            year,
            organization,
            total_earnings,
            total_deductions,
            net_salary,
            gross_salary,
            notes,
            payslip_url,
            earnings,
            deductions,
          } = record;

          const { data: insertedRecord, error: recordError } = await supabase
            .from("salary_records")
            .insert({
              user_id: user.id,
              month,
              year,
              organization,
              total_earnings,
              total_deductions,
              net_salary,
              gross_salary,
              notes,
              payslip_url,
            })
            .select()
            .single();

          if (recordError) throw recordError;

          if (Array.isArray(earnings) && earnings.length > 0) {
            const { error: earningsError } = await supabase.from("earnings").insert(
              earnings.map((e: any) => ({
                salary_record_id: insertedRecord.id,
                category: e.category,
                amount: e.amount,
              })),
            );
            if (earningsError) throw earningsError;
          }

          if (Array.isArray(deductions) && deductions.length > 0) {
            const { error: deductionsError } = await supabase.from("deductions").insert(
              deductions.map((d: any) => ({
                salary_record_id: insertedRecord.id,
                category: d.category,
                amount: d.amount,
              })),
            );
            if (deductionsError) throw deductionsError;
          }

          setBackupImportProcessed((prev) => prev + 1);
        }
      }

      // Restore employment history
      if (Array.isArray(data.employmentHistory)) {
        for (const item of data.employmentHistory) {
          const { joining_date, leaving_date, organization, notes } = item;
          const { error: employmentError } = await supabase.from("employment_history").insert({
            user_id: user.id,
            joining_date,
            leaving_date,
            organization,
            notes,
          });
          if (employmentError) throw employmentError;

          setBackupImportProcessed((prev) => prev + 1);
        }
      }

      // Restore budget history
      if (Array.isArray(data.budgetHistory)) {
        for (const entry of data.budgetHistory) {
          const { month, year, net_income, total_allocated, remaining, categories, saved_at } = entry;
          const { error: budgetError } = await supabase.from("budget_history").insert({
            user_id: user.id,
            month,
            year,
            net_income,
            total_allocated,
            remaining,
            categories,
            saved_at,
          });
          if (budgetError) throw budgetError;

          setBackupImportProcessed((prev) => prev + 1);
        }
      }

      // Restore profile (upsert)
      if (data.profile && typeof data.profile === "object") {
        const { full_name, job_title, location, bio } = data.profile;
        const { error: profileError } = await supabase.from("profiles").upsert({
          id: user.id,
          full_name,
          job_title,
          location,
          bio,
        });
        if (profileError) throw profileError;

        setBackupImportProcessed((prev) => prev + 1);
      }

      setBackupImportSummary({
        totalTemplates: pendingBackupCounts.totalTemplates,
        totalSalaryRecords: pendingBackupCounts.totalSalaryRecords,
        totalEmploymentHistory: pendingBackupCounts.totalEmploymentHistory,
        totalProfileEntries: pendingBackupCounts.totalProfileEntries,
        totalBudgetHistory: pendingBackupCounts.totalBudgetHistory,
      });

      toast.success("Backup imported successfully");
    } catch (error: any) {
      console.error("Backup import error:", error);
      toast.error(error.message || "Failed to import backup");
    } finally {
      setIsBackupImporting(false);
      setBackupImportTotal(0);
      setBackupImportProcessed(0);
      setPendingBackupData(null);
      setPendingBackupCounts(null);
      if (backupFileInputRef.current) {
        backupFileInputRef.current.value = "";
      }
    }
  };
  return (
    <>
      <Card className="border-primary/20 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="w-5 h-5 text-primary" />
            Import from Excel
          </CardTitle>
          <CardDescription>
            Upload an Excel file to import multiple salary records and create templates automatically
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-upload">Excel File</Label>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <Button
                type="button"
                variant="default"
                className="px-4 h-9 text-sm font-semibold shadow-md"
                disabled={isProcessing}
                onClick={() => fileInputRef.current?.click()}
              >
                Choose File
              </Button>
              <span className="text-xs text-muted-foreground truncate max-w-xs">
                {selectedFileName || "No file selected"}
              </span>
            </div>
            <Input
              ref={fileInputRef}
              id="file-upload"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              disabled={isProcessing}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground">
              Each sheet should represent one organization with salary data
            </p>
          </div>

          {isProcessing && (
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing file and importing records...</span>
              </div>
              {totalRecords > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>
                      {processedRecords} / {totalRecords} records imported
                    </span>
                    <span>{Math.round((processedRecords / Math.max(totalRecords, 1)) * 100)}%</span>
                  </div>
                  <Progress value={totalRecords ? (processedRecords / totalRecords) * 100 : 0} />
                </div>
              )}
            </div>
          )}

          {importSummary && !isProcessing && (
            <div className="mt-4 space-y-3 border-t pt-4 text-sm">
              <div className="font-medium">Import summary</div>
              <div className="text-muted-foreground space-y-1">
                <p>
                  Templates created: <span className="font-semibold">{importSummary.totalTemplates}</span>
                </p>
                <p>
                  Records imported: <span className="font-semibold">{importSummary.totalRecords}</span>
                </p>
                {importSummary.totalSkippedRows > 0 && (
                  <p>
                    Rows skipped (missing or invalid Month/Year):{" "}
                    <span className="font-semibold">{importSummary.totalSkippedRows}</span>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                {importSummary.sheets.map((sheet) => (
                  <div
                    key={sheet.sheetName}
                    className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2"
                  >
                    <div className="font-medium">{sheet.sheetName}</div>
                    <div className="text-xs text-muted-foreground space-x-3">
                      <span>{sheet.recordsImported} records</span>
                      {sheet.skippedRows > 0 && <span>{sheet.skippedRows} skipped</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/20 shadow-lg mt-6">
        <CardHeader>
          <CardTitle>Export to Excel</CardTitle>
          <CardDescription>
            Export all your salary data. Each organisation will be exported to its own sheet with only its
            specific earnings and deductions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Year range (optional)</Label>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Input
                  type="number"
                  min={1900}
                  max={9999}
                  placeholder="From"
                  value={exportYearFrom}
                  onChange={(e) => setExportYearFrom(e.target.value)}
                />
                <span>to</span>
                <Input
                  type="number"
                  min={1900}
                  max={9999}
                  placeholder="To"
                  value={exportYearTo}
                  onChange={(e) => setExportYearTo(e.target.value)}
                />
              </div>
            </div>
          </div>
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={handleExportToExcel}
            disabled={isExporting}
          >
            {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Export to Excel
          </Button>
        </CardContent>
      </Card>

      <Card className="border-primary/20 shadow-lg mt-6">
        <CardHeader>
          <CardTitle>Backup &amp; Restore</CardTitle>
          <CardDescription>
            Export a full backup of your salary data and settings, or restore from a previous backup file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={handleExportBackup}
              disabled={isBackupExporting || isBackupImporting}
            >
              {isBackupExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Export Backup
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => backupFileInputRef.current?.click()}
              disabled={isBackupExporting || isBackupImporting}
            >
              {isBackupImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import Backup
            </Button>
            <Input
              ref={backupFileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImportBackupFile}
            />
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Importing a backup will <span className="font-semibold text-destructive">permanently wipe</span> all
            existing salary records, templates, employment history, budget plans, and related data for this
            account before restoring from the file.
          </p>

          {(isBackupExporting || isBackupImporting) && (
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  {isBackupExporting
                    ? "Exporting backup..."
                    : `Importing backup... ${
                        backupImportTotal
                          ? Math.round((backupImportProcessed / Math.max(backupImportTotal, 1)) * 100)
                          : 0
                      }%`}
                </span>
              </div>
              <Progress
                value={
                  isBackupImporting && backupImportTotal
                    ? (backupImportProcessed / Math.max(backupImportTotal, 1)) * 100
                    : 50
                }
              />
            </div>
          )}

          {backupImportSummary && !isBackupImporting && (
            <div className="mt-2 space-y-2 border-t pt-3 text-xs sm:text-sm">
              <div className="font-medium">Last backup import summary</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 text-muted-foreground">
                <span>
                  Templates restored: <span className="font-semibold">{backupImportSummary.totalTemplates}</span>
                </span>
                <span>
                  Salary records restored: <span className="font-semibold">{backupImportSummary.totalSalaryRecords}</span>
                </span>
                <span>
                  Employment entries restored: <span className="font-semibold">{backupImportSummary.totalEmploymentHistory}</span>
                </span>
                <span>
                  Budget snapshots restored: <span className="font-semibold">{backupImportSummary.totalBudgetHistory}</span>
                </span>
                <span>
                  Profile restored: <span className="font-semibold">{backupImportSummary.totalProfileEntries}</span>
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={backupConfirmOpen} onOpenChange={setBackupConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm backup import</AlertDialogTitle>
            <AlertDialogDescription>
              This will <span className="font-semibold">erase all existing data</span> in your account, including
              salary records, templates, employment history, and budget history, before restoring from the selected
              backup file. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingBackupCounts && (
            <div className="mt-2 text-xs sm:text-sm text-muted-foreground space-y-1">
              <p>If you continue, the following items will be restored from the backup:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>Templates: {pendingBackupCounts.totalTemplates}</li>
                <li>Salary records: {pendingBackupCounts.totalSalaryRecords}</li>
                <li>Employment entries: {pendingBackupCounts.totalEmploymentHistory}</li>
                <li>Budget snapshots: {pendingBackupCounts.totalBudgetHistory}</li>
                <li>Profile: {pendingBackupCounts.totalProfileEntries}</li>
              </ul>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={performBackupImport}>Yes, wipe &amp; restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="border-primary/20 shadow-lg mt-6">
        <CardHeader>
          <CardTitle>Excel Template &amp; Sample</CardTitle>
          <CardDescription>
            Download a ready-made Excel template and follow the hints below to prepare salary data for bulk
            import.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs sm:text-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Button
              type="button"
              className="w-full sm:w-auto text-xs sm:text-sm"
              onClick={async () => {
                try {
                  const headers = [
                    "Month Year",
                    "Basic Salary",
                    "HRA",
                    "Bonus",
                    "Income Tax",
                    "Provident Fund",
                    "Total Earnings",
                    "Total Deductions",
                    "Net Pay",
                  ];

                  const sampleRow = [
                    "JAN 2025",
                    80000,
                    32000,
                    10000,
                    18000,
                    9600,
                    122000,
                    27600,
                    94400,
                  ];

                  const worksheet = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
                  const workbook = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(workbook, worksheet, "SalaryTemplate");

                  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
                  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "SalaryTemplate.xlsx";
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                } catch (error) {
                  console.error("Failed to generate Excel template", error);
                }
              }}
            >
              Download Excel Template
            </Button>
            <p className="text-muted-foreground leading-relaxed">
              Open the template in Excel, fill one row per month and organisation, then save as .xlsx and upload
              it above.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-semibold text-xs sm:text-sm">How to fill the template</h4>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                <li>
                  <span className="font-medium">Sheet name</span>: use your organisation name (e.g. TCS, RBS).
                </li>
                <li>
                  <span className="font-medium">Month Year</span>: in the first column (e.g. JAN 2025, FEB 2025).
                </li>
                <li>
                  <span className="font-medium">Earnings columns</span>: add columns like Basic Salary, HRA,
                  Bonus, etc. Positive amounts only.
                </li>
                <li>
                  <span className="font-medium">Deduction columns</span>: add columns like Income Tax,
                  Provident Fund, Insurance, etc. Positive amounts only.
                </li>
                <li>
                  <span className="font-medium">Totals</span>: the last three columns are calculated by you in
                  Excel (Total Earnings, Total Deductions, Net Pay).
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-xs sm:text-sm">Sample row (for reference)</h4>
              <div className="rounded-md border bg-muted/40 overflow-x-auto">
                <Table className="min-w-[520px] text-[11px] sm:text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month Year</TableHead>
                      <TableHead>Basic Salary</TableHead>
                      <TableHead>HRA</TableHead>
                      <TableHead>Bonus</TableHead>
                      <TableHead>Income Tax</TableHead>
                      <TableHead>Provident Fund</TableHead>
                      <TableHead>Total Earnings</TableHead>
                      <TableHead>Total Deductions</TableHead>
                      <TableHead>Net Pay</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>JAN 2025</TableCell>
                      <TableCell>80,000</TableCell>
                      <TableCell>32,000</TableCell>
                      <TableCell>10,000</TableCell>
                      <TableCell>18,000</TableCell>
                      <TableCell>9,600</TableCell>
                      <TableCell>1,22,000</TableCell>
                      <TableCell>27,600</TableCell>
                      <TableCell>94,400</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <p className="text-[11px] text-muted-foreground">
                You can rename or add more earning/deduction columns; the app will automatically detect them
                per organisation.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Review Excel validation results</AlertDialogTitle>
            <AlertDialogDescription>
              We found {importPlan?.totalRecordsToImport ?? 0} valid salary rows and{" "}
              {importPlan?.totalSkippedRows ?? 0} rows with missing or invalid Month/Year.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {importPlan && importPlan.invalidRows.length > 0 && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <div className="mb-1 font-medium text-foreground">Details for skipped rows</div>
              <ul className="space-y-1">
                {invalidRowsPreview.map((row, index) => (
                  <li key={`${row.sheetName}-${row.excelRowNumber}-${index}`}>
                    <span className="font-semibold">{row.sheetName}</span> — row {row.excelRowNumber}: {row.reason}
                  </li>
                ))}
                {importPlan.invalidRows.length > invalidRowsPreview.length && (
                  <li className="italic">...and more rows not shown.</li>
                )}
              </ul>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isProcessing || !importPlan}
              onClick={(e) => {
                e.preventDefault();
                void performImport();
              }}
            >
              Proceed with import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
