import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FolderKanban, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Project {
  id: string;
  name: string;
  description: string | null;
  team_id: string;
  is_active: boolean;
  created_at: string;
}

interface Team {
  id: string;
  name: string;
}

interface ProjectSelectorProps {
  selectedProject: Project | null;
  onProjectChange: (project: Project | null) => void;
}

const ProjectSelector = ({ selectedProject, onProjectChange }: ProjectSelectorProps) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    teamId: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [projectsResult, teamsResult] = await Promise.all([
        supabase.from('projects').select('*').eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('teams').select('id, name').order('name')
      ]);

      if (projectsResult.error) throw projectsResult.error;
      if (teamsResult.error) throw teamsResult.error;

      setProjects(projectsResult.data || []);
      setTeams(teamsResult.data || []);

      // Auto-select first project if none selected
      if (!selectedProject && projectsResult.data?.length > 0) {
        onProjectChange(projectsResult.data[0]);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!formData.name.trim() || !formData.teamId) {
      toast({
        title: "Lỗi",
        description: "Tên dự án và team là bắt buộc",
        variant: "destructive"
      });
      return;
    }

    try {
      const user = await getCurrentUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from('projects')
        .insert([{
          name: formData.name,
          description: formData.description || null,
          team_id: formData.teamId,
          created_by: user.id
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Thành công",
        description: "Đã tạo dự án mới"
      });

      setFormData({ name: "", description: "", teamId: "" });
      setIsCreateOpen(false);
      loadData();
      
      if (data) {
        onProjectChange(data);
      }
    } catch (error: any) {
      console.error('Error creating project:', error);
      toast({
        title: "Lỗi",
        description: error.message || "Không thể tạo dự án",
        variant: "destructive"
      });
    }
  };

  const getTeamName = (teamId: string) => {
    return teams.find(t => t.id === teamId)?.name || "Unknown";
  };

  if (loading) {
    return <div className="h-9 w-48 bg-secondary animate-pulse rounded-md" />;
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="min-w-[200px] justify-between">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4" />
              <span className="truncate">
                {selectedProject?.name || "Chọn dự án"}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[250px]">
          {projects.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              Chưa có dự án nào
            </div>
          ) : (
            projects.map((project) => (
              <DropdownMenuItem
                key={project.id}
                onClick={() => onProjectChange(project)}
                className="flex flex-col items-start gap-1 py-2"
              >
                <span className="font-medium">{project.name}</span>
                <span className="text-xs text-muted-foreground">
                  Team: {getTeamName(project.team_id)}
                </span>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Tạo dự án mới
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tạo Dự Án Mới</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="projectName">Tên dự án *</Label>
              <Input
                id="projectName"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="VD: Website Redesign"
              />
            </div>

            <div>
              <Label htmlFor="projectTeam">Team *</Label>
              <Select 
                value={formData.teamId} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, teamId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="projectDesc">Mô tả</Label>
              <Textarea
                id="projectDesc"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Mô tả ngắn về dự án..."
                rows={3}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Hủy
              </Button>
              <Button onClick={handleCreateProject}>
                Tạo Dự Án
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectSelector;
