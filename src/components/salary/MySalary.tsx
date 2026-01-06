import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { formatVND } from "@/lib/salary-utils";
import { 
  DollarSign, TrendingUp, TrendingDown, Calendar, Wallet, 
  CreditCard, Receipt, Sparkles, ChevronDown, ChevronUp,
  Clock, AlertTriangle, Award, Target, Banknote, Timer,
  MessageSquare, Send, Bug
} from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

interface Salary {
  id: string;
  month: string;
  base_salary: number;
  bonus: number;
  deductions: number;
  net_salary: number;
  notes: string | null;
  status: string;
  created_at: string;
  // New detailed fields
  working_days: number;
  shift_rate: number;
  overtime_hours: number;
  overtime_rate: number;
  kpi_bonus: number;
  sales_bonus: number;
  weekend_bonus: number;
  other_bonus: number;
  late_penalty: number;
  absence_penalty: number;
  violation_penalty: number;
  late_count: number;
  absence_count: number;
  violation_notes: string | null;
}

const MySalary = () => {
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [isProposalOpen, setIsProposalOpen] = useState(false);
  const [isErrorReportOpen, setIsErrorReportOpen] = useState(false);
  const [proposalText, setProposalText] = useState("");
  const [errorText, setErrorText] = useState("");
  const [sendingProposal, setSendingProposal] = useState(false);
  const [sendingError, setSendingError] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchMySalaries();
  }, [selectedYear]);

  const fetchMySalaries = async () => {
    try {
      setLoading(true);
      const user = await getCurrentUser();
      if (!user) return;
      
      setCurrentUser(user);

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        setCurrentUser({ ...user, ...profile });
      }

      const { data, error } = await supabase
        .from('salaries')
        .select('*')
        .eq('user_id', user.id)
        .gte('month', `${selectedYear}-01-01`)
        .lte('month', `${selectedYear}-12-31`)
        .order('month', { ascending: false });

      if (error) throw error;
      setSalaries(data || []);
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendProposal = async () => {
    if (!proposalText.trim()) {
      toast({ title: "Lỗi", description: "Vui lòng nhập nội dung kiến nghị", variant: "destructive" });
      return;
    }

    setSendingProposal(true);
    try {
      await supabase.functions.invoke('send-salary-email', {
        body: {
          type: 'salary_proposal',
          proposalDetails: proposalText,
          reporterEmail: currentUser?.email,
          reporterName: `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim() || currentUser?.email
        }
      });

      toast({ title: "Thành công", description: "Kiến nghị đã được gửi đến Admin" });
      setProposalText("");
      setIsProposalOpen(false);
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } finally {
      setSendingProposal(false);
    }
  };

  const handleSendErrorReport = async () => {
    if (!errorText.trim()) {
      toast({ title: "Lỗi", description: "Vui lòng mô tả lỗi gặp phải", variant: "destructive" });
      return;
    }

    setSendingError(true);
    try {
      await supabase.functions.invoke('send-salary-email', {
        body: {
          type: 'error_report',
          errorDetails: errorText,
          reporterEmail: currentUser?.email,
          reporterName: `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim() || currentUser?.email
        }
      });

      toast({ title: "Thành công", description: "Báo lỗi đã được gửi đến Admin" });
      setErrorText("");
      setIsErrorReportOpen(false);
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } finally {
      setSendingError(false);
    }
  };

  const formatMonth = (monthStr: string) => {
    const date = new Date(monthStr);
    return format(date, 'MMMM yyyy', { locale: vi });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-success/20 text-success border-success/30">Đã thanh toán</Badge>;
      case 'pending':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Chờ xử lý</Badge>;
      default:
        return <Badge variant="outline">Nháp</Badge>;
    }
  };

  // Calculate statistics
  const totalYearlyIncome = salaries.reduce((sum, s) => sum + Number(s.net_salary || 0), 0);
  const totalBonus = salaries.reduce((sum, s) => sum + Number(s.bonus || 0), 0);
  const totalDeductions = salaries.reduce((sum, s) => sum + Number(s.deductions || 0), 0);
  const avgMonthlySalary = salaries.length > 0 ? totalYearlyIncome / salaries.length : 0;
  const totalOvertimeHours = salaries.reduce((sum, s) => sum + Number(s.overtime_hours || 0), 0);
  const totalWorkingDays = salaries.reduce((sum, s) => sum + Number(s.working_days || 0), 0);

  // Get current month and last month for comparison
  const currentMonthSalary = salaries[0];
  const lastMonthSalary = salaries[1];
  const salaryChange = currentMonthSalary && lastMonthSalary 
    ? ((Number(currentMonthSalary.net_salary) - Number(lastMonthSalary.net_salary)) / Number(lastMonthSalary.net_salary)) * 100 
    : 0;

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Đang tải dữ liệu lương...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent flex items-center gap-2">
            <Wallet className="h-8 w-8 text-primary" />
            Lương & Thưởng
          </h2>
          <p className="text-muted-foreground mt-1">Thông tin chi tiết về thu nhập của bạn</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Proposal Dialog */}
          <Dialog open={isProposalOpen} onOpenChange={setIsProposalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <MessageSquare className="h-4 w-4 mr-2" />
                Kiến nghị
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-warning" />
                  Kiến nghị lương thưởng
                </DialogTitle>
                <DialogDescription>
                  Gửi kiến nghị về lương thưởng đến Admin để xem xét
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nội dung kiến nghị</Label>
                  <Textarea
                    placeholder="Mô tả chi tiết kiến nghị của bạn..."
                    value={proposalText}
                    onChange={(e) => setProposalText(e.target.value)}
                    rows={5}
                  />
                </div>
                <Button onClick={handleSendProposal} disabled={sendingProposal} className="w-full">
                  {sendingProposal ? (
                    <>Đang gửi...</>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Gửi kiến nghị
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Error Report Dialog */}
          <Dialog open={isErrorReportOpen} onOpenChange={setIsErrorReportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                <Bug className="h-4 w-4 mr-2" />
                Báo lỗi
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <Bug className="h-5 w-5" />
                  Báo lỗi hệ thống lương
                </DialogTitle>
                <DialogDescription>
                  Báo lỗi về thông tin lương không chính xác hoặc lỗi hệ thống
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Mô tả lỗi</Label>
                  <Textarea
                    placeholder="Mô tả chi tiết lỗi bạn gặp phải (tháng, số tiền sai, v.v.)..."
                    value={errorText}
                    onChange={(e) => setErrorText(e.target.value)}
                    rows={5}
                  />
                </div>
                <Button onClick={handleSendErrorReport} disabled={sendingError} className="w-full bg-destructive hover:bg-destructive/90">
                  {sendingError ? (
                    <>Đang gửi...</>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Gửi báo lỗi
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={year}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Statistics Cards - Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-medium overflow-hidden relative group hover:shadow-strong transition-all">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tổng thu nhập</CardTitle>
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold">{formatVND(totalYearlyIncome)}</div>
            <p className="text-xs text-muted-foreground mt-1">Năm {selectedYear}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-medium overflow-hidden relative group hover:shadow-strong transition-all">
          <div className="absolute inset-0 bg-gradient-to-br from-success/10 via-success/5 to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tổng thưởng</CardTitle>
            <div className="h-10 w-10 rounded-xl bg-success/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Sparkles className="h-5 w-5 text-success" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-success">{formatVND(totalBonus)}</div>
            <p className="text-xs text-muted-foreground mt-1">Tổng thưởng trong năm</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-medium overflow-hidden relative group hover:shadow-strong transition-all">
          <div className="absolute inset-0 bg-gradient-to-br from-warning/10 via-warning/5 to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lương TB/tháng</CardTitle>
            <div className="h-10 w-10 rounded-xl bg-warning/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CreditCard className="h-5 w-5 text-warning" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold">{formatVND(avgMonthlySalary)}</div>
            <p className="text-xs text-muted-foreground mt-1">{salaries.length} tháng đã nhận</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-medium overflow-hidden relative group hover:shadow-strong transition-all">
          <div className="absolute inset-0 bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tổng khấu trừ</CardTitle>
            <div className="h-10 w-10 rounded-xl bg-destructive/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Receipt className="h-5 w-5 text-destructive" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-destructive">{formatVND(totalDeductions)}</div>
            <p className="text-xs text-muted-foreground mt-1">Phạt, trừ lương</p>
          </CardContent>
        </Card>
      </div>

      {/* Statistics Cards - Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-medium overflow-hidden relative group hover:shadow-strong transition-all">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tổng ngày công</CardTitle>
            <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold">{totalWorkingDays} ngày</div>
            <p className="text-xs text-muted-foreground mt-1">Số ngày làm việc trong năm</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-medium overflow-hidden relative group hover:shadow-strong transition-all">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tổng tăng ca</CardTitle>
            <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Timer className="h-5 w-5 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold">{totalOvertimeHours.toFixed(1)} giờ</div>
            <p className="text-xs text-muted-foreground mt-1">Số giờ tăng ca trong năm</p>
          </CardContent>
        </Card>
      </div>

      {/* Current Month Highlight */}
      {currentMonthSalary && (
        <Card className="border-0 shadow-strong overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
          <CardHeader className="relative border-b bg-gradient-to-r from-primary/10 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  Tháng gần nhất
                </CardTitle>
                <CardDescription className="capitalize">{formatMonth(currentMonthSalary.month)}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {salaryChange !== 0 && (
                  <Badge className={salaryChange > 0 ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}>
                    {salaryChange > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                    {salaryChange > 0 ? '+' : ''}{salaryChange.toFixed(1)}%
                  </Badge>
                )}
                {getStatusBadge(currentMonthSalary.status)}
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative pt-6 space-y-6">
            {/* Main Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted/30 rounded-xl">
                <p className="text-sm text-muted-foreground mb-1">Lương cơ bản</p>
                <p className="text-xl font-bold">{formatVND(Number(currentMonthSalary.base_salary))}</p>
              </div>
              <div className="text-center p-4 bg-success/10 rounded-xl">
                <p className="text-sm text-muted-foreground mb-1">Thưởng</p>
                <p className="text-xl font-bold text-success">+{formatVND(Number(currentMonthSalary.bonus))}</p>
              </div>
              <div className="text-center p-4 bg-destructive/10 rounded-xl">
                <p className="text-sm text-muted-foreground mb-1">Khấu trừ</p>
                <p className="text-xl font-bold text-destructive">-{formatVND(Number(currentMonthSalary.deductions))}</p>
              </div>
              <div className="text-center p-4 bg-primary/10 rounded-xl border-2 border-primary/20">
                <p className="text-sm text-muted-foreground mb-1">Thực nhận</p>
                <p className="text-xl font-bold text-primary">{formatVND(Number(currentMonthSalary.net_salary))}</p>
              </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="grid md:grid-cols-3 gap-4">
              {/* Working Info */}
              <div className="p-4 bg-muted/20 rounded-xl space-y-3">
                <h4 className="font-semibold flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-primary" />
                  Thông tin công
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Số buổi làm:</span>
                    <span className="font-medium">{currentMonthSalary.working_days || 0} buổi</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lương/buổi:</span>
                    <span className="font-medium">{formatVND(Number(currentMonthSalary.shift_rate) || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Giờ tăng ca:</span>
                    <span className="font-medium">{currentMonthSalary.overtime_hours || 0} giờ</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phụ cấp OT/giờ:</span>
                    <span className="font-medium">{formatVND(Number(currentMonthSalary.overtime_rate) || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Bonus Breakdown */}
              <div className="p-4 bg-success/5 rounded-xl space-y-3">
                <h4 className="font-semibold flex items-center gap-2 text-sm text-success">
                  <Award className="h-4 w-4" />
                  Chi tiết thưởng
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Thưởng KPI:</span>
                    <span className="font-medium text-success">+{formatVND(Number(currentMonthSalary.kpi_bonus) || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Thưởng doanh số:</span>
                    <span className="font-medium text-success">+{formatVND(Number(currentMonthSalary.sales_bonus) || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Thưởng cuối tuần:</span>
                    <span className="font-medium text-success">+{formatVND(Number(currentMonthSalary.weekend_bonus) || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Thưởng khác:</span>
                    <span className="font-medium text-success">+{formatVND(Number(currentMonthSalary.other_bonus) || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions Breakdown */}
              <div className="p-4 bg-destructive/5 rounded-xl space-y-3">
                <h4 className="font-semibold flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Chi tiết khấu trừ
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Đi muộn ({currentMonthSalary.late_count || 0} lần):</span>
                    <span className="font-medium text-destructive">-{formatVND(Number(currentMonthSalary.late_penalty) || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nghỉ không phép ({currentMonthSalary.absence_count || 0} ngày):</span>
                    <span className="font-medium text-destructive">-{formatVND(Number(currentMonthSalary.absence_penalty) || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vi phạm khác:</span>
                    <span className="font-medium text-destructive">-{formatVND(Number(currentMonthSalary.violation_penalty) || 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Salary Formula */}
            <div className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl">
              <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                <Target className="h-4 w-4 text-primary" />
                Công thức tính lương
              </h4>
              <div className="text-sm space-y-1 font-mono bg-background/50 p-3 rounded-lg">
                <p>Lương buổi = {currentMonthSalary.working_days || 0} buổi × {formatVND(Number(currentMonthSalary.shift_rate) || 0)} = <span className="text-primary font-bold">{formatVND((currentMonthSalary.working_days || 0) * (Number(currentMonthSalary.shift_rate) || 0))}</span></p>
                <p>Lương OT = {currentMonthSalary.overtime_hours || 0} giờ × {formatVND(Number(currentMonthSalary.overtime_rate) || 0)} = <span className="text-primary font-bold">{formatVND((currentMonthSalary.overtime_hours || 0) * (Number(currentMonthSalary.overtime_rate) || 0))}</span></p>
                <p className="pt-2 border-t mt-2">
                  <span className="text-success">Thực nhận = Lương buổi + Lương OT + Thưởng - Phạt</span>
                </p>
                <p className="text-lg font-bold text-primary">
                  = {formatVND(Number(currentMonthSalary.net_salary))}
                </p>
              </div>
            </div>

            {currentMonthSalary.notes && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">{currentMonthSalary.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Salary History */}
      <Card className="border-0 shadow-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Lịch sử lương
          </CardTitle>
          <CardDescription>Chi tiết lương theo từng tháng</CardDescription>
        </CardHeader>
        <CardContent>
          {salaries.length === 0 ? (
            <div className="text-center py-12">
              <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="font-medium text-lg">Chưa có dữ liệu lương</p>
              <p className="text-muted-foreground">Dữ liệu lương của bạn sẽ hiển thị ở đây</p>
            </div>
          ) : (
            <div className="space-y-3">
              {salaries.map((salary) => (
                <div 
                  key={salary.id} 
                  className="border rounded-xl overflow-hidden hover:shadow-soft transition-all"
                >
                  <div 
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30"
                    onClick={() => setExpandedMonth(expandedMonth === salary.id ? null : salary.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold capitalize">{formatMonth(salary.month)}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {getStatusBadge(salary.status)}
                          <span className="text-xs text-muted-foreground">
                            {salary.working_days || 0} buổi · {salary.overtime_hours || 0}h OT
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold text-lg">{formatVND(Number(salary.net_salary))}</p>
                        <p className="text-xs text-muted-foreground">Thực nhận</p>
                      </div>
                      {expandedMonth === salary.id ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  
                  {expandedMonth === salary.id && (
                    <div className="px-4 pb-4 pt-2 bg-muted/20 border-t space-y-4">
                      {/* Main breakdown */}
                      <div className="grid grid-cols-4 gap-3">
                        <div className="text-center p-3 bg-background rounded-lg">
                          <p className="text-xs text-muted-foreground">Lương cơ bản</p>
                          <p className="font-semibold">{formatVND(Number(salary.base_salary))}</p>
                        </div>
                        <div className="text-center p-3 bg-background rounded-lg">
                          <p className="text-xs text-muted-foreground">Thưởng</p>
                          <p className="font-semibold text-success">+{formatVND(Number(salary.bonus))}</p>
                        </div>
                        <div className="text-center p-3 bg-background rounded-lg">
                          <p className="text-xs text-muted-foreground">Khấu trừ</p>
                          <p className="font-semibold text-destructive">-{formatVND(Number(salary.deductions))}</p>
                        </div>
                        <div className="text-center p-3 bg-background rounded-lg border border-primary/20">
                          <p className="text-xs text-muted-foreground">Thực nhận</p>
                          <p className="font-semibold text-primary">{formatVND(Number(salary.net_salary))}</p>
                        </div>
                      </div>

                      {/* Detailed breakdown */}
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="p-3 bg-success/5 rounded-lg">
                          <p className="text-xs font-medium text-success mb-2">Chi tiết thưởng</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex justify-between">
                              <span>KPI:</span>
                              <span className="text-success">{formatVND(Number(salary.kpi_bonus) || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Doanh số:</span>
                              <span className="text-success">{formatVND(Number(salary.sales_bonus) || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Cuối tuần:</span>
                              <span className="text-success">{formatVND(Number(salary.weekend_bonus) || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Khác:</span>
                              <span className="text-success">{formatVND(Number(salary.other_bonus) || 0)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="p-3 bg-destructive/5 rounded-lg">
                          <p className="text-xs font-medium text-destructive mb-2">Chi tiết phạt</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex justify-between">
                              <span>Đi muộn ({salary.late_count || 0}x):</span>
                              <span className="text-destructive">{formatVND(Number(salary.late_penalty) || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Nghỉ KP ({salary.absence_count || 0}d):</span>
                              <span className="text-destructive">{formatVND(Number(salary.absence_penalty) || 0)}</span>
                            </div>
                            <div className="flex justify-between col-span-2">
                              <span>Vi phạm khác:</span>
                              <span className="text-destructive">{formatVND(Number(salary.violation_penalty) || 0)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {salary.notes && (
                        <p className="text-sm text-muted-foreground p-2 bg-background rounded-lg">{salary.notes}</p>
                      )}
                      {salary.violation_notes && (
                        <p className="text-sm text-destructive/80 p-2 bg-destructive/5 rounded-lg">{salary.violation_notes}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MySalary;
