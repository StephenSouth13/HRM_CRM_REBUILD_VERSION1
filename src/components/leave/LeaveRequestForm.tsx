import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser, getUserProfile } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

const LeaveRequestForm = () => {
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [selectedLeaveType, setSelectedLeaveType] = useState<any>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [approverTo, setApproverTo] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) return;

        setCurrentUser(user);
        const profile = await getUserProfile(user.id);
        setUserProfile(profile);

        const { data: leaveTypeData } = await supabase
          .from('leave_types')
          .select('*')
          .order('name');

        if (leaveTypeData) {
          setLeaveTypes(leaveTypeData);
          if (leaveTypeData.length > 0) {
            setSelectedLeaveType(leaveTypeData[0]);
          }
        }

        // Load only leaders/admins as possible approvers
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('role', ['leader', 'admin']);

        const leaderIds = new Set((rolesData || []).map((r: any) => r.user_id));

        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', Array.from(leaderIds))
          .order('first_name');

        if (profileData) {
          setProfiles(profileData as Profile[]);
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
      }
    };

    loadInitialData();
  }, []);

  const handleLeaveTypeChange = (leaveTypeId: string) => {
    const selected = leaveTypes.find(lt => lt.id === leaveTypeId);
    if (selected) {
      setSelectedLeaveType(selected);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedLeaveType) {
      toast({
        title: "Error",
        description: "Please select a leave type",
        variant: "destructive"
      });
      return;
    }

    if (!startDate || !endDate) {
      toast({
        title: "Error",
        description: "Please select both start and end dates",
        variant: "destructive"
      });
      return;
    }

    if (!approverTo) {
      toast({
        title: "Error",
        description: "Please select an approver",
        variant: "destructive"
      });
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast({
        title: "Error",
        description: "End date must be after start date",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      if (!currentUser) throw new Error("Not authenticated");

      const { error } = await supabase.from('leave_requests').insert([{
        user_id: currentUser.id,
        custom_type_id: selectedLeaveType.id,
        type: 'custom' as const,
        start_date: startDate,
        end_date: endDate,
        reason: reason || null,
        status: 'pending' as const,
        approved_by: approverTo
      }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Leave request submitted successfully"
      });

      resetForm();
    } catch (error) {
      console.error('Error submitting leave request:', error);
      toast({
        title: "Error",
        description: "Failed to submit leave request",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStartDate("");
    setEndDate("");
    setReason("");
    setApproverTo("");
    if (leaveTypes.length > 0) {
      setSelectedLeaveType(leaveTypes[0]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit Leave Request</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="leaveType">Leave Type *</Label>
            <Select 
              value={selectedLeaveType?.id || ""} 
              onValueChange={handleLeaveTypeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes.map(lt => (
                  <SelectItem key={lt.id} value={lt.id}>
                    {lt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start">Start Date *</Label>
              <Input
                id="start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="end">End Date *</Label>
              <Input
                id="end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="approver">Send Request To (Approver) *</Label>
            <Select value={approverTo} onValueChange={setApproverTo}>
              <SelectTrigger>
                <SelectValue placeholder="Select approver" />
              </SelectTrigger>
              <SelectContent>
                {profiles
                  .filter(p => p.id !== currentUser?.id)
                  .map(profile => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.first_name} {profile.last_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Select a leader or manager to approve your request</p>
          </div>

          <div>
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Optional: Provide reason for leave"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={resetForm} disabled={loading}>
              Clear
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default LeaveRequestForm;
