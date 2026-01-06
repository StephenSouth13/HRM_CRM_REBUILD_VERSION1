import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser, getUserProfile } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Users } from "lucide-react";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated: () => void;
}

interface TeamMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  email: string;
  team_role: string | null;
}

const CreateTaskDialog = ({ open, onOpenChange, onTaskCreated }: CreateTaskDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [deadline, setDeadline] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [currentUserTeamId, setCurrentUserTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchTeamMembers();
    }
  }, [open]);

  const fetchTeamMembers = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      // Get current user's profile to find their team
      const profile = await getUserProfile(user.id);
      setCurrentUserTeamId(profile?.team_id || null);

      if (profile?.team_id) {
        // Fetch only team members from the same team
        const { data } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url, email, team_role')
          .eq('team_id', profile.team_id)
          .eq('is_approved', true)
          .order('first_name');
        
        if (data) setTeamMembers(data);
      } else {
        // If user has no team, they can only assign to themselves
        const { data } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url, email, team_role')
          .eq('id', user.id);
        
        if (data) setTeamMembers(data);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await getCurrentUser();
      if (!user) throw new Error("Not authenticated");

      const profile = await getUserProfile(user.id);

      const { error } = await supabase.from('tasks').insert([{
        title,
        description: description || null,
        priority: priority as any,
        deadline: deadline || null,
        assignee_id: assigneeId || null,
        creator_id: user.id,
        team_id: profile?.team_id || null,
        status: 'todo'
      }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Task created successfully"
      });

      onTaskCreated();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDeadline("");
    setAssigneeId("");
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';
  };

  const getRoleBadgeColor = (role: string | null) => {
    switch (role) {
      case 'leader': return 'bg-primary/20 text-primary';
      case 'developer': return 'bg-blue-500/20 text-blue-600';
      case 'designer': return 'bg-purple-500/20 text-purple-600';
      case 'tester': return 'bg-orange-500/20 text-orange-600';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="deadline">Deadline</Label>
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="assignee" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Assign To (Team Members)
            </Label>
            {teamMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-2 p-3 bg-muted/50 rounded-lg">
                No team members available. Join a team to assign tasks.
              </p>
            ) : (
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={member.avatar_url || undefined} />
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(member.first_name, member.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{member.first_name} {member.last_name}</span>
                        {member.team_role && (
                          <Badge variant="outline" className={`text-xs ${getRoleBadgeColor(member.team_role)}`}>
                            {member.team_role}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {currentUserTeamId && (
              <p className="text-xs text-muted-foreground mt-1.5">
                Only members from your team are shown
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTaskDialog;
