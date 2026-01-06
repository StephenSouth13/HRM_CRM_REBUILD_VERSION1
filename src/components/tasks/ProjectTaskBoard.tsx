import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/auth";
import { UserRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, isThisWeek, isThisMonth, isBefore, startOfDay } from "date-fns";
import ProjectSelector from "./ProjectSelector";
import ProjectTaskSearchFilter from "./ProjectTaskSearchFilter";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { SortableColumn } from "./SortableColumn";

interface Project {
  id: string;
  name: string;
  description: string | null;
  team_id: string;
  is_active: boolean;
  created_at: string;
}

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
  status: string;
  priority: string;
  deadline: string | null;
  assignee_id: string | null;
  column_id: string | null;
  created_at: string;
}

interface TaskWithAssignee extends Task {
  assignee?: { first_name: string | null; last_name: string | null } | null;
}

interface User {
  id: string;
  first_name: string | null;
  last_name: string | null;
}


const ProjectTaskBoard = ({ role }: { role: UserRole }) => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [columns, setColumns] = useState<TaskColumn[]>([]);
  const [tasks, setTasks] = useState<TaskWithAssignee[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTask, setActiveTask] = useState<TaskWithAssignee | null>(null);
  const [activeColumn, setActiveColumn] = useState<TaskColumn | null>(null);
  
  // Dialog states
  const [isNewColumnOpen, setIsNewColumnOpen] = useState(false);
  const [isEditColumnOpen, setIsEditColumnOpen] = useState(false);
  const [isDeleteColumnOpen, setIsDeleteColumnOpen] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [isEditTaskOpen, setIsEditTaskOpen] = useState(false);
  
  const [selectedColumn, setSelectedColumn] = useState<TaskColumn | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskColumn | null>(null);
  const [migrateToColumnId, setMigrateToColumnId] = useState<string>("");
  
  const [columnFormData, setColumnFormData] = useState({ name: "", color: "#3b82f6" });
  const [taskFormData, setTaskFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    deadline: "",
    assigneeId: ""
  });
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [deadlineFilter, setDeadlineFilter] = useState("all");
  
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadProjectData();
    }
  }, [selectedProject]);

  const loadUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .order('first_name');
    setUsers(data || []);
  };

  const loadProjectData = async () => {
    if (!selectedProject) return;
    
    setLoading(true);
    try {
      const columnsResult = await supabase
        .from('task_columns')
        .select('*')
        .eq('project_id', selectedProject.id)
        .order('position');

      if (columnsResult.error) throw columnsResult.error;

      const columnIds = (columnsResult.data || []).map(c => c.id);
      
      if (columnIds.length === 0) {
        setColumns([]);
        setTasks([]);
        return;
      }

      const tasksResult = await supabase
        .from('tasks')
        .select('*')
        .in('column_id', columnIds);

      if (tasksResult.error) throw tasksResult.error;

      // Fetch assignees separately
      const assigneeIds = (tasksResult.data || []).filter(t => t.assignee_id).map(t => t.assignee_id);
      let assigneesMap: Record<string, { first_name: string | null; last_name: string | null }> = {};
      
      if (assigneeIds.length > 0) {
        const assigneesResult = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', assigneeIds);
        
        if (assigneesResult.data) {
          assigneesResult.data.forEach(a => {
            assigneesMap[a.id] = { first_name: a.first_name, last_name: a.last_name };
          });
        }
      }

      setColumns(columnsResult.data || []);
      
      // Map tasks with assignees
      const projectTasks = (tasksResult.data || []).map(t => ({
        ...t,
        assignee: t.assignee_id ? assigneesMap[t.assignee_id] || null : null
      }));
      setTasks(projectTasks as TaskWithAssignee[]);
    } catch (error) {
      console.error('Error loading project data:', error);
      toast({
        title: "Lỗi",
        description: "Không thể tải dữ liệu dự án",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateColumn = async () => {
    if (!selectedProject || !columnFormData.name.trim()) {
      toast({
        title: "Lỗi",
        description: "Tên cột là bắt buộc",
        variant: "destructive"
      });
      return;
    }

    try {
      const user = await getCurrentUser();
      if (!user) throw new Error("Not authenticated");

      const newPosition = Math.max(...columns.map(c => c.position), -1) + 1;

      const { error } = await supabase
        .from('task_columns')
        .insert([{
          project_id: selectedProject.id,
          name: columnFormData.name,
          color: columnFormData.color,
          position: newPosition,
          created_by: user.id
        }]);

      if (error) throw error;

      toast({ title: "Thành công", description: "Đã tạo cột mới" });
      setColumnFormData({ name: "", color: "#3b82f6" });
      setIsNewColumnOpen(false);
      loadProjectData();
    } catch (error: any) {
      console.error('Error creating column:', error);
      toast({
        title: "Lỗi",
        description: error.message || "Không thể tạo cột",
        variant: "destructive"
      });
    }
  };

  const handleEditColumn = async () => {
    if (!selectedColumn || !columnFormData.name.trim()) return;

    try {
      const { error } = await supabase
        .from('task_columns')
        .update({ name: columnFormData.name, color: columnFormData.color })
        .eq('id', selectedColumn.id);

      if (error) throw error;

      toast({ title: "Thành công", description: "Đã cập nhật cột" });
      setIsEditColumnOpen(false);
      loadProjectData();
    } catch (error) {
      toast({ title: "Lỗi", description: "Không thể cập nhật cột", variant: "destructive" });
    }
  };

  const handleDeleteColumn = async () => {
    if (!deleteTarget) return;

    try {
      // Migrate tasks if needed
      if (migrateToColumnId) {
        await supabase
          .from('tasks')
          .update({ column_id: migrateToColumnId })
          .eq('column_id', deleteTarget.id);
      }

      const { error } = await supabase
        .from('task_columns')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;

      toast({ title: "Thành công", description: "Đã xóa cột" });
      setIsDeleteColumnOpen(false);
      setDeleteTarget(null);
      loadProjectData();
    } catch (error) {
      toast({ title: "Lỗi", description: "Không thể xóa cột", variant: "destructive" });
    }
  };

  const handleCreateTask = async () => {
    if (!selectedColumn || !taskFormData.title.trim()) {
      toast({ title: "Lỗi", description: "Tiêu đề task là bắt buộc", variant: "destructive" });
      return;
    }

    try {
      const user = await getCurrentUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('tasks')
        .insert([{
          title: taskFormData.title,
          description: taskFormData.description || null,
          priority: taskFormData.priority as any,
          deadline: taskFormData.deadline || null,
          assignee_id: taskFormData.assigneeId || null,
          column_id: selectedColumn.id,
          status: 'todo' as any,
          creator_id: user.id,
          team_id: selectedProject?.team_id
        }]);

      if (error) throw error;

      toast({ title: "Thành công", description: "Đã tạo task mới" });
      resetTaskForm();
      setIsNewTaskOpen(false);
      loadProjectData();
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message || "Không thể tạo task", variant: "destructive" });
    }
  };

  const handleEditTask = async () => {
    if (!selectedTask || !taskFormData.title.trim()) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: taskFormData.title,
          description: taskFormData.description || null,
          priority: taskFormData.priority as any,
          deadline: taskFormData.deadline || null,
          assignee_id: taskFormData.assigneeId || null
        })
        .eq('id', selectedTask.id);

      if (error) throw error;

      toast({ title: "Thành công", description: "Đã cập nhật task" });
      setIsEditTaskOpen(false);
      loadProjectData();
    } catch (error) {
      toast({ title: "Lỗi", description: "Không thể cập nhật task", variant: "destructive" });
    }
  };

  const handleMoveTask = async (taskId: string, newColumnId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ column_id: newColumnId })
        .eq('id', taskId);

      if (error) throw error;
      loadProjectData();
    } catch (error) {
      toast({ title: "Lỗi", description: "Không thể di chuyển task", variant: "destructive" });
    }
  };

  const resetTaskForm = () => {
    setTaskFormData({
      title: "",
      description: "",
      priority: "medium",
      deadline: "",
      assigneeId: ""
    });
  };

  const openEditColumn = (column: TaskColumn) => {
    setSelectedColumn(column);
    setColumnFormData({ name: column.name, color: column.color || "#3b82f6" });
    setIsEditColumnOpen(true);
  };

  const openDeleteColumn = (column: TaskColumn) => {
    setDeleteTarget(column);
    setMigrateToColumnId("");
    setIsDeleteColumnOpen(true);
  };

  const openNewTaskDialog = (column: TaskColumn) => {
    setSelectedColumn(column);
    resetTaskForm();
    setIsNewTaskOpen(true);
  };

  const openEditTaskDialog = (task: TaskWithAssignee) => {
    setSelectedTask(task);
    setTaskFormData({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      deadline: task.deadline ? format(new Date(task.deadline), 'yyyy-MM-dd') : "",
      assigneeId: task.assignee_id || ""
    });
    setIsEditTaskOpen(true);
  };

  // Filter tasks based on search and filters
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Search by title
      if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Filter by priority
      if (priorityFilter !== "all" && task.priority !== priorityFilter) {
        return false;
      }
      
      // Filter by assignee
      if (assigneeFilter === "unassigned" && task.assignee_id) {
        return false;
      }
      if (assigneeFilter !== "all" && assigneeFilter !== "unassigned" && task.assignee_id !== assigneeFilter) {
        return false;
      }
      
      // Filter by deadline
      if (deadlineFilter !== "all") {
        const deadline = task.deadline ? new Date(task.deadline) : null;
        const today = startOfDay(new Date());
        
        switch (deadlineFilter) {
          case "overdue":
            if (!deadline || !isBefore(deadline, today)) return false;
            break;
          case "today":
            if (!deadline || !isToday(deadline)) return false;
            break;
          case "week":
            if (!deadline || !isThisWeek(deadline)) return false;
            break;
          case "month":
            if (!deadline || !isThisMonth(deadline)) return false;
            break;
          case "no_deadline":
            if (deadline) return false;
            break;
        }
      }
      
      return true;
    });
  }, [tasks, searchQuery, priorityFilter, assigneeFilter, deadlineFilter]);

  const getColumnTasks = (columnId: string) => {
    return filteredTasks.filter(t => t.column_id === columnId);
  };

  const getTotalColumnTasks = (columnId: string) => {
    return tasks.filter(t => t.column_id === columnId).length;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeId = active.id as string;
    
    // Check if it's a column being dragged
    if (activeId.startsWith('column-')) {
      const columnId = activeId.replace('column-', '');
      const column = columns.find(c => c.id === columnId);
      setActiveColumn(column || null);
      setActiveTask(null);
    } else {
      // It's a task
      const task = tasks.find(t => t.id === activeId);
      setActiveTask(task || null);
      setActiveColumn(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    setActiveColumn(null);
    
    if (!over) return;
    
    const activeId = active.id as string;
    const overId = over.id as string;
    
    // Handle column reordering
    if (activeId.startsWith('column-') && overId.startsWith('column-')) {
      const activeColumnId = activeId.replace('column-', '');
      const overColumnId = overId.replace('column-', '');
      
      if (activeColumnId !== overColumnId) {
        const oldIndex = columns.findIndex(c => c.id === activeColumnId);
        const newIndex = columns.findIndex(c => c.id === overColumnId);
        
        const newColumns = arrayMove(columns, oldIndex, newIndex);
        setColumns(newColumns);
        
        // Update positions in database
        try {
          const updates = newColumns.map((col, idx) => 
            supabase
              .from('task_columns')
              .update({ position: idx })
              .eq('id', col.id)
          );
          await Promise.all(updates);
        } catch (error) {
          console.error('Error updating column positions:', error);
          loadProjectData(); // Reload on error
        }
      }
      return;
    }
    
    // Handle task moving
    const taskId = activeId;
    
    // Check if dropped on a column
    const targetColumn = columns.find(c => c.id === overId);
    if (targetColumn) {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.column_id !== targetColumn.id) {
        handleMoveTask(taskId, targetColumn.id);
      }
      return;
    }
    
    // Check if dropped on another task - move to that task's column
    const targetTask = tasks.find(t => t.id === overId);
    if (targetTask && targetTask.column_id) {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.column_id !== targetTask.column_id) {
        handleMoveTask(taskId, targetTask.column_id);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <ProjectSelector 
          selectedProject={selectedProject} 
          onProjectChange={setSelectedProject} 
        />
        
        {selectedProject && (
          <Button onClick={() => {
            setColumnFormData({ name: "", color: "#3b82f6" });
            setIsNewColumnOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Thêm Cột
          </Button>
        )}
      </div>

      {selectedProject && (
        <ProjectTaskSearchFilter
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          priorityFilter={priorityFilter}
          onPriorityChange={setPriorityFilter}
          assigneeFilter={assigneeFilter}
          onAssigneeChange={setAssigneeFilter}
          deadlineFilter={deadlineFilter}
          onDeadlineChange={setDeadlineFilter}
          users={users}
        />
      )}

      {!selectedProject ? (
        <div className="text-center py-12 text-muted-foreground">
          Chọn hoặc tạo dự án để bắt đầu
        </div>
      ) : loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Đang tải...
        </div>
      ) : columns.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Dự án chưa có cột nào. Nhấn "Thêm Cột" để bắt đầu.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={columns.map(c => `column-${c.id}`)} strategy={horizontalListSortingStrategy}>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {columns.map((column) => (
                <SortableColumn
                  key={column.id}
                  column={column}
                  tasks={getColumnTasks(column.id)}
                  totalTasks={getTotalColumnTasks(column.id)}
                  onEditColumn={() => openEditColumn(column)}
                  onDeleteColumn={() => openDeleteColumn(column)}
                  onAddTask={() => openNewTaskDialog(column)}
                  onEditTask={openEditTaskDialog}
                />
              ))}
            </div>
          </SortableContext>
          
          <DragOverlay>
            {activeTask ? (
              <div className="p-3 rounded-lg border bg-card shadow-lg opacity-90">
                <p className="font-medium text-sm">{activeTask.title}</p>
              </div>
            ) : activeColumn ? (
              <div className="w-80 p-4 rounded-lg border bg-card shadow-lg opacity-90 border-t-4" style={{ borderTopColor: activeColumn.color || '#3b82f6' }}>
                <p className="font-medium text-sm">{activeColumn.name}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Create Column Dialog */}
      <Dialog open={isNewColumnOpen} onOpenChange={setIsNewColumnOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tạo Cột Mới</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="columnName">Tên cột *</Label>
              <Input
                id="columnName"
                value={columnFormData.name}
                onChange={(e) => setColumnFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="VD: To Do, In Progress, Done"
              />
            </div>
            <div>
              <Label htmlFor="columnColor">Màu</Label>
              <Input
                id="columnColor"
                type="color"
                value={columnFormData.color}
                onChange={(e) => setColumnFormData(prev => ({ ...prev, color: e.target.value }))}
                className="h-10 w-20"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsNewColumnOpen(false)}>Hủy</Button>
              <Button onClick={handleCreateColumn}>Tạo Cột</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Column Dialog */}
      <Dialog open={isEditColumnOpen} onOpenChange={setIsEditColumnOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sửa Cột</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editColumnName">Tên cột *</Label>
              <Input
                id="editColumnName"
                value={columnFormData.name}
                onChange={(e) => setColumnFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="editColumnColor">Màu</Label>
              <Input
                id="editColumnColor"
                type="color"
                value={columnFormData.color}
                onChange={(e) => setColumnFormData(prev => ({ ...prev, color: e.target.value }))}
                className="h-10 w-20"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsEditColumnOpen(false)}>Hủy</Button>
              <Button onClick={handleEditColumn}>Lưu</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Column Dialog */}
      <AlertDialog open={isDeleteColumnOpen} onOpenChange={setIsDeleteColumnOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Xóa cột "{deleteTarget?.name}"?</AlertDialogTitle>
          <AlertDialogDescription>
            Cột này có {getColumnTasks(deleteTarget?.id || "").length} task(s). 
            Chọn cột để di chuyển các task sang.
          </AlertDialogDescription>
          <div className="space-y-4">
            <Select value={migrateToColumnId} onValueChange={setMigrateToColumnId}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn cột đích" />
              </SelectTrigger>
              <SelectContent>
                {columns.filter(c => c.id !== deleteTarget?.id).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 justify-end">
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteColumn} 
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Xóa
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Task Dialog */}
      <Dialog open={isNewTaskOpen} onOpenChange={setIsNewTaskOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tạo Task trong "{selectedColumn?.name}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="taskTitle">Tiêu đề *</Label>
              <Input
                id="taskTitle"
                value={taskFormData.title}
                onChange={(e) => setTaskFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Tiêu đề task"
              />
            </div>
            <div>
              <Label htmlFor="taskDesc">Mô tả</Label>
              <Textarea
                id="taskDesc"
                value={taskFormData.description}
                onChange={(e) => setTaskFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="taskPriority">Độ ưu tiên</Label>
                <Select 
                  value={taskFormData.priority} 
                  onValueChange={(value) => setTaskFormData(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Thấp</SelectItem>
                    <SelectItem value="medium">Trung bình</SelectItem>
                    <SelectItem value="high">Cao</SelectItem>
                    <SelectItem value="urgent">Khẩn cấp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="taskDeadline">Deadline</Label>
                <Input
                  id="taskDeadline"
                  type="date"
                  value={taskFormData.deadline}
                  onChange={(e) => setTaskFormData(prev => ({ ...prev, deadline: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="taskAssignee">Giao cho</Label>
              <Select 
                value={taskFormData.assigneeId} 
                onValueChange={(value) => setTaskFormData(prev => ({ ...prev, assigneeId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn người thực hiện" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsNewTaskOpen(false)}>Hủy</Button>
              <Button onClick={handleCreateTask}>Tạo Task</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={isEditTaskOpen} onOpenChange={setIsEditTaskOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sửa Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editTaskTitle">Tiêu đề *</Label>
              <Input
                id="editTaskTitle"
                value={taskFormData.title}
                onChange={(e) => setTaskFormData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="editTaskDesc">Mô tả</Label>
              <Textarea
                id="editTaskDesc"
                value={taskFormData.description}
                onChange={(e) => setTaskFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Độ ưu tiên</Label>
                <Select 
                  value={taskFormData.priority} 
                  onValueChange={(value) => setTaskFormData(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Thấp</SelectItem>
                    <SelectItem value="medium">Trung bình</SelectItem>
                    <SelectItem value="high">Cao</SelectItem>
                    <SelectItem value="urgent">Khẩn cấp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Deadline</Label>
                <Input
                  type="date"
                  value={taskFormData.deadline}
                  onChange={(e) => setTaskFormData(prev => ({ ...prev, deadline: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Giao cho</Label>
              <Select 
                value={taskFormData.assigneeId} 
                onValueChange={(value) => setTaskFormData(prev => ({ ...prev, assigneeId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn người thực hiện" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsEditTaskOpen(false)}>Hủy</Button>
              <Button onClick={handleEditTask}>Lưu</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectTaskBoard;
