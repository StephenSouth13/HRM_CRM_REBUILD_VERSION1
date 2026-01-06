import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FolderOpen, Calendar, User } from "lucide-react";
import { format } from "date-fns";

interface Project {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string;
  creator_name?: string;
}

interface TeamProjectsListProps {
  team: {
    id: string;
    name: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TeamProjectsList = ({ team, open, onOpenChange }: TeamProjectsListProps) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadProjects();
    }
  }, [open, team.id]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const { data: projectsData, error } = await supabase
        .from('projects')
        .select('*')
        .eq('team_id', team.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch creator names
      if (projectsData && projectsData.length > 0) {
        const creatorIds = [...new Set(projectsData.map(p => p.created_by))];
        const { data: creatorsData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', creatorIds);

        const creatorsMap = new Map(
          (creatorsData || []).map(c => [c.id, `${c.first_name || ''} ${c.last_name || ''}`.trim()])
        );

        setProjects(projectsData.map(p => ({
          ...p,
          creator_name: creatorsMap.get(p.created_by) || 'Unknown'
        })));
      } else {
        setProjects([]);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Dự án của {team.name}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[400px]">
          {loading ? (
            <div className="text-center text-muted-foreground py-8">
              Đang tải...
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Team này chưa có dự án nào
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium truncate">{project.name}</h4>
                        <Badge variant={project.is_active ? "default" : "secondary"}>
                          {project.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {project.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {project.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {project.creator_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(project.created_at), 'dd/MM/yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="text-sm text-muted-foreground text-center border-t pt-3">
          Tổng cộng: {projects.length} dự án
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TeamProjectsList;
