import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MONTHS,
  type SalaryRecordWithDetails,
  type SalaryRecord,
  type Earning,
  type Deduction,
} from "@/types/salary";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, Calendar, Eye } from "lucide-react";
import { EditRecordDialog } from "./EditRecordDialog";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { usePersistentFilter } from "@/hooks/usePersistentFilter";

interface SalaryDataTableProps {
  userId: string;
  refreshTrigger: number;
}

interface RecordWithDetails extends SalaryRecord {
  earnings: Earning[];
  deductions: Deduction[];
  organization: string | null;
}

const LINE_COLORS = {
  gross: "hsl(var(--primary))",
  net: "hsl(var(--success))",
  deductions: "hsl(var(--destructive))",
};

const getFinancialYearLabel = (year: number, month: number) => {
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

const getFinancialYearStart = (fyLabel: string) => {
  const match = fyLabel.match(/FY\s+(\d{4})/);
  return match ? parseInt(match[1], 10) : 0;
};

export const SalaryDataTable = ({ userId, refreshTrigger }: SalaryDataTableProps) => {
  const [records, setRecords] = useState<RecordWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = usePersistentFilter<string>(
    `salary-summary:${userId}:selectedOrg`,
    "all",
  );
  const [duration, setDuration] = usePersistentFilter<"6m" | "12m" | "all">(
    `salary-summary:${userId}:duration`,
    "12m",
  );
  const [summaryMonth, setSummaryMonth] = usePersistentFilter<string>(
    `salary-summary:${userId}:summaryMonth`,
    "all",
  );
  const [summaryYear, setSummaryYear] = usePersistentFilter<string>(
    `salary-summary:${userId}:summaryYear`,
    "all",
  );
  const [summaryFinancialYear, setSummaryFinancialYear] = usePersistentFilter<string>(
    `salary-summary:${userId}:summaryFinancialYear`,
    "all",
  );
  const [editingRecord, setEditingRecord] = useState<RecordWithDetails | null>(null);
  const [annualOrg, setAnnualOrg] = usePersistentFilter<string>(
    `salary-summary:${userId}:annualOrg`,
    "all",
  );
  const [userSummaryOrg, setUserSummaryOrg] = usePersistentFilter<string>(
    `salary-summary:${userId}:userSummaryOrg`,
    "all",
  );
  const [userSummaryType, setUserSummaryType] = usePersistentFilter<"earnings" | "deductions">(
    `salary-summary:${userId}:userSummaryType`,
    "earnings",
  );
  const [userSummaryStartYear, setUserSummaryStartYear] = usePersistentFilter<number | null>(
    `salary-summary:${userId}:userSummaryStartYear`,
    null,
  );
  const [userSummaryEndYear, setUserSummaryEndYear] = usePersistentFilter<number | null>(
    `salary-summary:${userId}:userSummaryEndYear`,
    null,
  );
  const [userSummaryFinancialYear, setUserSummaryFinancialYear] = usePersistentFilter<string>(
    `salary-summary:${userId}:userSummaryFinancialYear`,
    "all",
  );
  const [userSummaryCategory, setUserSummaryCategory] = usePersistentFilter<string>(
    `salary-summary:${userId}:userSummaryCategory`,
    "all",
  );
  const [hasInitializedSummaryFy, setHasInitializedSummaryFy] = useState(false);
  const [hasInitializedUserSummaryFy, setHasInitializedUserSummaryFy] = useState(false);

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
      console.error("Fetch salary data error:", error);
      toast.error("Failed to load salary data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchRecords();
  }, [userId, refreshTrigger]);

  const availableYears = Array.from(
    new Set(
      records
        .filter((r) => (selectedOrg === "all" ? true : r.organization === selectedOrg))
        .map((r) => r.year),
    ),
  ).sort((a, b) => a - b);

  const availableFinancialYears = Array.from(
    new Set(
      records
        .filter((r) => (selectedOrg === "all" ? true : r.organization === selectedOrg))
        .map((r) => getFinancialYearLabel(r.year, r.month)),
    ),
  ).sort((a, b) => getFinancialYearStart(b) - getFinancialYearStart(a));

  useEffect(() => {
    if (availableYears.length === 0) {
      setUserSummaryStartYear(null);
      setUserSummaryEndYear(null);
      return;
    }

    setUserSummaryStartYear((prev) => prev ?? availableYears[0]);
    setUserSummaryEndYear((prev) => prev ?? availableYears[availableYears.length - 1]);
  }, [records.length, availableYears.length]);

  useEffect(() => {
    if (availableFinancialYears.length === 0) return;
    const currentFy = getCurrentFinancialYearLabel();

    if (!hasInitializedSummaryFy) {
      if (summaryFinancialYear === "all" && availableFinancialYears.includes(currentFy)) {
        setSummaryFinancialYear(currentFy);
      }
      setHasInitializedSummaryFy(true);
    }

    if (!hasInitializedUserSummaryFy) {
      if (userSummaryFinancialYear === "all" && availableFinancialYears.includes(currentFy)) {
        setUserSummaryFinancialYear(currentFy);
      }
      setHasInitializedUserSummaryFy(true);
    }
  }, [
    availableFinancialYears,
    summaryFinancialYear,
    userSummaryFinancialYear,
    hasInitializedSummaryFy,
    hasInitializedUserSummaryFy,
  ]);

  const organizations = Array.from(
    new Set(records.map((r) => r.organization).filter((org): org is string => !!org)),
  ).sort();

  const timeFilteredRecords = records.filter((record) => {
    if (summaryMonth !== "all" && String(record.month) !== summaryMonth) return false;
    if (summaryYear !== "all" && String(record.year) !== summaryYear) return false;
    if (
      summaryFinancialYear !== "all" &&
      getFinancialYearLabel(record.year, record.month) !== summaryFinancialYear
    )
      return false;
    return true;
  });

  const orgFilteredRecords =
    selectedOrg === "all"
      ? timeFilteredRecords
      : timeFilteredRecords.filter((record) => record.organization === selectedOrg);

  const sliceCount = duration === "6m" ? 6 : duration === "12m" ? 12 : orgFilteredRecords.length;

  const scopedRecords = orgFilteredRecords.slice(0, sliceCount);

  const orgSummary = scopedRecords.reduce(
    (acc, record) => {
      const key = record.organization || "Not specified";
      if (!acc[key]) {
        acc[key] = { gross: 0, deductions: 0, net: 0, months: 0 };
      }
      acc[key].gross += Number(record.gross_salary) || 0;
      acc[key].deductions += Number(record.total_deductions) || 0;
      acc[key].net += Number(record.net_salary) || 0;
      acc[key].months += 1;
      return acc;
    },
    {} as Record<string, { gross: number; deductions: number; net: number; months: number }>,
  );

  const orgSummaryRows = Object.entries(orgSummary).map(([org, values]) => ({
    organization: org,
    ...values,
  }));

  const overallTotals = orgSummaryRows.reduce(
    (acc, row) => {
      acc.gross += row.gross;
      acc.deductions += row.deductions;
      acc.net += row.net;
      acc.months += row.months;
      return acc;
    },
    { gross: 0, deductions: 0, net: 0, months: 0 },
  );

  const incomeTaxByFy = scopedRecords.reduce(
    (acc, record) => {
      const fyLabel = getFinancialYearLabel(record.year, record.month);
      const incomeTaxForRecord = record.deductions
        .filter((d) => String(d.category).toLowerCase().includes("income tax"))
        .reduce((sum, d) => sum + Number(d.amount || 0), 0);

      if (incomeTaxForRecord === 0) return acc;

      if (!acc[fyLabel]) {
        acc[fyLabel] = 0;
      }
      acc[fyLabel] += incomeTaxForRecord;
      return acc;
    },
    {} as Record<string, number>,
  );

  const incomeTaxRows = Object.entries(incomeTaxByFy).map(([fy, amount]) => ({
    financialYear: fy,
    amount,
  }));

  const monthlyChartData = scopedRecords
    .slice()
    .reverse()
    .map((record) => ({
      month: `${MONTHS[record.month - 1].slice(0, 3)} '${record.year.toString().slice(2)}`,
      gross: Number(record.gross_salary) || 0,
      net: Number(record.net_salary) || 0,
      deductions: Number(record.total_deductions) || 0,
    }));

  const deductionsByCategoryMap = scopedRecords.reduce(
    (acc, record) => {
      record.deductions.forEach((d) => {
        const key = d.category || "Uncategorized";
        acc[key] = (acc[key] || 0) + Number(d.amount || 0);
      });
      return acc;
    },
    {} as Record<string, number>,
  );

  const deductionsByCategoryData = Object.entries(deductionsByCategoryMap)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  const annualBaseRecords = timeFilteredRecords;

  const annualOrgRecords =
    annualOrg === "all"
      ? annualBaseRecords
      : annualBaseRecords.filter((record) => record.organization === annualOrg);

  const annualSummaryByYear = annualOrgRecords.reduce(
    (acc, record) => {
      const yearKey = record.year.toString();
      if (!acc[yearKey]) {
        acc[yearKey] = { gross: 0, deductions: 0, net: 0 };
      }
      acc[yearKey].gross += Number(record.gross_salary) || 0;
      acc[yearKey].deductions += Number(record.total_deductions) || 0;
      acc[yearKey].net += Number(record.net_salary) || 0;
      return acc;
    },
    {} as Record<string, { gross: number; deductions: number; net: number }>,
  );

  const annualSummaryRows = Object.entries(annualSummaryByYear)
    .map(([year, values]) => ({
      year,
      ...values,
    }))
    .sort((a, b) => Number(a.year) - Number(b.year));

  const effectiveStartYear =
    userSummaryStartYear ?? (availableYears.length > 0 ? availableYears[0] : undefined);
  const effectiveEndYear =
    userSummaryEndYear ??
    (availableYears.length > 0 ? availableYears[availableYears.length - 1] : undefined);

  const userSummaryRecords = timeFilteredRecords.filter((record) => {
    if (userSummaryOrg !== "all" && record.organization !== userSummaryOrg) return false;
    if (
      userSummaryFinancialYear !== "all" &&
      getFinancialYearLabel(record.year, record.month) !== userSummaryFinancialYear
    )
      return false;
    if (effectiveStartYear === undefined || effectiveEndYear === undefined) return true;
    return record.year >= effectiveStartYear && record.year <= effectiveEndYear;
  });

  const userSummaryAvailableCategories = Array.from(
    new Set(
      userSummaryRecords.flatMap((record) =>
        (userSummaryType === "earnings" ? record.earnings : record.deductions)
          .map((item) => item.category)
          .filter((cat): cat is string => !!cat),
      ),
    ),
  ).sort();

  const userSummaryTotals = userSummaryRecords.reduce(
    (acc, record) => {
      const source = userSummaryType === "earnings" ? record.earnings : record.deductions;
      source.forEach((item) => {
        const key = item.category || "Uncategorized";
        if (userSummaryCategory !== "all" && key !== userSummaryCategory) return;
        if (!acc[key]) acc[key] = 0;
        acc[key] += Number(item.amount || 0);
      });
      return acc;
    },
    {} as Record<string, number>,
  );

  const userSummaryRows = Object.entries(userSummaryTotals)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  const DEFAULT_CARD_ORDER: Array<"salary" | "tax"> = ["salary", "tax"];
  const [cardOrder, setCardOrder] = useState<Array<"salary" | "tax">>(DEFAULT_CARD_ORDER);
  const [draggingId, setDraggingId] = useState<"salary" | "tax" | null>(null);
  const handleResetLayout = () => {
    setCardOrder(DEFAULT_CARD_ORDER);
  };

  const handleDragStart = (id: "salary" | "tax") => {
    setDraggingId(id);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (targetId: "salary" | "tax") => {
    if (!draggingId || draggingId === targetId) return;

    const currentIndex = cardOrder.indexOf(draggingId);
    const targetIndex = cardOrder.indexOf(targetId);
    if (currentIndex === -1 || targetIndex === -1) return;

    const newOrder = [...cardOrder];
    newOrder.splice(currentIndex, 1);
    newOrder.splice(targetIndex, 0, draggingId);
    setCardOrder(newOrder);
    setDraggingId(null);
  };

  const isDefaultLayout = JSON.stringify(cardOrder) === JSON.stringify(DEFAULT_CARD_ORDER);

  const renderCard = (id: "salary" | "tax") => {
    if (id === "salary") {
      return (
        <Card
          key="salary"
          className={`border-primary/20 shadow-lg transition-shadow cursor-move ${
            draggingId === "salary" ? "ring-2 ring-primary" : ""
          }`}
          draggable
          onDragStart={() => handleDragStart("salary")}
          onDragOver={handleDragOver}
          onDrop={() => handleDrop("salary")}
        >
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Salary Summary
              </CardTitle>
            </div>
            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 w-full md:w-64">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Filter by organization" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All organizations</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org} value={org}>
                        {org}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 w-full md:w-48">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Select
                  value={duration}
                  onValueChange={(v) => {
                    setDuration(v as typeof duration);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6m">Last 6 months</SelectItem>
                    <SelectItem value="12m">Last 12 months</SelectItem>
                    <SelectItem value="all">All time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 w-full md:w-56">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Select
                  value={summaryFinancialYear}
                  onValueChange={(v) => {
                    setSummaryFinancialYear(v);
                    if (v !== "all") {
                      setSummaryYear("all");
                      setSummaryMonth("all");
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All financial years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All financial years</SelectItem>
                    {availableFinancialYears.map((fy) => (
                      <SelectItem key={fy} value={fy}>
                        {fy}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-6">Loading salary data...</p>
            ) : scopedRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6">
                No salary records found for the selected filters.
              </p>
            ) : (
              <div className="space-y-8">
                {monthlyChartData.length > 0 && (
                  <div className="grid gap-6 lg:grid-cols-2">
                    <Card className="border-primary/20 shadow-sm h-80">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Monthly Gross vs Net</CardTitle>
                        <CardDescription>Trend of gross, net pay and deductions</CardDescription>
                      </CardHeader>
                      <CardContent className="h-60 pt-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={monthlyChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" tickLine={false} />
                            <YAxis
                              stroke="hsl(var(--muted-foreground))"
                              tickLine={false}
                              tickFormatter={(v) => `₹${Math.round((v as number) / 1000)}k`}
                            />
                            <Tooltip formatter={(value: number) => `₹${value.toLocaleString("en-IN")}`} />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="gross"
                              stroke={LINE_COLORS.gross}
                              name="Gross"
                              strokeWidth={2}
                              dot={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="net"
                              stroke={LINE_COLORS.net}
                              name="Net"
                              strokeWidth={2}
                              dot={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="deductions"
                              stroke={LINE_COLORS.deductions}
                              name="Deductions"
                              strokeWidth={1.5}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card className="border-primary/20 shadow-sm h-80">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Deductions by Category</CardTitle>
                        <CardDescription>Share of total deductions in the period</CardDescription>
                      </CardHeader>
                      <CardContent className="h-60 pt-0 flex items-center justify-center">
                        {deductionsByCategoryData.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center">
                            No deductions found for the selected filters.
                          </p>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={deductionsByCategoryData}
                              margin={{ top: 10, right: 20, bottom: 0, left: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                              <XAxis
                                dataKey="category"
                                stroke="hsl(var(--muted-foreground))"
                                tickLine={false}
                                tick={{ fontSize: 11 }}
                              />
                              <YAxis
                                stroke="hsl(var(--muted-foreground))"
                                tickLine={false}
                                tickFormatter={(v) => `₹${Math.round((v as number) / 1000)}k`}
                              />
                              <Tooltip
                                formatter={(value: number, _name, props: any) => [
                                  `₹${value.toLocaleString("en-IN")}`,
                                  (props?.payload as any)?.category,
                                ]}
                              />
                              <Bar
                                dataKey="total"
                                name="Total deductions"
                                fill="hsl(var(--destructive))"
                                radius={[6, 6, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Organization Summary</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Organization</TableHead>
                        <TableHead className="text-right">Months</TableHead>
                        <TableHead className="text-right">Total Gross</TableHead>
                        <TableHead className="text-right">Total Deductions</TableHead>
                        <TableHead className="text-right">Total Net Pay</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orgSummaryRows.map((row) => (
                        <TableRow key={row.organization} className="hover:bg-muted/50">
                          <TableCell>
                            {row.organization === "Not specified" ? (
                              <span className="text-xs text-muted-foreground">Not specified</span>
                            ) : (
                              <Badge variant="secondary">{row.organization}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {row.months}
                          </TableCell>
                          <TableCell className="text-right font-medium text-primary">
                            ₹{row.gross.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="text-right font-medium text-destructive">
                            -₹{row.deductions.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="text-right font-medium text-success">
                            ₹{row.net.toLocaleString("en-IN")}
                          </TableCell>
                        </TableRow>
                      ))}
                      {selectedOrg === "all" && (
                        <TableRow className="bg-muted/40 font-semibold">
                          <TableCell>Overall Total</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {overallTotals.months}
                          </TableCell>
                          <TableCell className="text-right text-primary">
                            ₹{overallTotals.gross.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="text-right text-destructive">
                            -₹{overallTotals.deductions.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="text-right text-success">
                            ₹{overallTotals.net.toLocaleString("en-IN")}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                    <TableCaption>
                      Showing {scopedRecords.length} months across {orgSummaryRows.length} organizations
                    </TableCaption>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      <Card
        key="tax"
        className={`border-primary/20 shadow-lg transition-shadow cursor-move ${
          draggingId === "tax" ? "ring-2 ring-primary" : ""
        }`}
        draggable
        onDragStart={() => handleDragStart("tax")}
        onDragOver={handleDragOver}
        onDrop={() => handleDrop("tax")}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Income Tax Summary
          </CardTitle>
          <CardDescription>
            Income Tax (TDS) paid per financial year (Apr–Mar) for the selected filters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6">Loading tax data...</p>
          ) : incomeTaxRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">
              No Income Tax (TDS) deductions found for the selected filters.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Financial Year</TableHead>
                  <TableHead className="text-right">Income Tax (TDS) Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomeTaxRows.map((row) => (
                  <TableRow key={row.financialYear} className="hover:bg-muted/50">
                    <TableCell>{row.financialYear}</TableCell>
                    <TableCell className="text-right font-medium text-destructive">
                      -₹{row.amount.toLocaleString("en-IN")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleResetLayout}
          disabled={isDefaultLayout}
        >
          Reset layout
        </Button>
      </div>
      <div className="space-y-6">
        {cardOrder.map((id) => (
          <div key={id}>{renderCard(id)}</div>
        ))}
      </div>

      {/* Annual Summary - standalone section */}
      <Card className="border-primary/20 shadow-lg">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle>Annual Summary</CardTitle>
            <CardDescription>Year-wise totals with independent organization filter.</CardDescription>
          </div>
          <div className="flex items-center gap-2 w-full md:w-64">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <Select value={annualOrg} onValueChange={setAnnualOrg}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All organizations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All organizations</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org} value={org}>
                    {org}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6">Loading annual summary...</p>
          ) : annualSummaryRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data available for annual summary.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead className="text-right">Total Gross</TableHead>
                  <TableHead className="text-right">Total Deductions</TableHead>
                  <TableHead className="text-right">Total Net Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {annualSummaryRows.map((row) => (
                  <TableRow key={row.year} className="hover:bg-muted/50">
                    <TableCell>{row.year}</TableCell>
                    <TableCell className="text-right font-medium text-primary">
                      ₹{row.gross.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right font-medium text-destructive">
                      -₹{row.deductions.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right font-medium text-success">
                      ₹{row.net.toLocaleString("en-IN")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* User Defined Summary - standalone section */}
      <Card className="border-primary/20 shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <CardTitle>User Defined Summary</CardTitle>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="w-40">
                <Select value={userSummaryOrg} onValueChange={setUserSummaryOrg}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All organizations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All organizations</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org} value={org}>
                        {org}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40">
                <Select
                  value={userSummaryType}
                  onValueChange={(v) => setUserSummaryType(v as typeof userSummaryType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="earnings">Earnings</SelectItem>
                    <SelectItem value="deductions">Deductions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {userSummaryAvailableCategories.length > 0 && (
                <div className="w-40">
                  <Select
                    value={userSummaryCategory}
                    onValueChange={setUserSummaryCategory}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All components" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All components</SelectItem>
                      {userSummaryAvailableCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {availableFinancialYears.length > 0 && (
                <div className="w-40">
                  <Select
                    value={userSummaryFinancialYear}
                    onValueChange={setUserSummaryFinancialYear}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All financial years" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All financial years</SelectItem>
                      {availableFinancialYears.map((fy) => (
                        <SelectItem key={fy} value={fy}>
                          {fy}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6">Loading summary...</p>
          ) : userSummaryRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No components found for the selected filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {userSummaryType === "earnings" ? "Earning Category" : "Deduction Category"}
                  </TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userSummaryRows.map((row) => (
                  <TableRow key={row.category} className="hover:bg-muted/50">
                    <TableCell>{row.category}</TableCell>
                    <TableCell className="text-right font-medium">
                      ₹{row.total.toLocaleString("en-IN")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
