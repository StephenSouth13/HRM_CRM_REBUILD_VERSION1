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

interface DroppableColumnProps {
  column: TaskColumn;
  tasks: TaskWithAssignee[];
  onEditColumn: () => void;
  onDeleteColumn: () => void;
  onAddTask: () => void;
  onEditTask: (task: TaskWithAssignee) => void;
}

export const DroppableColumn = ({
  column,
  tasks,
  onEditColumn,
  onDeleteColumn,
  onAddTask,
  onEditTask,
}: DroppableColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <Card
      ref={setNodeRef}
      className={`flex-shrink-0 w-80 border-t-4 transition-colors ${
        isOver ? "ring-2 ring-primary bg-accent/50" : ""
      }`}
      style={{ borderTopColor: column.color || '#3b82f6' }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
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
        <p className="text-xs text-muted-foreground">{tasks.length} tasks</p>
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
  );
};
