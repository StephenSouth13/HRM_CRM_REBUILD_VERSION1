import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatVND, calculateSalary, calculateWorkingData } from "@/lib/salary-utils";
import { 
  Plus, DollarSign, TrendingUp, Clock, Download, FileSpreadsheet,
  Users, Calculator, Settings, Award, AlertTriangle, Eye, Edit, Banknote, Zap, RefreshCw
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import { SkeletonStatCard } from "@/components/ui/skeleton-card";
import * as XLSX from 'xlsx';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Salary {
  id: string;
  user_id: string;
  month: string;
  base_salary: number;
  bonus: number;
  deductions: number;
  net_salary: number;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  // Detailed fields
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

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface SalarySettings {
  id: string;
  default_shift_rate: number;
  default_overtime_rate: number;
  late_penalty_per_time: number;
  absence_penalty_per_day: number;
}

const SalaryManagement = () => {
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [attendanceValidations, setAttendanceValidations] = useState<any[]>([]);
  const [settings, setSettings] = useState<SalarySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isAutoCalcDialogOpen, setIsAutoCalcDialogOpen] = useState(false);
  const [autoCalcMonth, setAutoCalcMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [autoCalcLoading, setAutoCalcLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [viewingSalary, setViewingSalary] = useState<Salary | null>(null);
  const [editingSalary, setEditingSalary] = useState<Salary | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    working_days: 0,
    shift_rate: 200000,
    overtime_hours: 0,
    overtime_rate: 30000,
    kpi_bonus: 0,
    sales_bonus: 0,
    weekend_bonus: 0,
    other_bonus: 0,
    late_count: 0,
    late_penalty: 0,
    absence_count: 0,
    absence_penalty: 0,
    violation_penalty: 0,
    violation_notes: "",
    notes: ""
  });

  const [settingsForm, setSettingsForm] = useState({
    default_shift_rate: 200000,
    default_overtime_rate: 30000,
    late_penalty_per_time: 50000,
    absence_penalty_per_day: 200000
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [salaryRes, profileRes, attendanceRes, validationsRes, settingsRes] = await Promise.all([
        supabase.from('salaries').select('*').order('month', { ascending: false }),
        supabase.from('profiles').select('id, first_name, last_name, email, shift_id'),
        supabase.from('attendance').select('user_id, timestamp, type').order('timestamp', { ascending: false }),
        supabase.from('attendance_validations').select('attendance_id, is_on_time, minutes_late'),
        supabase.from('salary_settings').select('*').maybeSingle()
      ]);

      if (salaryRes.error) throw salaryRes.error;
      if (profileRes.error) throw profileRes.error;
      if (attendanceRes.error) throw attendanceRes.error;

      setSalaries(salaryRes.data || []);
      setProfiles(profileRes.data || []);
      setAttendanceData(attendanceRes.data || []);
      setAttendanceValidations(validationsRes.data || []);
      
      if (settingsRes.data) {
        setSettings(settingsRes.data);
        setSettingsForm({
          default_shift_rate: Number(settingsRes.data.default_shift_rate),
          default_overtime_rate: Number(settingsRes.data.default_overtime_rate),
          late_penalty_per_time: Number(settingsRes.data.late_penalty_per_time),
          absence_penalty_per_day: Number(settingsRes.data.absence_penalty_per_day)
        });
        setFormData(prev => ({
          ...prev,
          shift_rate: Number(settingsRes.data.default_shift_rate),
          overtime_rate: Number(settingsRes.data.default_overtime_rate)
        }));
      }
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

  // Calculate working data from attendance
  const calculateWorkingData = (userId: string, month: string) => {
    const monthStart = new Date(month + '-01');
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

    const userAttendance = attendanceData.filter(a => {
      const date = new Date(a.timestamp);
      return a.user_id === userId && date >= monthStart && date <= monthEnd;
    });

    const dateGroups: { [key: string]: any[] } = {};
    userAttendance.forEach(record => {
      const date = record.timestamp.split('T')[0];
      if (!dateGroups[date]) dateGroups[date] = [];
      dateGroups[date].push(record);
    });

    let workingDays = 0;
    let totalHours = 0;
    let overtimeHours = 0;

    Object.values(dateGroups).forEach(dayRecords => {
      const checkIn = dayRecords.find(r => r.type === 'check_in');
      const checkOut = dayRecords.find(r => r.type === 'check_out');
      
      if (checkIn && checkOut) {
        workingDays++;
        const hours = (new Date(checkOut.timestamp).getTime() - new Date(checkIn.timestamp).getTime()) / (1000 * 60 * 60);
        totalHours += hours;
        if (hours > 8) {
          overtimeHours += hours - 8;
        }
      }
    });

    return { workingDays, totalHours: Math.round(totalHours * 100) / 100, overtimeHours: Math.round(overtimeHours * 100) / 100 };
  };

  // Auto calculate salary when user/month changes
  const handleUserOrMonthChange = (userId: string, month: string) => {
    if (userId && month) {
      const { workingDays, overtimeHours } = calculateWorkingData(userId, month);
      setFormData(prev => ({
        ...prev,
        working_days: workingDays,
        overtime_hours: overtimeHours,
        late_penalty: prev.late_count * (settings?.late_penalty_per_time || 50000),
        absence_penalty: prev.absence_count * (settings?.absence_penalty_per_day || 200000)
      }));
    }
  };

  const calculateTotals = () => {
    const baseSalary = formData.working_days * formData.shift_rate;
    const overtimePay = formData.overtime_hours * formData.overtime_rate;
    const totalBonus = formData.kpi_bonus + formData.sales_bonus + formData.weekend_bonus + formData.other_bonus;
    const totalDeductions = formData.late_penalty + formData.absence_penalty + formData.violation_penalty;
    const netSalary = baseSalary + overtimePay + totalBonus - totalDeductions;

    return { baseSalary, overtimePay, totalBonus, totalDeductions, netSalary };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser || !selectedMonth) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn nhân viên và tháng",
        variant: "destructive"
      });
      return;
    }

    const { baseSalary, overtimePay, totalBonus, totalDeductions, netSalary } = calculateTotals();

    try {
      const { error } = await supabase
        .from('salaries')
        .upsert({
          user_id: selectedUser,
          month: selectedMonth + '-01',
          base_salary: baseSalary + overtimePay,
          bonus: totalBonus,
          deductions: totalDeductions,
          net_salary: netSalary,
          working_days: formData.working_days,
          shift_rate: formData.shift_rate,
          overtime_hours: formData.overtime_hours,
          overtime_rate: formData.overtime_rate,
          kpi_bonus: formData.kpi_bonus,
          sales_bonus: formData.sales_bonus,
          weekend_bonus: formData.weekend_bonus,
          other_bonus: formData.other_bonus,
          late_count: formData.late_count,
          late_penalty: formData.late_penalty,
          absence_count: formData.absence_count,
          absence_penalty: formData.absence_penalty,
          violation_penalty: formData.violation_penalty,
          violation_notes: formData.violation_notes || null,
          notes: formData.notes || null,
          status: 'draft'
        });

      if (error) throw error;

      // Send email notification for new salary
      try {
        await supabase.functions.invoke('send-salary-email', {
          body: {
            type: 'new_salary',
            userId: selectedUser,
            month: selectedMonth,
            netSalary: netSalary
          }
        });
        console.log('New salary email sent successfully');
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
      }

      toast({
        title: "Thành công",
        description: "Đã lưu bảng lương và gửi thông báo"
      });

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleUpdateStatus = async (salaryId: string, status: string) => {
    try {
      // Get salary details first
      const salary = salaries.find(s => s.id === salaryId);
      
      const { error } = await supabase
        .from('salaries')
        .update({ status })
        .eq('id', salaryId);

      if (error) throw error;

      // Send email notification when status changes to 'paid'
      if (status === 'paid' && salary) {
        try {
          await supabase.functions.invoke('send-salary-email', {
            body: {
              type: 'salary_paid',
              userId: salary.user_id,
              month: format(new Date(salary.month), 'MM/yyyy'),
              netSalary: Number(salary.net_salary)
            }
          });
          console.log('Salary paid email sent successfully');
        } catch (emailError) {
          console.error('Failed to send email notification:', emailError);
        }
      }

      toast({
        title: "Thành công",
        description: `Đã cập nhật trạng thái thành ${status === 'paid' ? 'Đã thanh toán' : status === 'pending' ? 'Chờ xử lý' : 'Nháp'}`
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleSaveSettings = async () => {
    try {
      const { error } = await supabase
        .from('salary_settings')
        .upsert({
          id: settings?.id,
          ...settingsForm
        });

      if (error) throw error;

      toast({
        title: "Thành công",
        description: "Đã lưu cài đặt lương"
      });

      setIsSettingsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      working_days: 0,
      shift_rate: settings?.default_shift_rate || 200000,
      overtime_hours: 0,
      overtime_rate: settings?.default_overtime_rate || 30000,
      kpi_bonus: 0,
      sales_bonus: 0,
      weekend_bonus: 0,
      other_bonus: 0,
      late_count: 0,
      late_penalty: 0,
      absence_count: 0,
      absence_penalty: 0,
      violation_penalty: 0,
      violation_notes: "",
      notes: ""
    });
    setSelectedUser("");
    setSelectedMonth(format(new Date(), 'yyyy-MM'));
  };

  // Auto calculate salary for all users in a month
  const handleAutoCalculateSalaries = async () => {
    if (!autoCalcMonth) return;
    
    setAutoCalcLoading(true);
    try {
      const monthStart = new Date(autoCalcMonth + '-01');
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
      
      // Get attendance data for the selected month with validations
      const { data: monthAttendance, error: attError } = await supabase
        .from('attendance')
        .select(`
          id,
          user_id,
          timestamp,
          type,
          attendance_validations (
            is_on_time,
            minutes_late
          )
        `)
        .gte('timestamp', monthStart.toISOString())
        .lte('timestamp', monthEnd.toISOString());
      
      if (attError) throw attError;
      
      // Group attendance by user
      const userAttendance: Record<string, any[]> = {};
      (monthAttendance || []).forEach(record => {
        if (!userAttendance[record.user_id]) {
          userAttendance[record.user_id] = [];
        }
        userAttendance[record.user_id].push(record);
      });
      
      const salaryRate = settings?.default_shift_rate || 200000;
      const otRate = settings?.default_overtime_rate || 30000;
      const latePenaltyPerTime = settings?.late_penalty_per_time || 50000;
      
      let createdCount = 0;
      
      // Calculate salary for each user
      for (const userId of Object.keys(userAttendance)) {
        const records = userAttendance[userId];
        
        // Group by date
        const dateGroups: Record<string, any[]> = {};
        records.forEach(r => {
          const date = r.timestamp.split('T')[0];
          if (!dateGroups[date]) dateGroups[date] = [];
          dateGroups[date].push(r);
        });
        
        let workingDays = 0;
        let overtimeHours = 0;
        let lateCount = 0;
        
        Object.values(dateGroups).forEach(dayRecords => {
          const checkIn = dayRecords.find(r => r.type === 'check_in');
          const checkOut = dayRecords.find(r => r.type === 'check_out');
          
          if (checkIn && checkOut) {
            workingDays++;
            const hours = (new Date(checkOut.timestamp).getTime() - new Date(checkIn.timestamp).getTime()) / (1000 * 60 * 60);
            if (hours > 8) {
              overtimeHours += hours - 8;
            }
            
            // Check for late arrival from validation
            const validation = checkIn.attendance_validations?.[0];
            if (validation && !validation.is_on_time && validation.minutes_late > 5) {
              lateCount++;
            }
          }
        });
        
        const baseSalary = workingDays * salaryRate;
        const overtimePay = Math.round(overtimeHours) * otRate;
        const latePenalty = lateCount * latePenaltyPerTime;
        const netSalary = baseSalary + overtimePay - latePenalty;
        
        // Upsert salary record
        const { error } = await supabase
          .from('salaries')
          .upsert({
            user_id: userId,
            month: autoCalcMonth + '-01',
            base_salary: baseSalary + overtimePay,
            bonus: 0,
            deductions: latePenalty,
            net_salary: netSalary,
            working_days: workingDays,
            shift_rate: salaryRate,
            overtime_hours: Math.round(overtimeHours * 100) / 100,
            overtime_rate: otRate,
            kpi_bonus: 0,
            sales_bonus: 0,
            weekend_bonus: 0,
            other_bonus: 0,
            late_count: lateCount,
            late_penalty: latePenalty,
            absence_count: 0,
            absence_penalty: 0,
            violation_penalty: 0,
            status: 'draft',
            notes: 'Tự động tính từ chấm công'
          }, { onConflict: 'user_id,month' });
        
        if (!error) createdCount++;
      }
      
      toast({
        title: "Thành công",
        description: `Đã tự động tính lương cho ${createdCount} nhân viên tháng ${autoCalcMonth}`
      });
      
      setIsAutoCalcDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setAutoCalcLoading(false);
    }
  };

  const getUserName = (userId: string) => {
    const profile = profiles.find(p => p.id === userId);
    return profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-success/20 text-success">Đã thanh toán</Badge>;
      case 'pending':
        return <Badge className="bg-warning/20 text-warning">Chờ xử lý</Badge>;
      default:
        return <Badge variant="outline">Nháp</Badge>;
    }
  };

  const exportToExcel = () => {
    const exportData = salaries.map(salary => ({
      'Nhân viên': getUserName(salary.user_id),
      'Email': profiles.find(p => p.id === salary.user_id)?.email || '',
      'Tháng': salary.month,
      'Số buổi': salary.working_days || 0,
      'Lương/buổi': Number(salary.shift_rate) || 0,
      'Giờ OT': salary.overtime_hours || 0,
      'Lương OT/giờ': Number(salary.overtime_rate) || 0,
      'Lương cơ bản': Number(salary.base_salary),
      'Thưởng KPI': Number(salary.kpi_bonus) || 0,
      'Thưởng doanh số': Number(salary.sales_bonus) || 0,
      'Thưởng cuối tuần': Number(salary.weekend_bonus) || 0,
      'Thưởng khác': Number(salary.other_bonus) || 0,
      'Tổng thưởng': Number(salary.bonus),
      'Phạt đi muộn': Number(salary.late_penalty) || 0,
      'Phạt nghỉ KP': Number(salary.absence_penalty) || 0,
      'Phạt vi phạm': Number(salary.violation_penalty) || 0,
      'Tổng phạt': Number(salary.deductions),
      'Thực nhận': Number(salary.net_salary),
      'Trạng thái': salary.status === 'paid' ? 'Đã thanh toán' : salary.status === 'pending' ? 'Chờ xử lý' : 'Nháp',
      'Ghi chú': salary.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bảng lương");
    XLSX.writeFile(wb, `Bang_Luong_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    
    toast({
      title: "Xuất file thành công",
      description: "Đã xuất bảng lương ra file Excel"
    });
  };

  const totalPayout = salaries.reduce((sum, s) => sum + Number(s.net_salary), 0);
  const totalBonus = salaries.reduce((sum, s) => sum + Number(s.bonus), 0);
  const totalDeductions = salaries.reduce((sum, s) => sum + Number(s.deductions), 0);
  const avgSalary = salaries.length > 0 ? totalPayout / salaries.length : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid md:grid-cols-4 gap-4">
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
        </div>
        <SkeletonTable rows={8} columns={7} />
      </div>
    );
  }

  const { baseSalary, overtimePay, totalBonus: formTotalBonus, totalDeductions: formTotalDeductions, netSalary } = calculateTotals();

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="shadow-medium overflow-hidden relative group hover:shadow-strong transition-all">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng chi trả</CardTitle>
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold">{formatVND(totalPayout)}</div>
            <p className="text-xs text-muted-foreground mt-1">Tất cả thời gian</p>
          </CardContent>
        </Card>

        <Card className="shadow-medium overflow-hidden relative group hover:shadow-strong transition-all">
          <div className="absolute inset-0 bg-gradient-to-br from-success/10 via-success/5 to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng thưởng</CardTitle>
            <div className="h-10 w-10 rounded-xl bg-success/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Award className="h-5 w-5 text-success" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-success">{formatVND(totalBonus)}</div>
            <p className="text-xs text-muted-foreground mt-1">Đã chi trả</p>
          </CardContent>
        </Card>

        <Card className="shadow-medium overflow-hidden relative group hover:shadow-strong transition-all">
          <div className="absolute inset-0 bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng phạt</CardTitle>
            <div className="h-10 w-10 rounded-xl bg-destructive/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-destructive">{formatVND(totalDeductions)}</div>
            <p className="text-xs text-muted-foreground mt-1">Đã khấu trừ</p>
          </CardContent>
        </Card>

        <Card className="shadow-medium overflow-hidden relative group hover:shadow-strong transition-all">
          <div className="absolute inset-0 bg-gradient-to-br from-warning/10 via-warning/5 to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lương TB</CardTitle>
            <div className="h-10 w-10 rounded-xl bg-warning/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <TrendingUp className="h-5 w-5 text-warning" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold">{formatVND(avgSalary)}</div>
            <p className="text-xs text-muted-foreground mt-1">Mỗi nhân viên</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="shadow-strong">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-primary" />
                Quản lý bảng lương
              </CardTitle>
              <CardDescription>Tính toán và quản lý lương nhân viên theo công thức chi tiết</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Cài đặt
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cài đặt lương mặc định</DialogTitle>
                    <DialogDescription>Thiết lập các giá trị mặc định cho tính lương</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Lương/buổi mặc định</Label>
                        <Input
                          type="number"
                          value={settingsForm.default_shift_rate}
                          onChange={(e) => setSettingsForm({ ...settingsForm, default_shift_rate: Number(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Lương OT/giờ mặc định</Label>
                        <Input
                          type="number"
                          value={settingsForm.default_overtime_rate}
                          onChange={(e) => setSettingsForm({ ...settingsForm, default_overtime_rate: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Phạt đi muộn/lần</Label>
                        <Input
                          type="number"
                          value={settingsForm.late_penalty_per_time}
                          onChange={(e) => setSettingsForm({ ...settingsForm, late_penalty_per_time: Number(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phạt nghỉ KP/ngày</Label>
                        <Input
                          type="number"
                          value={settingsForm.absence_penalty_per_day}
                          onChange={(e) => setSettingsForm({ ...settingsForm, absence_penalty_per_day: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <Button onClick={handleSaveSettings} className="w-full">Lưu cài đặt</Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Button variant="outline" size="sm" onClick={exportToExcel}>
                <Download className="h-4 w-4 mr-2" />
                Xuất Excel
              </Button>

              <Button variant="secondary" size="sm" onClick={() => setIsAutoCalcDialogOpen(true)}>
                <Zap className="h-4 w-4 mr-2" />
                Tự động tính lương
              </Button>

              <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Tạo bảng lương
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Tạo bảng lương mới</DialogTitle>
                    <DialogDescription>Tính toán lương theo công thức: Lương = (Số buổi × Lương/buổi) + (Giờ OT × Lương OT) + Thưởng - Phạt</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Employee & Month Selection */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nhân viên</Label>
                        <Select value={selectedUser} onValueChange={(value) => {
                          setSelectedUser(value);
                          handleUserOrMonthChange(value, selectedMonth);
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn nhân viên" />
                          </SelectTrigger>
                          <SelectContent>
                            {profiles.map(profile => (
                              <SelectItem key={profile.id} value={profile.id}>
                                {profile.first_name} {profile.last_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Tháng</Label>
                        <Input
                          type="month"
                          value={selectedMonth}
                          onChange={(e) => {
                            setSelectedMonth(e.target.value);
                            handleUserOrMonthChange(selectedUser, e.target.value);
                          }}
                          required
                        />
                      </div>
                    </div>

                    {/* Working Info */}
                    <div className="p-4 bg-muted/30 rounded-xl space-y-4">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        Thông tin công
                      </h4>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label>Số buổi làm</Label>
                          <Input
                            type="number"
                            value={formData.working_days}
                            onChange={(e) => setFormData({ ...formData, working_days: Number(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Lương/buổi (₫)</Label>
                          <Input
                            type="number"
                            value={formData.shift_rate}
                            onChange={(e) => setFormData({ ...formData, shift_rate: Number(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Giờ tăng ca</Label>
                          <Input
                            type="number"
                            step="0.5"
                            value={formData.overtime_hours}
                            onChange={(e) => setFormData({ ...formData, overtime_hours: Number(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Lương OT/giờ (₫)</Label>
                          <Input
                            type="number"
                            value={formData.overtime_rate}
                            onChange={(e) => setFormData({ ...formData, overtime_rate: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <p className="text-sm">
                          <span className="text-muted-foreground">Lương cơ bản: </span>
                          <span className="font-bold">{formatVND(baseSalary)}</span>
                          <span className="text-muted-foreground"> + Lương OT: </span>
                          <span className="font-bold">{formatVND(overtimePay)}</span>
                          <span className="text-muted-foreground"> = </span>
                          <span className="font-bold text-primary">{formatVND(baseSalary + overtimePay)}</span>
                        </p>
                      </div>
                    </div>

                    {/* Bonuses */}
                    <div className="p-4 bg-success/5 rounded-xl space-y-4">
                      <h4 className="font-semibold flex items-center gap-2 text-success">
                        <Award className="h-4 w-4" />
                        Thưởng
                      </h4>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label>Thưởng KPI (₫)</Label>
                          <Input
                            type="number"
                            value={formData.kpi_bonus}
                            onChange={(e) => setFormData({ ...formData, kpi_bonus: Number(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Thưởng doanh số (₫)</Label>
                          <Input
                            type="number"
                            value={formData.sales_bonus}
                            onChange={(e) => setFormData({ ...formData, sales_bonus: Number(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Thưởng cuối tuần (₫)</Label>
                          <Input
                            type="number"
                            value={formData.weekend_bonus}
                            onChange={(e) => setFormData({ ...formData, weekend_bonus: Number(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Thưởng khác (₫)</Label>
                          <Input
                            type="number"
                            value={formData.other_bonus}
                            onChange={(e) => setFormData({ ...formData, other_bonus: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                      <div className="p-3 bg-success/10 rounded-lg">
                        <p className="text-sm">
                          <span className="text-muted-foreground">Tổng thưởng: </span>
                          <span className="font-bold text-success">+{formatVND(formTotalBonus)}</span>
                        </p>
                      </div>
                    </div>

                    {/* Deductions */}
                    <div className="p-4 bg-destructive/5 rounded-xl space-y-4">
                      <h4 className="font-semibold flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                        Phạt / Khấu trừ
                      </h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Số lần đi muộn</Label>
                          <Input
                            type="number"
                            value={formData.late_count}
                            onChange={(e) => {
                              const count = Number(e.target.value);
                              setFormData({ 
                                ...formData, 
                                late_count: count,
                                late_penalty: count * (settings?.late_penalty_per_time || 50000)
                              });
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Phạt đi muộn (₫)</Label>
                          <Input
                            type="number"
                            value={formData.late_penalty}
                            onChange={(e) => setFormData({ ...formData, late_penalty: Number(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Số ngày nghỉ KP</Label>
                          <Input
                            type="number"
                            value={formData.absence_count}
                            onChange={(e) => {
                              const count = Number(e.target.value);
                              setFormData({ 
                                ...formData, 
                                absence_count: count,
                                absence_penalty: count * (settings?.absence_penalty_per_day || 200000)
                              });
                            }}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Phạt nghỉ không phép (₫)</Label>
                          <Input
                            type="number"
                            value={formData.absence_penalty}
                            onChange={(e) => setFormData({ ...formData, absence_penalty: Number(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Phạt vi phạm khác (₫)</Label>
                          <Input
                            type="number"
                            value={formData.violation_penalty}
                            onChange={(e) => setFormData({ ...formData, violation_penalty: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Ghi chú vi phạm</Label>
                        <Textarea
                          value={formData.violation_notes}
                          onChange={(e) => setFormData({ ...formData, violation_notes: e.target.value })}
                          placeholder="Mô tả vi phạm (nếu có)..."
                        />
                      </div>
                      <div className="p-3 bg-destructive/10 rounded-lg">
                        <p className="text-sm">
                          <span className="text-muted-foreground">Tổng phạt: </span>
                          <span className="font-bold text-destructive">-{formatVND(formTotalDeductions)}</span>
                        </p>
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                      <Label>Ghi chú</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Ghi chú thêm..."
                      />
                    </div>

                    {/* Summary */}
                    <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-primary" />
                        Tổng kết
                      </h4>
                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div className="p-3 bg-background rounded-lg">
                          <p className="text-xs text-muted-foreground">Lương cơ bản</p>
                          <p className="font-bold">{formatVND(baseSalary + overtimePay)}</p>
                        </div>
                        <div className="p-3 bg-background rounded-lg">
                          <p className="text-xs text-muted-foreground">Thưởng</p>
                          <p className="font-bold text-success">+{formatVND(formTotalBonus)}</p>
                        </div>
                        <div className="p-3 bg-background rounded-lg">
                          <p className="text-xs text-muted-foreground">Phạt</p>
                          <p className="font-bold text-destructive">-{formatVND(formTotalDeductions)}</p>
                        </div>
                        <div className="p-3 bg-primary/20 rounded-lg border-2 border-primary/30">
                          <p className="text-xs text-muted-foreground">Thực nhận</p>
                          <p className="font-bold text-primary text-lg">{formatVND(netSalary)}</p>
                        </div>
                      </div>
                    </div>

                    <Button type="submit" className="w-full">Lưu bảng lương</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Nhân viên</TableHead>
                  <TableHead>Tháng</TableHead>
                  <TableHead className="text-right">Số buổi</TableHead>
                  <TableHead className="text-right">Lương cơ bản</TableHead>
                  <TableHead className="text-right">Thưởng</TableHead>
                  <TableHead className="text-right">Phạt</TableHead>
                  <TableHead className="text-right">Thực nhận</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                      <Banknote className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>Chưa có bảng lương nào</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  salaries.map((salary) => (
                    <TableRow key={salary.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{getUserName(salary.user_id)}</TableCell>
                      <TableCell>{format(new Date(salary.month), 'MM/yyyy')}</TableCell>
                      <TableCell className="text-right">{salary.working_days || 0}</TableCell>
                      <TableCell className="text-right">{formatVND(Number(salary.base_salary))}</TableCell>
                      <TableCell className="text-right text-success">+{formatVND(Number(salary.bonus))}</TableCell>
                      <TableCell className="text-right text-destructive">-{formatVND(Number(salary.deductions))}</TableCell>
                      <TableCell className="text-right font-bold">{formatVND(Number(salary.net_salary))}</TableCell>
                      <TableCell>{getStatusBadge(salary.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setViewingSalary(salary)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Select
                            value={salary.status}
                            onValueChange={(value) => handleUpdateStatus(salary.id, value)}
                          >
                            <SelectTrigger className="w-[100px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">Nháp</SelectItem>
                              <SelectItem value="pending">Chờ xử lý</SelectItem>
                              <SelectItem value="paid">Đã thanh toán</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* View Salary Details Dialog */}
      <Dialog open={!!viewingSalary} onOpenChange={() => setViewingSalary(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chi tiết bảng lương</DialogTitle>
            <DialogDescription>
              {viewingSalary && `${getUserName(viewingSalary.user_id)} - Tháng ${format(new Date(viewingSalary.month), 'MM/yyyy')}`}
            </DialogDescription>
          </DialogHeader>
          {viewingSalary && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 bg-muted/30 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Lương cơ bản</p>
                  <p className="font-bold">{formatVND(Number(viewingSalary.base_salary))}</p>
                </div>
                <div className="p-3 bg-success/10 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Thưởng</p>
                  <p className="font-bold text-success">+{formatVND(Number(viewingSalary.bonus))}</p>
                </div>
                <div className="p-3 bg-destructive/10 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Phạt</p>
                  <p className="font-bold text-destructive">-{formatVND(Number(viewingSalary.deductions))}</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg text-center border-2 border-primary/20">
                  <p className="text-xs text-muted-foreground">Thực nhận</p>
                  <p className="font-bold text-primary">{formatVND(Number(viewingSalary.net_salary))}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-3 bg-muted/20 rounded-lg space-y-2">
                  <h4 className="font-semibold text-sm">Thông tin công</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Số buổi:</span>
                      <span>{viewingSalary.working_days || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lương/buổi:</span>
                      <span>{formatVND(Number(viewingSalary.shift_rate) || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Giờ OT:</span>
                      <span>{viewingSalary.overtime_hours || 0}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lương OT/giờ:</span>
                      <span>{formatVND(Number(viewingSalary.overtime_rate) || 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-success/5 rounded-lg space-y-2">
                  <h4 className="font-semibold text-sm text-success">Chi tiết thưởng</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">KPI:</span>
                      <span className="text-success">{formatVND(Number(viewingSalary.kpi_bonus) || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Doanh số:</span>
                      <span className="text-success">{formatVND(Number(viewingSalary.sales_bonus) || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cuối tuần:</span>
                      <span className="text-success">{formatVND(Number(viewingSalary.weekend_bonus) || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Khác:</span>
                      <span className="text-success">{formatVND(Number(viewingSalary.other_bonus) || 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-destructive/5 rounded-lg space-y-2">
                  <h4 className="font-semibold text-sm text-destructive">Chi tiết phạt</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Đi muộn ({viewingSalary.late_count || 0}x):</span>
                      <span className="text-destructive">{formatVND(Number(viewingSalary.late_penalty) || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nghỉ KP ({viewingSalary.absence_count || 0}d):</span>
                      <span className="text-destructive">{formatVND(Number(viewingSalary.absence_penalty) || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vi phạm:</span>
                      <span className="text-destructive">{formatVND(Number(viewingSalary.violation_penalty) || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {viewingSalary.notes && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">{viewingSalary.notes}</p>
                </div>
              )}
              {viewingSalary.violation_notes && (
                <div className="p-3 bg-destructive/10 rounded-lg">
                  <p className="text-sm text-destructive/80">{viewingSalary.violation_notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Auto Calculate Salary Dialog */}
      <AlertDialog open={isAutoCalcDialogOpen} onOpenChange={setIsAutoCalcDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-warning" />
              Tự động tính lương từ chấm công
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                Hệ thống sẽ tự động tính lương cho tất cả nhân viên dựa trên dữ liệu chấm công của tháng đã chọn.
              </p>
              <div className="space-y-2">
                <Label>Chọn tháng</Label>
                <Input
                  type="month"
                  value={autoCalcMonth}
                  onChange={(e) => setAutoCalcMonth(e.target.value)}
                />
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                <p><strong>Công thức tính:</strong></p>
                <p>• Lương cơ bản = Số buổi làm × Lương/buổi ({formatVND(settings?.default_shift_rate || 200000)})</p>
                <p>• Lương OT = Số giờ OT × Lương OT/giờ ({formatVND(settings?.default_overtime_rate || 30000)})</p>
                <p>• Phạt đi muộn = Số lần đi muộn × {formatVND(settings?.late_penalty_per_time || 50000)}/lần</p>
                <p>• <strong>Thực nhận = Lương cơ bản + OT - Phạt</strong></p>
              </div>
              <p className="text-warning text-sm">
                ⚠️ Lưu ý: Thưởng KPI, doanh số và các khoản khác cần được điều chỉnh thủ công sau khi tính tự động.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={autoCalcLoading}>Hủy</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleAutoCalculateSalaries}
              disabled={autoCalcLoading}
              className="bg-primary"
            >
              {autoCalcLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Đang tính...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Tự động tính lương
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SalaryManagement;
