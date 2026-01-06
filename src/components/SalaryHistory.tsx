import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TrendingUp, TrendingDown, DollarSign, Calendar, FileText, Trash2, Edit, Briefcase } from "lucide-react";
import { MONTHS, type SalaryRecord, type Earning, type Deduction } from "@/types/salary";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EditRecordDialog } from "./EditRecordDialog";
import * as XLSX from "xlsx";
import { usePersistentFilter } from "@/hooks/usePersistentFilter";
import { cn } from "@/lib/utils";


interface SalaryHistoryProps {
  userId: string;
  refreshTrigger: number;
}

interface RecordWithDetails extends SalaryRecord {
  earnings: Earning[];
  deductions: Deduction[];
  organization: string | null;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--destructive))', '#8B5CF6', '#EC4899'];

export const SalaryHistory = ({ userId, refreshTrigger }: SalaryHistoryProps) => {
  const [records, setRecords] = useState<RecordWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState<RecordWithDetails | null>(null);
  const [selectedOrg, setSelectedOrg] = usePersistentFilter<string>(
    `salary-history:${userId}:selectedOrg`,
    "all",
  );
  const [yearFilter, setYearFilter] = usePersistentFilter<string>(
    `salary-history:${userId}:yearFilter`,
    "all",
  );
  const [financialYearFilter, setFinancialYearFilter] = usePersistentFilter<string>(
    `salary-history:${userId}:financialYearFilter`,
    "all",
  );
  const [earningFilter, setEarningFilter] = usePersistentFilter<string>(
    `salary-history:${userId}:earningFilter`,
    "all",
  );
  const [deductionFilter, setDeductionFilter] = usePersistentFilter<string>(
    `salary-history:${userId}:deductionFilter`,
    "all",
  );
  const [monthRange, setMonthRange] = usePersistentFilter<string>(
    `salary-history:${userId}:monthRange`,
    "3",
  );
  const [employmentHistory, setEmploymentHistory] = useState<any[]>([]);
  const [employmentForm, setEmploymentForm] = useState({
    organization: "",
    employeeId: "",
    joiningDate: "",
    leavingDate: "",
    notes: "",
  });
  const [isEmploymentFormOpen, setIsEmploymentFormOpen] = useState(false);
  const [editingEmploymentId, setEditingEmploymentId] = useState<string | null>(null);

  const DEFAULT_SECTION_ORDER: Array<"employment" | "trends" | "earnings" | "deductions" | "records"> = [
    "employment",
    "trends",
    "earnings",
    "deductions",
    "records",
  ];
  const [sectionOrder, setSectionOrder] = useState<
    Array<"employment" | "trends" | "earnings" | "deductions" | "records">
  >(DEFAULT_SECTION_ORDER);
  const [draggingSection, setDraggingSection] = useState<
    "employment" | "trends" | "earnings" | "deductions" | "records" | null
  >(null);
  const [hasInitializedFinancialYear, setHasInitializedFinancialYear] = useState(false);

  const handleSectionDragStart = (id: "employment" | "trends" | "earnings" | "deductions" | "records") => {
    setDraggingSection(id);
  };

  const handleSectionDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleSectionDrop = (targetId: "employment" | "trends" | "earnings" | "deductions" | "records") => {
    if (!draggingSection || draggingSection === targetId) return;

    const currentIndex = sectionOrder.indexOf(draggingSection);
    const targetIndex = sectionOrder.indexOf(targetId);
    if (currentIndex === -1 || targetIndex === -1) return;

    const newOrder = [...sectionOrder];
    newOrder.splice(currentIndex, 1);
    newOrder.splice(targetIndex, 0, draggingSection);
    setSectionOrder(newOrder);
    setDraggingSection(null);
  };

  const handleResetSectionLayout = () => {
    setSectionOrder(DEFAULT_SECTION_ORDER);
    setDraggingSection(null);
  };


  const fetchRecords = async () => {
    try {
      const { data: salaryData, error: salaryError } = await supabase
        .from("salary_records")
        .select("*")
        .eq("user_id", userId)
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      if (salaryError) throw salaryError;

      const baseRecords = salaryData || [];
      if (baseRecords.length === 0) {
        setRecords([]);
        return;
      }

      const recordIds = baseRecords.map((r) => r.id);

      const [{ data: earningsData, error: earningsError }, { data: deductionsData, error: deductionsError }] =
        await Promise.all([
          supabase.from("earnings").select("*").in("salary_record_id", recordIds),
          supabase.from("deductions").select("*").in("salary_record_id", recordIds),
        ]);

      if (earningsError) throw earningsError;
      if (deductionsError) throw deductionsError;

      const earningsByRecord = new Map<string, Earning[]>();
      (earningsData || []).forEach((e: any) => {
        const list = earningsByRecord.get(e.salary_record_id) || [];
        list.push(e);
        earningsByRecord.set(e.salary_record_id, list);
      });

      const deductionsByRecord = new Map<string, Deduction[]>();
      (deductionsData || []).forEach((d: any) => {
        const list = deductionsByRecord.get(d.salary_record_id) || [];
        list.push(d);
        deductionsByRecord.set(d.salary_record_id, list);
      });

      const recordsWithDetails: RecordWithDetails[] = baseRecords.map((record: any) => ({
        ...record,
        earnings: earningsByRecord.get(record.id) || [],
        deductions: deductionsByRecord.get(record.id) || [],
      }));

      setRecords(recordsWithDetails);
    } catch (error: any) {
      console.error("Fetch error:", error);
      toast.error("Failed to load salary history");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmploymentHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("employment_history")
        .select("*")
        .eq("user_id", userId)
        .order("joining_date", { ascending: true });

      if (error) throw error;
      setEmploymentHistory(data || []);
    } catch (error: any) {
      console.error("Employment history fetch error:", error);
      toast.error("Failed to load employment details");
    }
  };

  useEffect(() => {
    fetchRecords();
    fetchEmploymentHistory();
  }, [userId, refreshTrigger]);

  const handleDelete = async (recordId: string) => {
    try {
      const { error } = await supabase.from("salary_records").delete().eq("id", recordId);

      if (error) throw error;

      toast.success("Record deleted successfully");
      fetchRecords();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("Failed to delete record");
    }
  };

  const handleEmploymentDelete = async (employmentId: string) => {
    try {
      const { error } = await supabase.from("employment_history").delete().eq("id", employmentId);
      if (error) throw error;
      toast.success("Employment entry deleted");
      fetchEmploymentHistory();
    } catch (error: any) {
      console.error("Employment delete error:", error);
      toast.error("Failed to delete employment entry");
    }
  };

  const recordsForOrgOptions = records.filter((r) => {
    if (yearFilter !== "all" && r.year !== Number(yearFilter)) return false;
    if (
      financialYearFilter !== "all" &&
      getFinancialYearLabel(r.year, r.month) !== financialYearFilter
    )
      return false;
    if (earningFilter !== "all" && !r.earnings.some((e) => e.category === earningFilter)) return false;
    if (
      deductionFilter !== "all" &&
      !r.deductions.some((d) => d.category === deductionFilter)
    )
      return false;
    return true;
  });

  const organizations = Array.from(
    new Set(recordsForOrgOptions.map((r) => r.organization).filter((org): org is string => !!org)),
  ).sort();

  const recordsForYearOptions = records.filter((r) => {
    if (selectedOrg !== "all" && r.organization !== selectedOrg) return false;
    if (
      financialYearFilter !== "all" &&
      getFinancialYearLabel(r.year, r.month) !== financialYearFilter
    )
      return false;
    if (earningFilter !== "all" && !r.earnings.some((e) => e.category === earningFilter)) return false;
    if (
      deductionFilter !== "all" &&
      !r.deductions.some((d) => d.category === deductionFilter)
    )
      return false;
    return true;
  });

  const availableYears = Array.from(new Set(recordsForYearOptions.map((r) => r.year))).sort(
    (a, b) => a - b,
  );

  function getFinancialYearLabel(year: number, month: number) {
    if (month >= 4) {
      const nextYearShort = (year + 1).toString().slice(2);
      return `FY ${year}-${nextYearShort}`;
    } else {
      const prevYear = year - 1;
      const yearShort = year.toString().slice(2);
      return `FY ${prevYear}-${yearShort}`;
    }
  };

  const getCurrentFinancialYearLabel = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    if (month >= 4) {
      const nextYearShort = (year + 1).toString().slice(2);
      return `FY ${year}-${nextYearShort}`;
    } else {
      const prevYear = year - 1;
      const yearShort = year.toString().slice(2);
      return `FY ${prevYear}-${yearShort}`;
    }
  };

  const recordsForFinancialYearOptions = records.filter((r) => {
    if (selectedOrg !== "all" && r.organization !== selectedOrg) return false;
    if (yearFilter !== "all" && r.year !== Number(yearFilter)) return false;
    if (earningFilter !== "all" && !r.earnings.some((e) => e.category === earningFilter)) return false;
    if (
      deductionFilter !== "all" &&
      !r.deductions.some((d) => d.category === deductionFilter)
    )
      return false;
    return true;
  });

  const availableFinancialYears = Array.from(
    new Set(
      recordsForFinancialYearOptions.map((r) => getFinancialYearLabel(r.year, r.month)),
    ),
  ).sort((a, b) => {
    const matchA = a.match(/FY\s+(\d{4})/);
    const matchB = b.match(/FY\s+(\d{4})/);
    const yearA = matchA ? parseInt(matchA[1], 10) : 0;
    const yearB = matchB ? parseInt(matchB[1], 10) : 0;
    return yearB - yearA;
  });

  const filteredRecords = records.filter((record) => {
    if (selectedOrg !== "all" && record.organization !== selectedOrg) return false;
    if (yearFilter !== "all" && record.year !== Number(yearFilter)) return false;
    if (
      financialYearFilter !== "all" &&
      getFinancialYearLabel(record.year, record.month) !== financialYearFilter
    )
      return false;
    if (
      earningFilter !== "all" &&
      !record.earnings.some((e) => e.category === earningFilter)
    )
      return false;
    if (
      deductionFilter !== "all" &&
      !record.deductions.some((d) => d.category === deductionFilter)
    )
      return false;
    return true;
  });

  const hasNoDataForFilters = !isLoading && records.length > 0 && filteredRecords.length === 0;

  const recordsForEarningOptions = records.filter((r) => {
    if (selectedOrg !== "all" && r.organization !== selectedOrg) return false;
    if (yearFilter !== "all" && r.year !== Number(yearFilter)) return false;
    if (
      financialYearFilter !== "all" &&
      getFinancialYearLabel(r.year, r.month) !== financialYearFilter
    )
      return false;
    if (
      deductionFilter !== "all" &&
      !r.deductions.some((d) => d.category === deductionFilter)
    )
      return false;
    return true;
  });

  const earningCategories = Array.from(
    new Set(recordsForEarningOptions.flatMap((r) => r.earnings.map((e) => e.category))),
  ).sort();

  const recordsForDeductionOptions = records.filter((r) => {
    if (selectedOrg !== "all" && r.organization !== selectedOrg) return false;
    if (yearFilter !== "all" && r.year !== Number(yearFilter)) return false;
    if (
      financialYearFilter !== "all" &&
      getFinancialYearLabel(r.year, r.month) !== financialYearFilter
    )
      return false;
    if (earningFilter !== "all" && !r.earnings.some((e) => e.category === earningFilter)) return false;
    return true;
  });

  const deductionCategories = Array.from(
    new Set(recordsForDeductionOptions.flatMap((r) => r.deductions.map((d) => d.category))),
  ).sort();

  const sortedRecords = hasNoDataForFilters ? [] : filteredRecords.length > 0 ? filteredRecords : records;

  const chartRecords = sortedRecords;
  const monthRangeNumber = parseInt(monthRange, 10);

  const chartRecordsWithRange =
    !isNaN(monthRangeNumber) && chartRecords.length > 0
      ? chartRecords.filter((record) => {
          const recordIndex = record.year * 12 + record.month;
          const latestIndex = chartRecords[0].year * 12 + chartRecords[0].month;
          const cutoffIndex = latestIndex - (monthRangeNumber - 1);
          return recordIndex >= cutoffIndex;
        })
      : chartRecords;

  const recordsForList = sortedRecords;

  const chartSource = chartRecordsWithRange.slice().reverse();

  useEffect(() => {
    if (hasInitializedFinancialYear) return;
    if (availableFinancialYears.length === 0) return;
    const currentFy = getCurrentFinancialYearLabel();

    if (financialYearFilter === "all" && availableFinancialYears.includes(currentFy)) {
      setFinancialYearFilter(currentFy);
    }

    setHasInitializedFinancialYear(true);
  }, [availableFinancialYears, financialYearFilter, hasInitializedFinancialYear]);

  const chartData = chartSource.map((r) => ({
    month: `${MONTHS[r.month - 1].slice(0, 3)} '${r.year.toString().slice(2)}`,
    earnings: r.total_earnings,
    deductions: r.total_deductions,
    net: r.net_salary,
  }));

  const earningsSummaryMap = chartSource.reduce(
    (acc, record) => {
      record.earnings.forEach((e) => {
        if (earningFilter !== "all" && e.category !== earningFilter) return;
        acc[e.category] = (acc[e.category] || 0) + Number(e.amount || 0);
      });
      return acc;
    },
    {} as Record<string, number>
  );

  const totalEarningsSummary = Object.values(earningsSummaryMap).reduce(
    (sum, v) => sum + v,
    0
  );

  const earningsSummary = Object.entries(earningsSummaryMap).map(([category, total]) => ({
    category,
    total,
    percentage: totalEarningsSummary ? (total / totalEarningsSummary) * 100 : 0,
  }));

  const deductionsSummaryMap = chartSource.reduce(
    (acc, record) => {
      record.deductions.forEach((d) => {
        if (deductionFilter !== "all" && d.category !== deductionFilter) return;
        acc[d.category] = (acc[d.category] || 0) + Number(d.amount || 0);
      });
      return acc;
    },
    {} as Record<string, number>
  );

  const totalDeductionsSummary = Object.values(deductionsSummaryMap).reduce(
    (sum, v) => sum + v,
    0
  );

  const deductionsSummary = Object.entries(deductionsSummaryMap).map(([category, total]) => ({
    category,
    total,
    percentage: totalDeductionsSummary ? (total / totalDeductionsSummary) * 100 : 0,
  }));

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      .replace(",", "");
  };

  const handleExportToExcel = () => {
    if (records.length === 0) {
      toast.error("No salary records to export");
      return;
    }

    const workbook = XLSX.utils.book_new();

    const orgMap = new Map<string, RecordWithDetails[]>();
    records.forEach((record) => {
      const orgKey = record.organization || "Not specified";
      const existing = orgMap.get(orgKey) || [];
      existing.push(record);
      orgMap.set(orgKey, existing);
    });

    const MONTH_YEAR_HEADER = "Month Year";
    const TOTAL_EARNINGS_HEADER = "Total Earnings";
    const TOTAL_DEDUCTIONS_HEADER = "Total Deductions";
    const NET_SALARY_HEADER = "Net Salary";

    orgMap.forEach((orgRecords, orgName) => {
      const sortedOrgRecords = [...orgRecords].sort((a, b) => {
        if (a.year === b.year) return a.month - b.month;
        return a.year - b.year;
      });

      const earningCategories = Array.from(
        new Set(sortedOrgRecords.flatMap((r) => r.earnings.map((e) => e.category))),
      ).sort();
      const deductionCategories = Array.from(
        new Set(sortedOrgRecords.flatMap((r) => r.deductions.map((d) => d.category))),
      ).sort();

      const headers: (string | number)[] = [
        MONTH_YEAR_HEADER,
        ...earningCategories,
        ...deductionCategories,
        TOTAL_EARNINGS_HEADER,
        TOTAL_DEDUCTIONS_HEADER,
        NET_SALARY_HEADER,
      ];

      const rows = sortedOrgRecords.map((record) => {
        const monthLabel = `${MONTHS[record.month - 1].slice(0, 3).toUpperCase()} ${record.year}`;

        const earningValues = earningCategories.map((cat) => {
          const entry = record.earnings.find((e) => e.category === cat);
          return entry ? Number(entry.amount) : 0;
        });

        const deductionValues = deductionCategories.map((cat) => {
          const entry = record.deductions.find((d) => d.category === cat);
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
      XLSX.utils.book_append_sheet(workbook, worksheet, orgName.substring(0, 31));
    });

    XLSX.writeFile(workbook, "salary-data-export.xlsx");
  };
  if (isLoading) {
    return (
      <Card className="border-primary/20 shadow-lg">
        <CardContent className="py-12 text-center text-muted-foreground">
          Loading your salary history...
        </CardContent>
      </Card>
    );
  }

  if (records.length === 0) {
    return (
      <Card className="border-primary/20 shadow-lg">
        <CardContent className="py-12 text-center text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No salary records yet. Start by adding your first entry!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {hasNoDataForFilters && (
        <Card className="border-dashed border-primary/30 bg-background/60">
          <CardContent className="py-4 text-center text-muted-foreground text-sm">
            No data available for the selected filters. Try adjusting the financial year, year, organization, or
            category filters.
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleResetSectionLayout}
          disabled={JSON.stringify(sectionOrder) === JSON.stringify(DEFAULT_SECTION_ORDER)}
        >
          Reset layout
        </Button>
      </div>

      <div className="space-y-6">
        {sectionOrder.map((sectionId) => (
          <div
            key={sectionId}
            draggable
            onDragStart={() => handleSectionDragStart(sectionId)}
            onDragOver={handleSectionDragOver}
            onDrop={() => handleSectionDrop(sectionId)}
          >
            {sectionId === "employment" && (
              <Card className="border-primary/20 shadow-lg">
                <CardHeader>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-primary" />
                        Employment Details
                      </CardTitle>
                      <CardDescription>
                        Maintain your employment history by organization.
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!isEmploymentFormOpen) {
                          setEmploymentForm({
                            organization: "",
                            employeeId: "",
                            joiningDate: "",
                            leavingDate: "",
                            notes: "",
                          });
                          setEditingEmploymentId(null);
                        }
                        setIsEmploymentFormOpen((prev) => !prev);
                      }}
                    >
                      {isEmploymentFormOpen
                        ? "Hide Employment Form"
                        : editingEmploymentId
                        ? "Edit Employment Detail"
                        : "Add Employment Detail"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isEmploymentFormOpen && (
                    <>
                      <div className="grid md:grid-cols-4 gap-3 text-xs md:text-sm">
                        <div className="space-y-1">
                          <span className="text-muted-foreground text-xs">Organization</span>
                          <Input
                            value={employmentForm.organization}
                            onChange={(e) => setEmploymentForm({ ...employmentForm, organization: e.target.value })}
                            placeholder="Company name"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-muted-foreground text-xs">Employee ID</span>
                          <Input
                            value={employmentForm.employeeId}
                            onChange={(e) => setEmploymentForm({ ...employmentForm, employeeId: e.target.value })}
                            placeholder="ID from payslip"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-muted-foreground text-xs">Joining Date</span>
                          <Input
                            type="date"
                            value={employmentForm.joiningDate}
                            onChange={(e) => setEmploymentForm({ ...employmentForm, joiningDate: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-muted-foreground text-xs">Leaving Date (optional)</span>
                          <Input
                            type="date"
                            value={employmentForm.leavingDate}
                            onChange={(e) => setEmploymentForm({ ...employmentForm, leavingDate: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-muted-foreground text-xs">Notes</span>
                        <Textarea
                          value={employmentForm.notes}
                          onChange={(e) => setEmploymentForm({ ...employmentForm, notes: e.target.value })}
                          placeholder="Any additional information you want to remember"
                          className="text-xs min-h-[60px]"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        {editingEmploymentId && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            type="button"
                            onClick={() => {
                              setEmploymentForm({
                                organization: "",
                                employeeId: "",
                                joiningDate: "",
                                leavingDate: "",
                                notes: "",
                              });
                              setEditingEmploymentId(null);
                              setIsEmploymentFormOpen(false);
                            }}
                          >
                            Cancel Edit
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="text-xs"
                          type="button"
                          onClick={async () => {
                            if (!employmentForm.organization || !employmentForm.joiningDate) {
                              toast.error("Organization and joining date are required");
                              return;
                            }
                            try {
                              if (editingEmploymentId) {
                                const { error } = await supabase
                                  .from("employment_history")
                                  .update({
                                    organization: employmentForm.organization,
                                    employee_id: employmentForm.employeeId || null,
                                    joining_date: employmentForm.joiningDate,
                                    leaving_date: employmentForm.leavingDate || null,
                                    notes: employmentForm.notes || null,
                                  })
                                  .eq("id", editingEmploymentId);
                                if (error) throw error;
                                toast.success("Employment details updated");
                              } else {
                                const { error } = await supabase.from("employment_history").insert({
                                  user_id: userId,
                                  organization: employmentForm.organization,
                                  employee_id: employmentForm.employeeId || null,
                                  joining_date: employmentForm.joiningDate,
                                  leaving_date: employmentForm.leavingDate || null,
                                  notes: employmentForm.notes || null,
                                });
                                if (error) throw error;
                                toast.success("Employment details saved");
                              }
                              setEmploymentForm({
                                organization: "",
                                employeeId: "",
                                joiningDate: "",
                                leavingDate: "",
                                notes: "",
                              });
                              setEditingEmploymentId(null);
                              setIsEmploymentFormOpen(false);
                              fetchEmploymentHistory();
                            } catch (error: any) {
                              console.error("Employment history save error:", error);
                              toast.error("Failed to save employment details");
                            }
                          }}
                        >
                          {editingEmploymentId ? "Update Employment" : "Save Employment"}
                        </Button>
                      </div>
                    </>
                  )}

                  {employmentHistory.length > 0 && (
                    <div className="border-t border-border/40 pt-3 mt-1 text-xs md:text-sm">
                      <div className="grid grid-cols-5 font-semibold text-muted-foreground pb-2">
                        <span>Organization</span>
                        <span>Employee ID</span>
                        <span>Period</span>
                        <span>Notes</span>
                        <span className="text-right">Actions</span>
                      </div>
                      <div className="space-y-1.5">
                        {employmentHistory.map((job) => (
                          <div
                            key={job.id}
                            className="grid gap-2 border-b border-border/10 pb-1 last:border-0 items-start sm:grid-cols-5"
                          >
                            <span>{job.organization}</span>
                            <span className="text-muted-foreground">{job.employee_id || "—"}</span>
                            <span className="text-muted-foreground">
                              {formatDate(job.joining_date)} - {job.leaving_date ? formatDate(job.leaving_date) : "Present"}
                            </span>
                            <span className="truncate text-muted-foreground">{job.notes || ""}</span>
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                type="button"
                                onClick={() => {
                                  setEmploymentForm({
                                    organization: job.organization || "",
                                    employeeId: job.employee_id || "",
                                    joiningDate: job.joining_date || "",
                                    leavingDate: job.leaving_date || "",
                                    notes: job.notes || "",
                                  });
                                  setEditingEmploymentId(job.id);
                                  setIsEmploymentFormOpen(true);
                                }}
                              >
                                <Edit className="w-3 h-3 text-primary" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                type="button"
                                onClick={() => handleEmploymentDelete(job.id)}
                              >
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {sectionId === "trends" && (
              <Card className="border-primary/20 shadow-lg">
                <CardHeader>
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 whitespace-nowrap">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        Salary Trends
                      </CardTitle>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs md:text-[11px]">
                      <div className="flex items-center gap-2 min-w-[140px]">
                        <span className="text-muted-foreground">Organization</span>
                        <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                          <SelectTrigger className="h-8 w-[140px] text-xs">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {organizations.map((org) => (
                              <SelectItem key={org} value={org}>
                                {org}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2 min-w-[130px]">
                        <span className="text-muted-foreground">Year</span>
                        <Select
                          value={yearFilter}
                          onValueChange={(v) => {
                            setYearFilter(v);
                            setFinancialYearFilter("all");
                          }}
                        >
                          <SelectTrigger className="h-8 w-[120px] text-xs">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All years</SelectItem>
                            {availableYears.map((y) => (
                              <SelectItem key={y} value={String(y)}>
                                {y}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2 min-w-[150px]">
                        <span className="text-muted-foreground">Financial Year</span>
                        <Select
                          value={financialYearFilter}
                          onValueChange={(v) => {
                            setFinancialYearFilter(v);
                            if (v !== "all") {
                              setYearFilter("all");
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 w-[140px] text-xs">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All FYs</SelectItem>
                            {availableFinancialYears.map((fy) => (
                              <SelectItem key={fy} value={fy}>
                                {fy}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2 min-w-[170px]">
                        <span className="text-muted-foreground">Period</span>
                        <Select value={monthRange} onValueChange={setMonthRange}>
                          <SelectTrigger className="h-8 w-[150px] text-xs">
                            <SelectValue placeholder="Last 3 months" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Last 1 month</SelectItem>
                            <SelectItem value="3">Last 3 months</SelectItem>
                            <SelectItem value="6">Last 6 months</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {chartData.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground text-sm">
                      No records match the selected filters.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="earnings" stroke="hsl(var(--primary))" strokeWidth={2} name="Earnings" />
                        <Line type="monotone" dataKey="deductions" stroke="hsl(var(--destructive))" strokeWidth={2} name="Deductions" />
                        <Line type="monotone" dataKey="net" stroke="hsl(var(--success))" strokeWidth={2} name="Net Salary" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            )}

            {sectionId === "earnings" && (
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="border-primary/20 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-lg">Earnings Summary</CardTitle>
                    <CardDescription>
                      Aggregated earnings for the selected filters
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {chartSource.length === 0 ? (
                      <div className="py-6 text-sm text-muted-foreground text-center">
                        No earnings data for the selected filters.
                      </div>
                    ) : (
                      <div className="text-xs md:text-sm">
                        <div className="grid grid-cols-3 font-semibold text-muted-foreground pb-2 border-b border-border/40">
                          <span>Category</span>
                          <span className="text-right">Total Amount</span>
                          <span className="text-right">Share</span>
                        </div>
                        {earningsSummary.map((row) => (
                          <div
                            key={row.category}
                            className="grid grid-cols-3 py-1.5 border-b border-border/10 last:border-0"
                          >
                            <span className="truncate pr-2">{row.category}</span>
                            <span className="text-right font-medium">
                              ₹{row.total.toLocaleString("en-IN")}
                            </span>
                            <span className="text-right text-muted-foreground">
                              {row.percentage.toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-primary/20 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-lg">Deductions Summary</CardTitle>
                    <CardDescription>
                      Aggregated deductions for the selected filters
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {chartSource.length === 0 ? (
                      <div className="py-6 text-sm text-muted-foreground text-center">
                        No deductions data for the selected filters.
                      </div>
                    ) : (
                      <div className="text-xs md:text-sm">
                        <div className="grid grid-cols-3 font-semibold text-muted-foreground pb-2 border-b border-border/40">
                          <span>Category</span>
                          <span className="text-right">Total Amount</span>
                          <span className="text-right">Share</span>
                        </div>
                        {deductionsSummary.map((row) => (
                          <div
                            key={row.category}
                            className="grid grid-cols-3 py-1.5 border-b border-border/10 last:border-0"
                          >
                            <span className="truncate pr-2">{row.category}</span>
                            <span className="text-right font-medium">
                              ₹{row.total.toLocaleString("en-IN")}
                            </span>
                            <span className="text-right text-muted-foreground">
                              {row.percentage.toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {sectionId === "records" && (
              <Card className="border-primary/20 shadow-lg">
                <CardHeader>
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-primary" />
                        Salary Records
                      </CardTitle>
                      <CardDescription>All your recorded salary entries</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Organization</span>
                        <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                          <SelectTrigger className="h-8 w-[150px] text-xs">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {organizations.map((org) => (
                              <SelectItem key={org} value={org}>
                                {org}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Year</span>
                        <Select
                          value={yearFilter}
                          onValueChange={(v) => {
                            setYearFilter(v);
                            setFinancialYearFilter("all");
                          }}
                        >
                          <SelectTrigger className="h-8 w-[130px] text-xs">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All years</SelectItem>
                            {availableYears.map((y) => (
                              <SelectItem key={y} value={String(y)}>
                                {y}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Financial Year</span>
                        <Select
                          value={financialYearFilter}
                          onValueChange={(v) => {
                            setFinancialYearFilter(v);
                            if (v !== "all") {
                              setYearFilter("all");
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 w-[150px] text-xs">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All FYs</SelectItem>
                            {availableFinancialYears.map((fy) => (
                              <SelectItem key={fy} value={fy}>
                                {fy}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {recordsForList.map((record) => (
                    <Card key={record.id} className="bg-secondary/20 border-secondary">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="font-semibold">
                                {MONTHS[record.month - 1]} {record.year}
                              </Badge>
                              {record.organization && (
                                <Badge variant="secondary" className="text-xs">
                                  {record.organization}
                                </Badge>
                              )}
                            </div>
                            <div className="grid gap-4 text-sm sm:grid-cols-3">
                              <div>
                                <p className="text-muted-foreground text-xs">Gross Salary</p>
                                <p className="font-semibold text-primary">₹{record.gross_salary.toLocaleString('en-IN')}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">Deductions</p>
                                <p className="font-semibold text-destructive">-₹{record.total_deductions.toLocaleString('en-IN')}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">Net Salary</p>
                                <p className="font-semibold text-success">₹{record.net_salary.toLocaleString('en-IN')}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingRecord(record)}
                            >
                              <Edit className="w-4 h-4 text-primary" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Record?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete the salary record for {MONTHS[record.month - 1]} {record.year}.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(record.id)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="font-semibold mb-2 text-primary flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              Earnings ({record.earnings.length})
                            </p>
                            <ul className="space-y-1 text-xs">
                              {record.earnings.map((e) => (
                                <li key={e.id} className="flex justify-between">
                                  <span className="text-muted-foreground">{e.category}</span>
                                  <span className="font-medium">₹{e.amount.toLocaleString('en-IN')}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="font-semibold mb-2 text-destructive flex items-center gap-1">
                              <TrendingDown className="w-3 h-3" />
                              Deductions ({record.deductions.length})
                            </p>
                            <ul className="space-y-1 text-xs">
                              {record.deductions.map((d) => (
                                <li key={d.id} className="flex justify-between">
                                  <span className="text-muted-foreground">{d.category}</span>
                                  <span className="font-medium">₹{d.amount.toLocaleString('en-IN')}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {record.notes && (
                          <div className="mt-4 pt-4 border-t border-border/50">
                            <p className="text-xs text-muted-foreground"><strong>Notes:</strong> {record.notes}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        ))}
      </div>

      {editingRecord && (
        <EditRecordDialog
          record={editingRecord}
          earnings={editingRecord.earnings}
          deductions={editingRecord.deductions}
          open={!!editingRecord}
          onOpenChange={(open) => !open && setEditingRecord(null)}
          onSuccess={fetchRecords}
        />
      )}
    </div>
  );
};
