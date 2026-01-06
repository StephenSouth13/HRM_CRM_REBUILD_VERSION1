import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, Users, FolderOpen } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import TeamMembersManagement from "./TeamMembersManagement";
import TeamProjectsList from "./TeamProjectsList";

interface Team {
  id: string;
  name: string;
  description: string | null;
  leader_id: string | null;
  created_at: string;
  member_count?: number;
  project_count?: number;
}

interface User {
  id: string;
  first_name: string | null;
  last_name: string | null;
  team_id: string | null;
}

const TeamsManagement = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    leaderId: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .order('name');

      if (teamsError) throw teamsError;

      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, team_id')
        .order('first_name');

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Fetch project counts for each team
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, team_id');

      // Count members and projects for each team
      const teamsWithCount = (teamsData || []).map(team => ({
        ...team,
        member_count: (usersData || []).filter(u => u.team_id === team.id).length,
        project_count: (projectsData || []).filter(p => p.team_id === team.id).length
      }));

      setTeams(teamsWithCount);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load teams",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (team: Team) => {
    setEditingId(team.id);
    setFormData({
      name: team.name,
      description: team.description || "",
      leaderId: team.leader_id || ""
    });
    setIsCreateOpen(true);
  };

  const handleManageMembers = (team: Team) => {
    setSelectedTeam(team);
    setIsMembersOpen(true);
  };

  const handleViewProjects = (team: Team) => {
    setSelectedTeam(team);
    setIsProjectsOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Team name is required",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from('teams')
          .update({
            name: formData.name,
            description: formData.description || null,
            leader_id: formData.leaderId || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId);

        if (error) throw error;

        // If leader is set, make sure they're in the team
        if (formData.leaderId) {
          await supabase
            .from('profiles')
            .update({ team_id: editingId })
            .eq('id', formData.leaderId);
        }

        toast({
          title: "Success",
          description: "Team updated successfully"
        });
      } else {
        const { data: newTeam, error } = await supabase
          .from('teams')
          .insert([{
            name: formData.name,
            description: formData.description || null,
            leader_id: formData.leaderId || null
          }])
          .select()
          .single();

        if (error) throw error;

        // If leader is set, add them to the team
        if (formData.leaderId && newTeam) {
          await supabase
            .from('profiles')
            .update({ team_id: newTeam.id })
            .eq('id', formData.leaderId);
        }

        toast({
          title: "Success",
          description: "Team created successfully"
        });
      }

      resetForm();
      setIsCreateOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error saving team:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save team",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedTeam) return;

    try {
      // Remove team_id from all members first
      await supabase
        .from('profiles')
        .update({ team_id: null })
        .eq('team_id', selectedTeam.id);

      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', selectedTeam.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Team deleted successfully"
      });

      setIsDeleteOpen(false);
      setSelectedTeam(null);
      loadData();
    } catch (error) {
      console.error('Error deleting team:', error);
      toast({
        title: "Error",
        description: "Failed to delete team",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: "",
      description: "",
      leaderId: ""
    });
  };

  const getLeaderName = (leaderId: string | null) => {
    if (!leaderId) return '-';
    const leader = users.find(u => u.id === leaderId);
    return leader ? `${leader.first_name} ${leader.last_name}` : leaderId.substring(0, 8);
  };

  // Get users that can be selected as leader (no team or same team as editing)
  const getAvailableLeaders = () => {
    if (editingId) {
      return users.filter(u => !u.team_id || u.team_id === editingId);
    }
    return users.filter(u => !u.team_id);
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading teams...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Teams ({teams.length})</h3>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Team
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit" : "Create"} Team</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Team Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Engineering"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the team's purpose"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="leader">Team Leader</Label>
                <Select value={formData.leaderId} onValueChange={(value) => setFormData(prev => ({ ...prev, leaderId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select leader" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableLeaders().map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.first_name} {user.last_name}
                        {user.team_id && user.team_id === editingId && (
                          <span className="text-muted-foreground ml-1">(current member)</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Chỉ hiển thị người dùng chưa thuộc team nào
                </p>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  {editingId ? "Update" : "Create"} Team
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Leader</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No teams yet
                </TableCell>
              </TableRow>
            ) : (
              teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell className="text-sm">{team.description || '-'}</TableCell>
                  <TableCell>{getLeaderName(team.leader_id)}</TableCell>
                  <TableCell>
                    <Badge 
                      variant="secondary" 
                      className="cursor-pointer hover:bg-secondary/80"
                      onClick={() => handleManageMembers(team)}
                    >
                      <Users className="h-3 w-3 mr-1" />
                      {team.member_count || 0}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => handleViewProjects(team)}
                    >
                      <FolderOpen className="h-3 w-3 mr-1" />
                      {team.project_count || 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(team.created_at), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleManageMembers(team)}
                        title="Manage members"
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(team)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setSelectedTeam(team);
                          setIsDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete Team?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{selectedTeam?.name}"? 
            {(selectedTeam?.member_count || 0) > 0 && (
              <span className="block mt-1 text-destructive">
                Lưu ý: {selectedTeam?.member_count} thành viên sẽ bị xóa khỏi team này.
              </span>
            )}
            This action cannot be undone.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {selectedTeam && (
        <>
          <TeamMembersManagement
            team={selectedTeam}
            open={isMembersOpen}
            onOpenChange={setIsMembersOpen}
            onMembersChange={loadData}
          />
          <TeamProjectsList
            team={selectedTeam}
            open={isProjectsOpen}
            onOpenChange={setIsProjectsOpen}
          />
        </>
      )}
    </div>
  );
};

export default TeamsManagement;
