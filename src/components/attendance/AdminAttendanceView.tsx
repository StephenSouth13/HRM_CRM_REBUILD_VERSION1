import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInHours, differenceInMinutes } from "date-fns";
import { Download, Search } from "lucide-react";
import * as XLSX from 'xlsx';
import { getCurrentUser, getUserRole } from '@/lib/auth';

const Unauthorized = () => (
  <div className="p-8 text-center text-muted-foreground">
    You do not have permission to view this page. Contact an administrator if you believe this is an error.
  </div>
);

interface AttendanceRecord {
  id: string;
  user_id: string;
  type: 'check_in' | 'check_out';
  timestamp: string;
  location: string | null;
}

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  email: string;
}

interface UserAttendanceStats {
  userId: string;
  userName: string;
  email: string;
  avatar: string | null;
  totalHours: number;
  totalDays: number;
  averageHoursPerDay: number;
  onTimeCount: number;
  lateCount: number;
  onTimePercentage: number;
  records: AttendanceRecord[];
}

const AdminAttendanceView = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stats, setStats] = useState<UserAttendanceStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>('staff');
  const [searchName, setSearchName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const init = async () => {
      const user = await getCurrentUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const r = await getUserRole(user.id);
      setRole(r);
      if (r === 'admin' || r === 'leader') {
        await loadData();
      }
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (records.length > 0 && users.length > 0) {
      calculateStats();
    }
  }, [records, users]);

  const loadData = async () => {
    try {
      const { data: recordsData, error: recordsError } = await supabase
        .from('attendance')
        .select('*')
        .order('timestamp', { ascending: false });

      if (recordsError) throw recordsError;

      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, email')
        .order('first_name');

      if (usersError) throw usersError;

      setRecords(recordsData || []);
      setUsers(usersData || []);

      setStartDate(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'));
      setEndDate(format(new Date(), 'yyyy-MM-dd'));
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load attendance data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const statsMap = new Map<string, UserAttendanceStats>();

    users.forEach(user => {
      statsMap.set(user.id, {
        userId: user.id,
        userName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
        email: user.email,
        avatar: user.avatar_url,
        totalHours: 0,
        totalDays: 0,
        averageHoursPerDay: 0,
        onTimeCount: 0,
        lateCount: 0,
        onTimePercentage: 0,
        records: []
      });
    });

    const filteredRecords = records.filter(r => {
      const recordDate = new Date(r.timestamp).toISOString().split('T')[0];
      return recordDate >= startDate && recordDate <= endDate;
    });

    const dateGroups = new Map<string, AttendanceRecord[]>();
    filteredRecords.forEach(record => {
      const dateKey = `${record.user_id}-${record.timestamp.split('T')[0]}`;
      if (!dateGroups.has(dateKey)) {
        dateGroups.set(dateKey, []);
      }
      dateGroups.get(dateKey)!.push(record);
    });

    dateGroups.forEach((dayRecords, dateKey) => {
      const [userId] = dateKey.split('-');
      const stats = statsMap.get(userId);
      if (!stats) return;

      const checkIn = dayRecords.find(r => r.type === 'check_in');
      const checkOut = dayRecords.find(r => r.type === 'check_out');

      stats.records.push(...dayRecords);

      if (checkIn && checkOut) {
        const hours = differenceInHours(
          new Date(checkOut.timestamp),
          new Date(checkIn.timestamp)
        );
        const minutes = differenceInMinutes(
          new Date(checkOut.timestamp),
          new Date(checkIn.timestamp)
        ) % 60;

        stats.totalHours += hours + minutes / 60;
        stats.totalDays += 1;

        const checkInTime = new Date(checkIn.timestamp).getHours() * 60 + new Date(checkIn.timestamp).getMinutes();
        const defaultCheckInTime = 8 * 60;
        const gracePeriod = 15;

        if (checkInTime <= defaultCheckInTime + gracePeriod) {
          stats.onTimeCount += 1;
        } else {
          stats.lateCount += 1;
        }
      }
    });

    statsMap.forEach(userStats => {
      if (userStats.totalDays > 0) {
        userStats.averageHoursPerDay = userStats.totalHours / userStats.totalDays;
        const totalDays = userStats.onTimeCount + userStats.lateCount;
        userStats.onTimePercentage = totalDays > 0 ? (userStats.onTimeCount / totalDays) * 100 : 0;
      }
    });

    const filteredStats = Array.from(statsMap.values())
      .filter(s => {
        const nameMatch = s.userName.toLowerCase().includes(searchName.toLowerCase()) ||
                         s.email.toLowerCase().includes(searchName.toLowerCase());
        return nameMatch && s.totalDays > 0;
      })
      .sort((a, b) => {
        if (a.userName !== b.userName) {
          return a.userName.localeCompare(b.userName);
        }
        return 0;
      });

    setStats(filteredStats);
  };

  const exportToCSV = () => {
    try {
      const headers = ['Employee', 'Email', 'Total Hours', 'Total Days', 'Avg Hours/Day', 'On-Time %', 'On-Time Days', 'Late Days'];
      const rows = stats.map(s => [
        s.userName,
        s.email,
        s.totalHours.toFixed(2),
        s.totalDays,
        s.averageHoursPerDay.toFixed(2),
        s.onTimePercentage.toFixed(2),
        s.onTimeCount,
        s.lateCount
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Attendance data exported to CSV"
      });
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast({
        title: "Error",
        description: "Failed to export data",
        variant: "destructive"
      });
    }
  };

  const exportToExcel = () => {
    try {
      const headers = ['Employee', 'Email', 'Total Hours', 'Total Days', 'Avg Hours/Day', 'On-Time %', 'On-Time Days', 'Late Days'];
      const rows = stats.map(s => [
        s.userName,
        s.email,
        s.totalHours.toFixed(2),
        s.totalDays,
        s.averageHoursPerDay.toFixed(2),
        s.onTimePercentage.toFixed(2),
        s.onTimeCount,
        s.lateCount
      ]);

      const wsData = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
      XLSX.writeFile(wb, `attendance-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

      toast({
        title: "Success",
        description: "Attendance data exported to Excel"
      });
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast({
        title: "Error",
        description: "Failed to export to Excel",
        variant: "destructive"
      });
    }
  };

  const handleFilter = () => {
    calculateStats();
  };

  const handleReset = () => {
    setSearchName("");
    setStartDate(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'));
    setEndDate(format(new Date(), 'yyyy-MM-dd'));
  };

  if (loading) {
    return <div className="text-muted-foreground text-center py-8">Loading attendance data...</div>;
  }

  if (!(role === 'admin' || role === 'leader')) {
    return <Unauthorized />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filter Attendance Records</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="searchName">Search by Name or Email</Label>
              <div className="flex gap-2 mt-1">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="searchName"
                    placeholder="Name or email..."
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleReset}>
              Reset Filters
            </Button>
            <Button onClick={handleFilter}>
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {stats.length > 0 && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={exportToExcel}>
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Total Hours</TableHead>
              <TableHead className="text-right">Total Days</TableHead>
              <TableHead className="text-right">Avg Hours/Day</TableHead>
              <TableHead className="text-right">On-Time Days</TableHead>
              <TableHead className="text-right">Late Days</TableHead>
              <TableHead className="text-right">On-Time %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No attendance records found
                </TableCell>
              </TableRow>
            ) : (
              stats.map((userStats) => (
                <TableRow key={userStats.userId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {userStats.userName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{userStats.userName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{userStats.email}</TableCell>
                  <TableCell className="text-right font-medium">{userStats.totalHours.toFixed(2)}h</TableCell>
                  <TableCell className="text-right">{userStats.totalDays}</TableCell>
                  <TableCell className="text-right">{userStats.averageHoursPerDay.toFixed(2)}h</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="default" className="bg-green-600">
                      {userStats.onTimeCount}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="destructive">
                      {userStats.lateCount}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <Badge variant={userStats.onTimePercentage >= 90 ? "default" : "secondary"}>
                      {userStats.onTimePercentage.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminAttendanceView;
