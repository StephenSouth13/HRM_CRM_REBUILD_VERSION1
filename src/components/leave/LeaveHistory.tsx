import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser, getUserRole, getUserProfile } from "@/lib/auth";
import { UserRole } from "@/lib/auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import { Edit2, X } from "lucide-react";

interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  shift: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  leave_types?: { name: string };
  profiles?: { first_name: string | null; last_name: string | null };
}

interface LeaveType {
  id: string;
  name: string;
}

const LeaveHistoryTabs = ({ role }: { role: UserRole }) => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [editForm, setEditForm] = useState({
    startDate: "",
    endDate: "",
    shift: "full",
    reason: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('leave-requests-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      setCurrentUser(user);

      // Use type assertion to bypass missing table type
      const { data: leaveTypesData } = await (supabase as any)
        .from('leave_types')
        .select('id, name');
      if (leaveTypesData) {
        setLeaveTypes(leaveTypesData as LeaveType[]);
      }

      const { data: myData } = await supabase
        .from('leave_requests')
        .select(`
          *,
          leave_types:leave_type_id (name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (myData) {
        setMyRequests(myData as any);
      }

      if (role === 'leader' || role === 'admin') {
        const { data: pendingData } = await supabase
          .from('leave_requests')
          .select(`
            *,
            leave_types:leave_type_id (name),
            profiles:user_id (first_name, last_name)
          `)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (pendingData) {
          setPendingApprovals(pendingData as any);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredRequests = (requests: LeaveRequest[]) => {
    if (statusFilter === 'all') return requests;
    return requests.filter(r => r.status === statusFilter);
  };

  const handleEdit = (request: LeaveRequest) => {
    setEditingId(request.id);
    setEditForm({
      startDate: request.start_date,
      endDate: request.end_date,
      shift: request.shift,
      reason: request.reason || ""
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          start_date: editForm.startDate,
          end_date: editForm.endDate,
          shift: editForm.shift,
          reason: editForm.reason || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingId)
        .eq('status', 'pending');

      if (error) throw error;

      toast({
        title: "Success",
        description: "Leave request updated successfully"
      });

      setEditingId(null);
      loadData();
    } catch (error) {
      console.error('Error updating request:', error);
      toast({
        title: "Error",
        description: "Failed to update request",
        variant: "destructive"
      });
    }
  };

  const handleCancel = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .eq('status', 'pending');

      if (error) throw error;

      toast({
        title: "Success",
        description: "Leave request cancelled"
      });

      setCancelingId(null);
      loadData();
    } catch (error) {
      console.error('Error cancelling request:', error);
      toast({
        title: "Error",
        description: "Failed to cancel request",
        variant: "destructive"
      });
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      if (!currentUser) return;

      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: 'approved',
          approved_by: currentUser.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Leave request approved"
      });

      setSelectedRequest(null);
      loadData();
    } catch (error) {
      console.error('Error approving request:', error);
      toast({
        title: "Error",
        description: "Failed to approve request",
        variant: "destructive"
      });
    }
  };

  const handleReject = async (requestId: string) => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a rejection reason",
        variant: "destructive"
      });
      return;
    }

    try {
      if (!currentUser) return;

      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: 'rejected',
          approved_by: currentUser.id,
          approved_at: new Date().toISOString(),
          reason: rejectionReason,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Leave request rejected"
      });

      setSelectedRequest(null);
      setRejectionReason("");
      setApprovalDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast({
        title: "Error",
        description: "Failed to reject request",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return <SkeletonTable rows={6} columns={7} />;
  }

  const LeaveRequestTable = ({ requests, showApprover = false, showActions = false, isEditing = false }: {
    requests: LeaveRequest[];
    showApprover?: boolean;
    showActions?: boolean;
    isEditing?: boolean;
  }) => (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {showApprover && <TableHead>Employee</TableHead>}
            <TableHead>Leave Type</TableHead>
            <TableHead>Start Date</TableHead>
            <TableHead>End Date</TableHead>
            <TableHead>Shift</TableHead>
            <TableHead>Status</TableHead>
            {showActions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showApprover ? 7 : 6} className="text-center text-muted-foreground py-8">
                No leave requests found
              </TableCell>
            </TableRow>
          ) : (
            requests.map((request) => (
              <TableRow key={request.id}>
                {showApprover && (
                  <TableCell>
                    {request.profiles?.first_name} {request.profiles?.last_name}
                  </TableCell>
                )}
                <TableCell className="font-medium">
                  {request.leave_types?.name || "Unknown"}
                </TableCell>
                <TableCell>{format(new Date(request.start_date), 'MMM dd, yyyy')}</TableCell>
                <TableCell>{format(new Date(request.end_date), 'MMM dd, yyyy')}</TableCell>
                <TableCell className="capitalize">
                  <Badge variant="secondary">
                    {request.shift === 'full' ? 'Full Day' : request.shift === 'am' ? 'AM' : 'PM'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      request.status === 'approved' ? 'default' :
                      request.status === 'rejected' ? 'destructive' : 'secondary'
                    }
                  >
                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                  </Badge>
                </TableCell>
                {showActions && (
                  <TableCell className="text-right">
                    {request.status === 'pending' && (
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedRequest(request);
                            setApprovalDialogOpen(true);
                          }}
                        >
                          Approve/Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <Tabs defaultValue="my-requests" className="w-full">
      <TabsList className="bg-secondary shadow-soft">
        <TabsTrigger value="my-requests" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          My Requests
        </TabsTrigger>
        {(role === 'leader' || role === 'admin') && (
          <TabsTrigger value="approval" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Approval ({pendingApprovals.length})
          </TabsTrigger>
        )}
        <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          History
        </TabsTrigger>
      </TabsList>

      <TabsContent value="my-requests" className="mt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm">Filter by status:</Label>
          <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {editingId ? (
          <Dialog open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Leave Request</DialogTitle>
                <DialogDescription>
                  Update the leave request information below.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-start">Start Date</Label>
                  <Input
                    id="edit-start"
                    type="date"
                    value={editForm.startDate ? editForm.startDate.slice(0, 10) : ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="edit-end">End Date</Label>
                  <Input
                    id="edit-end"
                    type="date"
                    value={editForm.endDate ? editForm.endDate.slice(0, 10) : ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="edit-shift">Shift</Label>
                  <Select value={editForm.shift} onValueChange={(value) =>
                    setEditForm(prev => ({ ...prev, shift: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full Day</SelectItem>
                      <SelectItem value="am">Morning (AM)</SelectItem>
                      <SelectItem value="pm">Afternoon (PM)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-reason">Reason</Label>
                  <Textarea
                    id="edit-reason"
                    value={editForm.reason}
                    onChange={(e) => setEditForm(prev => ({ ...prev, reason: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                  <Button onClick={handleSaveEdit}>Save Changes</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Leave Type</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {getFilteredRequests(myRequests).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No leave requests found
                  </TableCell>
                </TableRow>
              ) : (
                getFilteredRequests(myRequests).map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.leave_types?.name || "Unknown"}</TableCell>
                    <TableCell>{format(new Date(request.start_date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>{format(new Date(request.end_date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell className="capitalize">
                      <Badge variant="secondary">
                        {request.shift === 'full' ? 'Full Day' : request.shift === 'am' ? 'AM' : 'PM'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          request.status === 'approved' ? 'default' :
                          request.status === 'rejected' ? 'destructive' : 'secondary'
                        }
                      >
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {request.status === 'pending' && (
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(request)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setCancelingId(request.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {cancelingId && (
          <AlertDialog open={!!cancelingId} onOpenChange={(open) => !open && setCancelingId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel Leave Request</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to cancel this leave request? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>No, keep it</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleCancel(cancelingId)}>
                  Yes, cancel request
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </TabsContent>

      {(role === 'leader' || role === 'admin') && (
        <TabsContent value="approval" className="mt-6">
          <LeaveRequestTable
            requests={pendingApprovals}
            showApprover={true}
            showActions={true}
          />

          {selectedRequest && (
            <AlertDialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Review Leave Request</AlertDialogTitle>
                  <AlertDialogDescription>
                    Employee: {selectedRequest.profiles?.first_name} {selectedRequest.profiles?.last_name}<br />
                    Leave Type: {selectedRequest.leave_types?.name}<br />
                    Dates: {format(new Date(selectedRequest.start_date), 'MMM dd, yyyy')} - {format(new Date(selectedRequest.end_date), 'MMM dd, yyyy')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="rejection-reason">Rejection Reason (required if rejecting)</Label>
                    <Textarea
                      id="rejection-reason"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Provide reason for rejection"
                      rows={3}
                    />
                  </div>
                </div>

                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <Button variant="destructive" onClick={() => handleReject(selectedRequest.id)}>
                    Reject
                  </Button>
                  <AlertDialogAction onClick={() => handleApprove(selectedRequest.id)}>
                    Approve
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </TabsContent>
      )}

      <TabsContent value="history" className="mt-6">
        <LeaveRequestTable requests={myRequests} />
      </TabsContent>
    </Tabs>
  );
};

export default LeaveHistoryTabs;