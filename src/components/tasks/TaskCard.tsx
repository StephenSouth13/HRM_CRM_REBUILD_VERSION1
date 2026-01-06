import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, AlertCircle, Trash2 } from "lucide-react";
import { UserRole } from "@/lib/auth";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TaskCardProps {
  task: any;
  onStatusChange: (taskId: string, newStatus: string) => void;
  onTaskClick: (task: any) => void;
  role: UserRole;
  onTaskDeleted?: () => void;
}

const priorityColors = {
  low: 'bg-blue-500/10 text-blue-500',
  medium: 'bg-yellow-500/10 text-yellow-500',
  high: 'bg-orange-500/10 text-orange-500',
  urgent: 'bg-red-500/10 text-red-500'
};

const TaskCard = ({ task, onStatusChange, onTaskClick, role, onTaskDeleted }: TaskCardProps) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this task?")) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id);

      if (error) throw error;

      toast.success("Task deleted successfully");
      onTaskDeleted?.();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error("Failed to delete task");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card
      className="p-4 shadow-medium hover:shadow-strong transition-smooth cursor-pointer group border-l-4 border-l-primary/20 hover:border-l-primary relative"
      onClick={() => onTaskClick(task)}
    >
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={isDeleting}
          className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <div className="space-y-3 pr-6">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-smooth flex-1">{task.title}</h4>
          <Badge className={`${priorityColors[task.priority as keyof typeof priorityColors]} font-medium flex-shrink-0`}>
            {task.priority}
          </Badge>
        </div>

        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}

        {task.deadline && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded-md w-fit">
            <Calendar className="h-3 w-3" />
            {format(new Date(task.deadline), 'MMM dd')}
          </div>
        )}
      </div>
    </Card>
  );
};

export default TaskCard;
