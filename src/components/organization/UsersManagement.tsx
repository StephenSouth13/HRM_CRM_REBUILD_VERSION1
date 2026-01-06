import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit2, Trash2, Eye, FileText, Users, Search, Filter, GraduationCap, Building2, Phone, Calendar, Shield, Clock, UserCheck, UserX, AlertCircle, Check, X, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { approveUser, rejectUser } from "@/lib/auth";

interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  team_id: string | null;
  shift_id: string | null;
  annual_leave_balance: number | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  school: string | null;
  major: string | null;
  cv_url: string | null;
  is_approved: boolean | null;
  approval_rejected: boolean | null;
  rejection_reason: string | null;
  created_at: string;
  role?: string;
}

interface Team {
  id: string;
  name: string;
}

interface Shift {
  id: string;
  name: string;
}

const UsersManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [rejectedUsers, setRejectedUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isClearHistoryOpen, setIsClearHistoryOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [rejectionReason, setRejectionReason] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("active");
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "staff",
    teamId: "",
    shiftId: "",
    leaveBalance: "12",
    phone: "",
    dateOfBirth: "",
    gender: "",
    school: "",
    major: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name')
        .order('name');

      if (teamsError) throw teamsError;

      const { data: shiftsData, error: shiftsError } = await supabase
        .from('shifts')
        .select('id, name')
        .order('name');

      if (shiftsError) throw shiftsError;

      setTeams(teamsData as Team[]);
      setShifts(shiftsData as Shift[]);

      const usersWithRoles = profiles?.map(profile => ({
        ...profile,
        role: roles?.find(r => r.user_id === profile.id)?.role || 'staff'
      })) || [];

      // Separate users by status
      setUsers(usersWithRoles.filter(u => u.is_approved === true));
      setPendingUsers(usersWithRoles.filter(u => !u.is_approved && !u.approval_rejected));
      setRejectedUsers(usersWithRoles.filter(u => u.approval_rejected === true));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleApprove = async (user: User) => {
    setProcessingId(user.id);
    try {
      const { error } = await approveUser(user.id);
      if (error) throw error;
      toast({ title: "Success", description: `${user.first_name || user.email} approved` });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!selectedUser || !rejectionReason.trim()) {
      toast({ title: "Error", description: "Please provide a reason", variant: "destructive" });
      return;
    }
    setProcessingId(selectedUser.id);
    try {
      const { error } = await rejectUser(selectedUser.id, rejectionReason);
      if (error) throw error;
      toast({ title: "Success", description: `${selectedUser.first_name || selectedUser.email} rejected` });
      setIsRejectOpen(false);
      setRejectionReason("");
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleClearRejectedHistory = async () => {
    try {
      for (const user of rejectedUsers) {
        await supabase.from('user_roles').delete().eq('user_id', user.id);
        await supabase.from('profiles').delete().eq('id', user.id);
      }
      toast({ title: "Success", description: "Rejected users history cleared" });
      setIsClearHistoryOpen(false);
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleView = (user: User) => {
    setSelectedUser(user);
    setIsViewOpen(true);
  };

  const handleEdit = (user: User) => {
    setEditingId(user.id);
    setFormData({
      email: user.email,
      firstName: user.first_name || "",
      lastName: user.last_name || "",
      role: user.role || "staff",
      teamId: user.team_id || "",
      shiftId: user.shift_id || "",
      leaveBalance: (user.annual_leave_balance || 12).toString(),
      phone: user.phone || "",
      dateOfBirth: user.date_of_birth || "",
      gender: user.gender || "",
      school: user.school || "",
      major: user.major || ""
    });
    setIsCreateOpen(true);
  };

  const handleSave = async () => {
    if (!formData.email.trim()) {
      toast({ title: "Error", description: "Email is required", variant: "destructive" });
      return;
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from('profiles')
          .update({
            email: formData.email,
            first_name: formData.firstName || null,
            last_name: formData.lastName || null,
            team_id: formData.teamId || null,
            shift_id: formData.shiftId || null,
            annual_leave_balance: parseFloat(formData.leaveBalance),
            phone: formData.phone || null,
            date_of_birth: formData.dateOfBirth || null,
            gender: formData.gender || null,
            school: formData.school || null,
            major: formData.major || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId);

        if (error) throw error;

        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: formData.role as any })
          .eq('user_id', editingId);

        if (roleError) throw roleError;
        toast({ title: "Success", description: "User updated successfully" });
      }

      resetForm();
      setIsCreateOpen(false);
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    try {
      await supabase.from('user_roles').delete().eq('user_id', selectedUser.id);
      await supabase.from('profiles').delete().eq('id', selectedUser.id);
      toast({ title: "Success", description: "User deleted successfully" });
      setIsDeleteOpen(false);
      setSelectedUser(null);
      loadData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete user", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      email: "", firstName: "", lastName: "", role: "staff", teamId: "",
      shiftId: "", leaveBalance: "12", phone: "", dateOfBirth: "", gender: "", school: "", major: ""
    });
  };

  const getTeamName = (teamId: string | null) => {
    if (!teamId) return '-';
    return teams.find(t => t.id === teamId)?.name || '-';
  };

  const getShiftName = (shiftId: string | null) => {
    if (!shiftId) return '-';
    return shifts.find(s => s.id === shiftId)?.name || '-';
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'leader': return 'secondary';
      default: return 'outline';
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.first_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (user.last_name?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-muted/50">
          <TabsTrigger 
            value="pending" 
            className="relative data-[state=active]:bg-warning/20 data-[state=active]:text-warning data-[state=active]:shadow-sm py-3"
          >
            <Clock className="h-4 w-4 mr-2" />
            Pending
            {pendingUsers.length > 0 && (
              <Badge className="ml-2 h-5 px-1.5 bg-warning text-warning-foreground text-xs">
                {pendingUsers.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="active" 
            className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-sm py-3"
          >
            <UserCheck className="h-4 w-4 mr-2" />
            Active
            <Badge className="ml-2 h-5 px-1.5 bg-primary/20 text-primary text-xs">
              {users.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger 
            value="rejected" 
            className="data-[state=active]:bg-destructive/20 data-[state=active]:text-destructive data-[state=active]:shadow-sm py-3"
          >
            <UserX className="h-4 w-4 mr-2" />
            Rejected
            {rejectedUsers.length > 0 && (
              <Badge className="ml-2 h-5 px-1.5 bg-destructive/20 text-destructive text-xs">
                {rejectedUsers.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Pending Users Tab */}
        <TabsContent value="pending" className="mt-6">
          <Card className="border-0 shadow-medium overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-warning/10 via-warning/5 to-transparent border-b border-warning/20">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-warning/20 to-warning/10 flex items-center justify-center shadow-soft">
                  <Clock className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <CardTitle className="text-xl">Pending Approval</CardTitle>
                  <CardDescription>Users waiting for account approval</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {pendingUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                    <UserCheck className="h-8 w-8 text-success" />
                  </div>
                  <p className="font-semibold text-lg">All caught up!</p>
                  <p className="text-muted-foreground">No pending registration requests</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {pendingUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-5 hover:bg-muted/30 transition-all group">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <Avatar className="h-14 w-14 ring-2 ring-warning/30 shadow-soft">
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-warning/20 to-warning/10 text-warning font-bold text-lg">
                              {getInitials(user.first_name, user.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-warning border-2 border-background" />
                        </div>
                        <div>
                          <p className="font-semibold text-lg text-foreground">
                            {user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'New User'}
                          </p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Registered: {formatDate(user.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => { setSelectedUser(user); setIsRejectOpen(true); }}
                          disabled={processingId === user.id}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          className="bg-success hover:bg-success/90 text-success-foreground shadow-soft"
                          onClick={() => handleApprove(user)}
                          disabled={processingId === user.id}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Active Users Tab */}
        <TabsContent value="active" className="mt-6">
          <Card className="border-0 shadow-medium overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shadow-soft">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Active Members</CardTitle>
                    <CardDescription>All approved team members</CardDescription>
                  </div>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => resetForm()} className="shadow-soft">
                      <Plus className="h-4 w-4 mr-2" />
                      Add User
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-xl">{editingId ? "Edit User" : "Add New User"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 pt-4">
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Users className="h-4 w-4" /> Basic Information
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="email">Email *</Label>
                            <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} placeholder="user@example.com" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="role">Role</Label>
                            <Select value={formData.role} onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="staff">Staff</SelectItem>
                                <SelectItem value="leader">Leader</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="firstName">First Name</Label>
                            <Input id="firstName" value={formData.firstName} onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="lastName">Last Name</Label>
                            <Input id="lastName" value={formData.lastName} onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))} />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Calendar className="h-4 w-4" /> Personal Details
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="gender">Gender</Label>
                            <Select value={formData.gender} onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}>
                              <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input id="phone" type="tel" value={formData.phone} onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="dateOfBirth">Date of Birth</Label>
                            <Input id="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="leaveBalance">Annual Leave (days)</Label>
                            <Input id="leaveBalance" type="number" min="0" step="0.5" value={formData.leaveBalance} onChange={(e) => setFormData(prev => ({ ...prev, leaveBalance: e.target.value }))} />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <GraduationCap className="h-4 w-4" /> Education
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="school">School / University</Label>
                            <Input id="school" value={formData.school} onChange={(e) => setFormData(prev => ({ ...prev, school: e.target.value }))} placeholder="e.g., Harvard University" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="major">Major / Field</Label>
                            <Input id="major" value={formData.major} onChange={(e) => setFormData(prev => ({ ...prev, major: e.target.value }))} placeholder="e.g., Computer Science" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Building2 className="h-4 w-4" /> Work Assignment
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="team">Team</Label>
                            <Select value={formData.teamId || "none"} onValueChange={(value) => setFormData(prev => ({ ...prev, teamId: value === "none" ? "" : value }))}>
                              <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No team</SelectItem>
                                {teams.map(team => (<SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="shift">Shift</Label>
                            <Select value={formData.shiftId || "none"} onValueChange={(value) => setFormData(prev => ({ ...prev, shiftId: value === "none" ? "" : value }))}>
                              <SelectTrigger><SelectValue placeholder="Select shift" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No shift</SelectItem>
                                {shifts.map(shift => (<SelectItem key={shift.id} value={shift.id}>{shift.name}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end pt-4 border-t">
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave}>{editingId ? "Update User" : "Add User"}</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <div className="p-4 bg-muted/30 border-b flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-background" />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-[150px] bg-background">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="leader">Leader</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-semibold">User</TableHead>
                    <TableHead className="font-semibold">Role</TableHead>
                    <TableHead className="font-semibold">Team</TableHead>
                    <TableHead className="font-semibold hidden md:table-cell">Contact</TableHead>
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        {searchQuery || roleFilter !== 'all' ? 'No users match your filters' : 'No approved users yet'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id} className="group hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 ring-2 ring-border group-hover:ring-primary/30 transition-all">
                              <AvatarImage src={user.avatar_url || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                {getInitials(user.first_name, user.last_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-foreground">{user.first_name} {user.last_name}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(user.role || 'staff')} className="gap-1">
                            {user.role === 'admin' && <Shield className="h-3 w-3" />}
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell><span className="text-sm">{getTeamName(user.team_id)}</span></TableCell>
                        <TableCell className="hidden md:table-cell">
                          {user.phone ? (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Phone className="h-3 w-3" />{user.phone}
                            </div>
                          ) : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="sm" variant="ghost" onClick={() => handleView(user)} className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(user)} className="h-8 w-8 p-0"><Edit2 className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => { setSelectedUser(user); setIsDeleteOpen(true); }} className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rejected Users Tab */}
        <TabsContent value="rejected" className="mt-6">
          <Card className="border-0 shadow-medium overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-destructive/10 via-destructive/5 to-transparent border-b border-destructive/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-destructive/20 to-destructive/10 flex items-center justify-center shadow-soft">
                    <UserX className="h-6 w-6 text-destructive" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Rejected Users</CardTitle>
                    <CardDescription>Previously rejected registration requests</CardDescription>
                  </div>
                </div>
                {rejectedUsers.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setIsClearHistoryOpen(true)} className="text-destructive border-destructive/30 hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear History
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {rejectedUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <UserX className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="font-semibold text-lg">No rejected users</p>
                  <p className="text-muted-foreground">No registration has been rejected yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {rejectedUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-5 hover:bg-muted/30 transition-all group opacity-80">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-14 w-14 ring-2 ring-destructive/30 shadow-soft grayscale">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-destructive/20 to-destructive/10 text-destructive font-bold text-lg">
                            {getInitials(user.first_name, user.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-lg text-foreground">
                            {user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Rejected User'}
                          </p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          {user.rejection_reason && (
                            <div className="flex items-start gap-1 mt-1.5 p-2 bg-destructive/5 rounded-lg max-w-md">
                              <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                              <p className="text-xs text-destructive">{user.rejection_reason}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="opacity-0 group-hover:opacity-100 border-success/50 text-success hover:bg-success hover:text-success-foreground"
                        onClick={() => handleApprove(user)}
                        disabled={processingId === user.id}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Re-approve
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View User Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>User Details</DialogTitle></DialogHeader>
          {selectedUser && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 pb-4 border-b">
                <Avatar className="h-16 w-16 ring-2 ring-primary/20">
                  <AvatarImage src={selectedUser.avatar_url || undefined} />
                  <AvatarFallback className="text-xl bg-primary/10 text-primary font-bold">
                    {getInitials(selectedUser.first_name, selectedUser.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-semibold">{selectedUser.first_name} {selectedUser.last_name}</h3>
                  <p className="text-muted-foreground">{selectedUser.email}</p>
                  <Badge variant={getRoleBadgeVariant(selectedUser.role || 'staff')} className="mt-1">{selectedUser.role}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label className="text-xs text-muted-foreground uppercase tracking-wide">Phone</Label><p className="font-medium">{selectedUser.phone || '-'}</p></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground uppercase tracking-wide">Gender</Label><p className="font-medium capitalize">{selectedUser.gender || '-'}</p></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground uppercase tracking-wide">Date of Birth</Label><p className="font-medium">{selectedUser.date_of_birth || '-'}</p></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground uppercase tracking-wide">Leave Balance</Label><p className="font-medium">{selectedUser.annual_leave_balance || 12} days</p></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground uppercase tracking-wide">Team</Label><p className="font-medium">{getTeamName(selectedUser.team_id)}</p></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground uppercase tracking-wide">Shift</Label><p className="font-medium">{getShiftName(selectedUser.shift_id)}</p></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground uppercase tracking-wide">School</Label><p className="font-medium">{selectedUser.school || '-'}</p></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground uppercase tracking-wide">Major</Label><p className="font-medium">{selectedUser.major || '-'}</p></div>
              </div>
              {selectedUser.cv_url && (
                <div className="pt-4 border-t">
                  <a href={selectedUser.cv_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline font-medium">
                    <FileText className="h-4 w-4" /> View CV / Resume
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserX className="h-5 w-5 text-destructive" />Reject User</DialogTitle>
            <DialogDescription>Please provide a reason for rejecting {selectedUser?.first_name || selectedUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea placeholder="Enter rejection reason..." value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={3} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsRejectOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleReject} disabled={processingId !== null}>Confirm Rejection</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete User?</AlertDialogTitle>
          <AlertDialogDescription>Are you sure you want to delete <strong>{selectedUser?.first_name} {selectedUser?.last_name}</strong>? This action cannot be undone.</AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear History Confirmation */}
      <AlertDialog open={isClearHistoryOpen} onOpenChange={setIsClearHistoryOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Clear Rejected Users History?</AlertDialogTitle>
          <AlertDialogDescription>This will permanently delete all {rejectedUsers.length} rejected user records. This action cannot be undone.</AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearRejectedHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Clear All</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UsersManagement;
