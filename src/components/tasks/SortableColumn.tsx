import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, GripVertical, Plus } from "lucide-react";
import { DraggableTaskCard } from "./DraggableTaskCard";

interface TaskColumn {
  id: string;
  name: string;
  position: number;
  color: string | null;
  project_id: string;
}

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

interface SortableColumnProps {
  column: TaskColumn;
  tasks: TaskWithAssignee[];
  totalTasks?: number; // Total tasks before filtering
  onEditColumn: () => void;
  onDeleteColumn: () => void;
  onAddTask: () => void;
  onEditTask: (task: TaskWithAssignee) => void;
}

export const SortableColumn = ({
  column,
  tasks,
  totalTasks,
  onEditColumn,
  onDeleteColumn,
  onAddTask,
  onEditTask,
}: SortableColumnProps) => {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: `column-${column.id}`,
    data: { type: 'column', column }
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column', column }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setSortableRef}
      style={style}
      className={`flex-shrink-0 ${isDragging ? "opacity-50" : ""}`}
    >
      <Card
        ref={setDroppableRef}
        className={`w-80 border-t-4 transition-colors ${
          isOver ? "ring-2 ring-primary bg-accent/50" : ""
        } ${isDragging ? "shadow-2xl" : ""}`}
        style={{ borderTopColor: column.color || '#3b82f6' }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardTitle className="flex-1 text-sm">{column.name}</CardTitle>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={onEditColumn}>
                <Edit2 className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={onDeleteColumn}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {totalTasks !== undefined && totalTasks !== tasks.length ? (
              <span>
                <span className="font-medium text-foreground">{tasks.length}</span>
                <span> / {totalTasks} tasks</span>
              </span>
            ) : (
              <span>{tasks.length} tasks</span>
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto">
          <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {tasks.map((task) => (
              <DraggableTaskCard
                key={task.id}
                task={task}
                onClick={() => onEditTask(task)}
              />
            ))}
          </SortableContext>

          <Button
            variant="outline"
            className="w-full mt-2"
            onClick={onAddTask}
          >
            <Plus className="h-4 w-4 mr-2" />
            Thêm Task
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
