import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Calendar, GripVertical } from "lucide-react";
import { format } from "date-fns";

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  deadline: string | null;
  assignee_id: string | null;
  column_id: string | null;
}

interface TaskWithAssignee extends Task {
  assignee?: { first_name: string | null; last_name: string | null } | null;
}

const priorityColors: Record<string, string> = {
  low: "bg-green-500/20 text-green-700 dark:text-green-300",
  medium: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
  high: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
  urgent: "bg-red-500/20 text-red-700 dark:text-red-300"
};

interface DraggableTaskCardProps {
  task: TaskWithAssignee;
  onClick: () => void;
}

export const DraggableTaskCard = ({ task, onClick }: DraggableTaskCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getAssigneeName = () => {
    if (!task.assignee) return null;
    return `${task.assignee.first_name || ''} ${task.assignee.last_name || ''}`.trim();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-3 rounded-lg border bg-card hover:bg-accent transition-colors cursor-pointer ${
        isDragging ? "opacity-50 shadow-lg ring-2 ring-primary" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <div
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{task.title}</p>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {task.description}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge className={priorityColors[task.priority]}>
              {task.priority}
            </Badge>
            {task.deadline && (
              <Badge variant="outline" className="gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(task.deadline), 'dd/MM')}
              </Badge>
            )}
          </div>
          {getAssigneeName() && (
            <p className="text-xs text-muted-foreground mt-2">
              👤 {getAssigneeName()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
