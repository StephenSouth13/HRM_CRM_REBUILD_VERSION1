import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  shift_id: string | null;
  team_id: string | null;
}

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
}

interface ShiftSchedule {
  id: string;
  user_id: string;
  shift_id: string;
  day_of_week: number;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "CN", fullLabel: "Chủ Nhật" },
  { value: 1, label: "T2", fullLabel: "Thứ Hai" },
  { value: 2, label: "T3", fullLabel: "Thứ Ba" },
  { value: 3, label: "T4", fullLabel: "Thứ Tư" },
  { value: 4, label: "T5", fullLabel: "Thứ Năm" },
  { value: 5, label: "T6", fullLabel: "Thứ Sáu" },
  { value: 6, label: "T7", fullLabel: "Thứ Bảy" }
];

const UserShiftSchedule = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [schedules, setSchedules] = useState<ShiftSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [userSchedule, setUserSchedule] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersResult, shiftsResult, schedulesResult] = await Promise.all([
        supabase.from('profiles').select('id, email, first_name, last_name, avatar_url, shift_id, team_id').order('first_name'),
        supabase.from('shifts').select('*').order('start_time'),
        supabase.from('user_shift_schedules').select('*')
      ]);

      if (usersResult.error) throw usersResult.error;
      if (shiftsResult.error) throw shiftsResult.error;
      if (schedulesResult.error) throw schedulesResult.error;

      setUsers(usersResult.data || []);
      setShifts(shiftsResult.data || []);
      setSchedules(schedulesResult.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Lỗi",
        description: "Không thể tải dữ liệu",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const openScheduleDialog = (user: User) => {
    setSelectedUser(user);
    
    // Load existing schedule for this user
    const existingSchedule: Record<number, string> = {};
    schedules.filter(s => s.user_id === user.id).forEach(s => {
      existingSchedule[s.day_of_week] = s.shift_id;
    });
    
    // Fill in default shift for days without schedule
    DAYS_OF_WEEK.forEach(day => {
      if (!existingSchedule[day.value] && user.shift_id) {
        existingSchedule[day.value] = user.shift_id;
      }
    });
    
    setUserSchedule(existingSchedule);
    setIsScheduleOpen(true);
  };

  const handleSaveSchedule = async () => {
    if (!selectedUser) return;
    
    setSaving(true);
    try {
      // Delete existing schedules for this user
      await supabase
        .from('user_shift_schedules')
        .delete()
        .eq('user_id', selectedUser.id);

      // Insert new schedules
      const newSchedules = Object.entries(userSchedule)
        .filter(([_, shiftId]) => shiftId)
        .map(([dayOfWeek, shiftId]) => ({
          user_id: selectedUser.id,
          shift_id: shiftId,
          day_of_week: parseInt(dayOfWeek)
        }));

      if (newSchedules.length > 0) {
        const { error } = await supabase
          .from('user_shift_schedules')
          .insert(newSchedules);

        if (error) throw error;
      }

      toast({
        title: "Thành công",
        description: "Đã lưu lịch làm việc"
      });

      setIsScheduleOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error saving schedule:', error);
      toast({
        title: "Lỗi",
        description: error.message || "Không thể lưu lịch",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const getShiftName = (shiftId: string | null) => {
    if (!shiftId) return '-';
    return shifts.find(s => s.id === shiftId)?.name || '-';
  };

  const getShiftInfo = (shiftId: string | null) => {
    if (!shiftId) return null;
    return shifts.find(s => s.id === shiftId);
  };

  const getUserScheduleForDay = (userId: string, dayOfWeek: number) => {
    const schedule = schedules.find(s => s.user_id === userId && s.day_of_week === dayOfWeek);
    return schedule ? getShiftInfo(schedule.shift_id) : null;
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  if (loading) {
    return <div className="text-muted-foreground">Đang tải...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Lịch Làm Việc Theo Tuần
          </h3>
          <p className="text-sm text-muted-foreground">
            Thiết lập ca làm việc cho từng ngày trong tuần
          </p>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-10">Nhân viên</TableHead>
              <TableHead>Ca mặc định</TableHead>
              {DAYS_OF_WEEK.map(day => (
                <TableHead key={day.value} className="text-center min-w-[80px]">
                  {day.label}
                </TableHead>
              ))}
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="sticky left-0 bg-background z-10">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback>{getInitials(user.first_name, user.last_name)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium whitespace-nowrap">
                      {user.first_name} {user.last_name}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{getShiftName(user.shift_id)}</Badge>
                </TableCell>
                {DAYS_OF_WEEK.map(day => {
                  const shift = getUserScheduleForDay(user.id, day.value);
                  return (
                    <TableCell key={day.value} className="text-center">
                      {shift ? (
                        <Badge variant="secondary" className="text-xs">
                          {shift.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => openScheduleDialog(user)}>
                    <Clock className="h-4 w-4 mr-1" />
                    Sửa lịch
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Lịch làm việc - {selectedUser?.first_name} {selectedUser?.last_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {DAYS_OF_WEEK.map(day => (
              <div key={day.value} className="flex items-center justify-between gap-4">
                <span className="font-medium w-24">{day.fullLabel}</span>
                <Select
                  value={userSchedule[day.value] || ""}
                  onValueChange={(value) => setUserSchedule(prev => ({
                    ...prev,
                    [day.value]: value
                  }))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Không làm việc" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Không làm việc</SelectItem>
                    {shifts.map(shift => (
                      <SelectItem key={shift.id} value={shift.id}>
                        {shift.name} ({shift.start_time} - {shift.end_time})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            
            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setIsScheduleOpen(false)}>
                Hủy
              </Button>
              <Button onClick={handleSaveSchedule} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Đang lưu..." : "Lưu lịch"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserShiftSchedule;
