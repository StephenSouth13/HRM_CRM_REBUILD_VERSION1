import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { TrendingUp, Users, DollarSign, Calendar, Award, AlertTriangle, Minus, Plus } from "lucide-react";
import { format, parseISO, subMonths, startOfMonth } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { formatVND } from "@/lib/salary-utils";

interface SalaryData {
  id: string;
  user_id: string;
  month: string;
  base_salary: number;
  bonus: number;
  deductions: number;
  net_salary: number;
  status: string;
  kpi_bonus: number | null;
  sales_bonus: number | null;
  weekend_bonus: number | null;
  other_bonus: number | null;
  late_penalty: number | null;
  absence_penalty: number | null;
  violation_penalty: number | null;
  late_count: number | null;
  absence_count: number | null;
  profiles: {
    first_name: string;
    last_name: string;
  };
}

interface MonthlyTrend {
  month: string;
  total: number;
  avgSalary: number;
  totalBonus: number;
  totalDeductions: number;
  kpiBonus: number;
  salesBonus: number;
  weekendBonus: number;
  otherBonus: number;
  latePenalty: number;
  absencePenalty: number;
  violationPenalty: number;
}

interface EmployeeComparison {
  name: string;
  salary: number;
  bonus: number;
  deductions: number;
  total: number;
}

interface BonusBreakdown {
  name: string;
  value: number;
  color: string;
}

interface PenaltyBreakdown {
  name: string;
  value: number;
  color: string;
}

const BONUS_COLORS = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'];
const PENALTY_COLORS = ['#ef4444', '#f87171', '#fca5a5', '#fecaca'];

const SalaryStatistics = () => {
  const [loading, setLoading] = useState(true);
  const [salaryData, setSalaryData] = useState<SalaryData[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [employeeComparisons, setEmployeeComparisons] = useState<EmployeeComparison[]>([]);
  const [bonusBreakdown, setBonusBreakdown] = useState<BonusBreakdown[]>([]);
  const [penaltyBreakdown, setPenaltyBreakdown] = useState<PenaltyBreakdown[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("6");

  useEffect(() => {
    fetchSalaryData();
  }, [selectedPeriod]);

  const fetchSalaryData = async () => {
    try {
      setLoading(true);
      const monthsToFetch = parseInt(selectedPeriod);
      const startDate = startOfMonth(subMonths(new Date(), monthsToFetch));

      const { data, error } = await supabase
        .from("salaries")
        .select(`
          id,
          user_id,
          month,
          base_salary,
          bonus,
          deductions,
          net_salary,
          status,
          kpi_bonus,
          sales_bonus,
          weekend_bonus,
          other_bonus,
          late_penalty,
          absence_penalty,
          violation_penalty,
          late_count,
          absence_count,
          profiles!salaries_user_id_fkey (
            first_name,
            last_name
          )
        `)
        .gte("month", format(startDate, "yyyy-MM-dd"))
        .order("month", { ascending: true });

      if (error) throw error;

      setSalaryData(data as any || []);
      processMonthlyTrends(data as any || []);
      processEmployeeComparisons(data as any || []);
      processBonusPenaltyBreakdown(data as any || []);
    } catch (error) {
      console.error("Error fetching salary data:", error);
    } finally {
      setLoading(false);
    }
  };

  const processMonthlyTrends = (data: SalaryData[]) => {
    const monthlyMap = new Map<string, {
      total: number;
      count: number;
      bonus: number;
      deductions: number;
      kpiBonus: number;
      salesBonus: number;
      weekendBonus: number;
      otherBonus: number;
      latePenalty: number;
      absencePenalty: number;
      violationPenalty: number;
    }>();

    data.forEach((record) => {
      const monthKey = format(parseISO(record.month), "MMM yyyy");
      const existing = monthlyMap.get(monthKey) || {
        total: 0, count: 0, bonus: 0, deductions: 0,
        kpiBonus: 0, salesBonus: 0, weekendBonus: 0, otherBonus: 0,
        latePenalty: 0, absencePenalty: 0, violationPenalty: 0
      };
      
      monthlyMap.set(monthKey, {
        total: existing.total + Number(record.net_salary || 0),
        count: existing.count + 1,
        bonus: existing.bonus + Number(record.bonus || 0),
        deductions: existing.deductions + Number(record.deductions || 0),
        kpiBonus: existing.kpiBonus + Number(record.kpi_bonus || 0),
        salesBonus: existing.salesBonus + Number(record.sales_bonus || 0),
        weekendBonus: existing.weekendBonus + Number(record.weekend_bonus || 0),
        otherBonus: existing.otherBonus + Number(record.other_bonus || 0),
        latePenalty: existing.latePenalty + Number(record.late_penalty || 0),
        absencePenalty: existing.absencePenalty + Number(record.absence_penalty || 0),
        violationPenalty: existing.violationPenalty + Number(record.violation_penalty || 0),
      });
    });

    const trends = Array.from(monthlyMap.entries()).map(([month, stats]) => ({
      month,
      total: Math.round(stats.total),
      avgSalary: Math.round(stats.total / stats.count),
      totalBonus: Math.round(stats.bonus),
      totalDeductions: Math.round(stats.deductions),
      kpiBonus: Math.round(stats.kpiBonus),
      salesBonus: Math.round(stats.salesBonus),
      weekendBonus: Math.round(stats.weekendBonus),
      otherBonus: Math.round(stats.otherBonus),
      latePenalty: Math.round(stats.latePenalty),
      absencePenalty: Math.round(stats.absencePenalty),
      violationPenalty: Math.round(stats.violationPenalty),
    }));

    setMonthlyTrends(trends);
  };

  const processEmployeeComparisons = (data: SalaryData[]) => {
    const employeeMap = new Map<string, SalaryData>();

    data.forEach((record) => {
      const existing = employeeMap.get(record.user_id);
      if (!existing || parseISO(record.month) > parseISO(existing.month)) {
        employeeMap.set(record.user_id, record);
      }
    });

    const comparisons = Array.from(employeeMap.values())
      .map((record) => ({
        name: `${record.profiles?.first_name} ${record.profiles?.last_name}`,
        salary: Number(record.base_salary || 0),
        bonus: Number(record.bonus || 0),
        deductions: Number(record.deductions || 0),
        total: Number(record.net_salary || 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    setEmployeeComparisons(comparisons);
  };

  const processBonusPenaltyBreakdown = (data: SalaryData[]) => {
    let kpi = 0, sales = 0, weekend = 0, other = 0;
    let late = 0, absence = 0, violation = 0;

    data.forEach((record) => {
      kpi += Number(record.kpi_bonus || 0);
      sales += Number(record.sales_bonus || 0);
      weekend += Number(record.weekend_bonus || 0);
      other += Number(record.other_bonus || 0);
      late += Number(record.late_penalty || 0);
      absence += Number(record.absence_penalty || 0);
      violation += Number(record.violation_penalty || 0);
    });

    setBonusBreakdown([
      { name: 'Thưởng KPI', value: kpi, color: BONUS_COLORS[0] },
      { name: 'Thưởng doanh số', value: sales, color: BONUS_COLORS[1] },
      { name: 'Thưởng cuối tuần', value: weekend, color: BONUS_COLORS[2] },
      { name: 'Thưởng khác', value: other, color: BONUS_COLORS[3] },
    ].filter(b => b.value > 0));

    setPenaltyBreakdown([
      { name: 'Phạt đi muộn', value: late, color: PENALTY_COLORS[0] },
      { name: 'Phạt nghỉ KP', value: absence, color: PENALTY_COLORS[1] },
      { name: 'Phạt vi phạm', value: violation, color: PENALTY_COLORS[2] },
    ].filter(p => p.value > 0));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const totalPayout = salaryData.reduce((sum, record) => sum + Number(record.net_salary || 0), 0);
  const totalBonus = salaryData.reduce((sum, record) => sum + Number(record.bonus || 0), 0);
  const totalDeductions = salaryData.reduce((sum, record) => sum + Number(record.deductions || 0), 0);
  const avgSalary = salaryData.length > 0 ? totalPayout / salaryData.length : 0;
  const totalEmployees = new Set(salaryData.map(r => r.user_id)).size;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="shadow-medium hover:shadow-strong transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tổng Chi Lương</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              {formatVND(totalPayout)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedPeriod} tháng gần đây
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-medium hover:shadow-strong transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tổng Thưởng</CardTitle>
            <Award className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-success">
              +{formatVND(totalBonus)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Đã chi trả
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-medium hover:shadow-strong transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tổng Phạt</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-destructive">
              -{formatVND(totalDeductions)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Đã khấu trừ
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-medium hover:shadow-strong transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Lương TB</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              {formatVND(avgSalary)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Trung bình
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-medium hover:shadow-strong transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tổng NV</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              {totalEmployees}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Đang nhận lương
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-4">
        <Calendar className="h-5 w-5 text-muted-foreground" />
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">3 tháng gần đây</SelectItem>
            <SelectItem value="6">6 tháng gần đây</SelectItem>
            <SelectItem value="12">12 tháng gần đây</SelectItem>
            <SelectItem value="24">24 tháng gần đây</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Charts */}
      <Tabs defaultValue="trend" className="w-full">
        <TabsList className="bg-secondary shadow-soft flex-wrap h-auto p-1">
          <TabsTrigger value="trend" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Xu Hướng
          </TabsTrigger>
          <TabsTrigger value="bonuspenalty" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Thưởng vs Phạt
          </TabsTrigger>
          <TabsTrigger value="breakdown" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Phân Tích Chi Tiết
          </TabsTrigger>
          <TabsTrigger value="comparison" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            So Sánh NV
          </TabsTrigger>
        </TabsList>

        {/* Trend Chart */}
        <TabsContent value="trend" className="mt-6">
          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle>Xu Hướng Lương Theo Tháng</CardTitle>
              <CardDescription>
                Biểu đồ tổng chi lương, thưởng và phạt theo từng tháng
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={monthlyTrends}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
                  <Tooltip
                    formatter={(value: number) => formatVND(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Tổng Chi Lương"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#colorTotal)"
                  />
                  <Area
                    type="monotone"
                    dataKey="avgSalary"
                    name="Lương Trung Bình"
                    stroke="hsl(var(--muted-foreground))"
                    fillOpacity={0.3}
                    fill="hsl(var(--muted))"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bonus vs Penalty Comparison */}
        <TabsContent value="bonuspenalty" className="mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-success" />
                  Thưởng Theo Tháng
                </CardTitle>
                <CardDescription>So sánh các loại thưởng theo tháng</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
                    <Tooltip
                      formatter={(value: number) => formatVND(value)}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="kpiBonus" name="KPI" fill="#10b981" stackId="bonus" />
                    <Bar dataKey="salesBonus" name="Doanh số" fill="#34d399" stackId="bonus" />
                    <Bar dataKey="weekendBonus" name="Cuối tuần" fill="#6ee7b7" stackId="bonus" />
                    <Bar dataKey="otherBonus" name="Khác" fill="#a7f3d0" stackId="bonus" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Minus className="h-5 w-5 text-destructive" />
                  Phạt Theo Tháng
                </CardTitle>
                <CardDescription>So sánh các loại phạt theo tháng</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
                    <Tooltip
                      formatter={(value: number) => formatVND(value)}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="latePenalty" name="Đi muộn" fill="#ef4444" stackId="penalty" />
                    <Bar dataKey="absencePenalty" name="Nghỉ KP" fill="#f87171" stackId="penalty" />
                    <Bar dataKey="violationPenalty" name="Vi phạm" fill="#fca5a5" stackId="penalty" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Combined comparison */}
            <Card className="shadow-medium md:col-span-2">
              <CardHeader>
                <CardTitle>So Sánh Thưởng vs Phạt Theo Tháng</CardTitle>
                <CardDescription>Biểu đồ so sánh tổng thưởng và tổng phạt</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={monthlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
                    <Tooltip
                      formatter={(value: number) => formatVND(value)}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="totalBonus" name="Tổng Thưởng" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="totalDeductions" name="Tổng Phạt" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="Tổng Thu Nhập"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Breakdown Pie Charts */}
        <TabsContent value="breakdown" className="mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-success">
                  <Award className="h-5 w-5" />
                  Phân Bổ Thưởng
                </CardTitle>
                <CardDescription>Tỷ lệ các loại thưởng trong kỳ</CardDescription>
              </CardHeader>
              <CardContent>
                {bonusBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={bonusBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={100}
                        dataKey="value"
                      >
                        {bonusBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatVND(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    Không có dữ liệu thưởng
                  </div>
                )}
                <div className="space-y-2 mt-4">
                  {bonusBreakdown.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span>{item.name}</span>
                      </div>
                      <span className="font-semibold text-success">{formatVND(item.value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Phân Bổ Phạt
                </CardTitle>
                <CardDescription>Tỷ lệ các loại phạt trong kỳ</CardDescription>
              </CardHeader>
              <CardContent>
                {penaltyBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={penaltyBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={100}
                        dataKey="value"
                      >
                        {penaltyBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatVND(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    Không có dữ liệu phạt
                  </div>
                )}
                <div className="space-y-2 mt-4">
                  {penaltyBreakdown.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span>{item.name}</span>
                      </div>
                      <span className="font-semibold text-destructive">{formatVND(item.value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Employee Comparison */}
        <TabsContent value="comparison" className="mt-6">
          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle>Top 10 Nhân Viên - Lương Cao Nhất</CardTitle>
              <CardDescription>
                So sánh lương cơ bản, thưởng và phạt giữa các nhân viên (tháng gần nhất)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={employeeComparisons} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
                  <YAxis dataKey="name" type="category" width={150} />
                  <Tooltip
                    formatter={(value: number) => formatVND(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="salary" name="Lương Cơ Bản" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="bonus" name="Thưởng" fill="#10b981" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="deductions" name="Phạt" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SalaryStatistics;
