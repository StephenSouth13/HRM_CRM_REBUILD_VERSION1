import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/auth";
import { UserRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit2, Trash2, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TaskColumn {
  id: string;
  name: string;
  position: number;
  is_default: boolean;
  board_id: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assignee_id: string | null;
  created_at: string;
}

interface TaskWithAssignee extends Task {
  assignee?: { first_name: string | null; last_name: string | null };
}

const TaskBoardEnhanced = ({ role }: { role: UserRole }) => {
  const [columns, setColumns] = useState<TaskColumn[]>([]);
  const [tasks, setTasks] = useState<TaskWithAssignee[]>([]);
  const [boardId, setBoardId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isNewColumnOpen, setIsNewColumnOpen] = useState(false);
  const [isEditColumnOpen, setIsEditColumnOpen] = useState(false);
  const [isDeleteColumnOpen, setIsDeleteColumnOpen] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<TaskColumn | null>(null);
  const [columnFormData, setColumnFormData] = useState({ name: "" });
  const [taskFormData, setTaskFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    dueDate: "",
    assigneeId: ""
  });
  const [deleteTarget, setDeleteTarget] = useState<TaskColumn | null>(null);
  const [migrateToColumnId, setMigrateToColumnId] = useState<string>("");
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const { data: boards, error: boardsError } = await (supabase as any)
        .from('task_boards')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (boardsError && boardsError.code !== 'PGRST116') throw boardsError;

      const defaultBoardId = boards?.id || await createDefaultBoard();
      setBoardId(defaultBoardId);

      const { data: columnsData, error: columnsError } = await (supabase as any)
        .from('task_columns')
        .select('*')
        .eq('board_id', defaultBoardId)
        .order('position');

      if (columnsError) throw columnsError;
      setColumns(columnsData || []);

      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          *,
          assignee:assignee_id(first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;
      setTasks((tasksData || []) as any);

      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .order('first_name');

      if (usersError) throw usersError;
      setAllUsers(usersData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load task board data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createDefaultBoard = async () => {
    const { data, error } = await (supabase as any)
      .from('task_boards')
      .insert([{ name: 'Default Board', is_active: true }])
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  };

  const handleCreateColumn = async () => {
    if (!columnFormData.name.trim()) {
      toast({
        title: "Error",
        description: "Column name is required",
        variant: "destructive"
      });
      return;
    }

    try {
      const newPosition = Math.max(...columns.map(c => c.position), -1) + 1;

      const { error } = await (supabase as any)
        .from('task_columns')
        .insert([{
          board_id: boardId,
          name: columnFormData.name,
          position: newPosition,
          is_default: false
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Column created successfully"
      });

      setColumnFormData({ name: "" });
      setIsNewColumnOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error creating column:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create column",
        variant: "destructive"
      });
    }
  };

  const handleEditColumn = async () => {
    if (!selectedColumn || !columnFormData.name.trim()) {
      toast({
        title: "Error",
        description: "Column name is required",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from('task_columns')
        .update({ name: columnFormData.name })
        .eq('id', selectedColumn.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Column updated successfully"
      });

      setIsEditColumnOpen(false);
      setSelectedColumn(null);
      loadData();
    } catch (error: any) {
      console.error('Error updating column:', error);
      toast({
        title: "Error",
        description: "Failed to update column",
        variant: "destructive"
      });
    }
  };

  const handleDeleteColumn = async () => {
    if (!deleteTarget || !migrateToColumnId) {
      toast({
        title: "Error",
        description: "Please select a column to migrate tasks to",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status: migrateToColumnId as any })
        .eq('status', deleteTarget.name as any);

      if (updateError) throw updateError;

      const { error: deleteError } = await (supabase as any)
        .from('task_columns')
        .delete()
        .eq('id', deleteTarget.id);

      if (deleteError) throw deleteError;

      toast({
        title: "Success",
        description: "Column deleted and tasks migrated"
      });

      setIsDeleteColumnOpen(false);
      setDeleteTarget(null);
      setMigrateToColumnId("");
      loadData();
    } catch (error) {
      console.error('Error deleting column:', error);
      toast({
        title: "Error",
        description: "Failed to delete column",
        variant: "destructive"
      });
    }
  };

  const handleCreateTask = async () => {
    if (!selectedColumn || !taskFormData.title.trim()) {
      toast({
        title: "Error",
        description: "Task title and column are required",
        variant: "destructive"
      });
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
          status: selectedColumn.name as any,
          priority: taskFormData.priority as any,
          due_date: taskFormData.dueDate || null,
          assignee_id: taskFormData.assigneeId || null,
          creator_id: user.id
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Task created successfully"
      });

      setTaskFormData({
        title: "",
        description: "",
        priority: "medium",
        dueDate: "",
        assigneeId: ""
      });
      setIsNewTaskOpen(false);
      setSelectedColumn(null);
      loadData();
    } catch (error: any) {
      console.error('Error creating task:', error);
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive"
      });
    }
  };

  const openEditColumn = (column: TaskColumn) => {
    setSelectedColumn(column);
    setColumnFormData({ name: column.name });
    setIsEditColumnOpen(true);
  };

  const openDeleteColumn = (column: TaskColumn) => {
    setDeleteTarget(column);
    setMigrateToColumnId("");
    setIsDeleteColumnOpen(true);
  };

  const openNewTaskDialog = (column: TaskColumn) => {
    setSelectedColumn(column);
    setIsNewTaskOpen(true);
  };

  if (loading) {
    return <div className="text-muted-foreground text-center py-12">Loading task board...</div>;
  }

  const getColumnTasks = (columnName: string) => {
    return tasks.filter(t => t.status === columnName);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Task Board</h3>
        <Dialog open={isNewColumnOpen} onOpenChange={setIsNewColumnOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setColumnFormData({ name: "" })}>
              <Plus className="h-4 w-4 mr-2" />
              New Column
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Column</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="columnName">Column Name *</Label>
                <Input
                  id="columnName"
                  value={columnFormData.name}
                  onChange={(e) => setColumnFormData({ name: e.target.value })}
                  placeholder="e.g., Testing, Backlog"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsNewColumnOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateColumn}>
                  Create Column
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid auto-cols-max gap-4 overflow-x-auto pb-4">
        {columns.map((column) => {
          const columnTasks = getColumnTasks(column.name);
          return (
            <Card key={column.id} className="flex-shrink-0 w-80">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <CardTitle className="flex-1 text-sm">{column.name}</CardTitle>
                  {!column.is_default && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditColumn(column)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openDeleteColumn(column)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{columnTasks.length} tasks</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {columnTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg border bg-card hover:bg-accent transition-colors cursor-move"
                  >
                    <p className="font-medium text-sm">{task.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                  </div>
                ))}

                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => openNewTaskDialog(column)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Task
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={isEditColumnOpen} onOpenChange={setIsEditColumnOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Column</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editColumnName">Column Name *</Label>
              <Input
                id="editColumnName"
                value={columnFormData.name}
                onChange={(e) => setColumnFormData({ name: e.target.value })}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsEditColumnOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditColumn}>
                Update Column
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteColumnOpen} onOpenChange={setIsDeleteColumnOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete Column "{deleteTarget?.name}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This column has {getColumnTasks(deleteTarget?.name || "").length} task(s). Please select which column to migrate them to.
          </AlertDialogDescription>
          <div className="space-y-4">
            <div>
              <Label htmlFor="migrateColumn">Migrate tasks to:</Label>
              <Select value={migrateToColumnId} onValueChange={setMigrateToColumnId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {columns
                    .filter(c => c.id !== deleteTarget?.id)
                    .map(c => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteColumn} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete Column
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isNewTaskOpen} onOpenChange={setIsNewTaskOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Task in {selectedColumn?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="taskTitle">Task Title *</Label>
              <Input
                id="taskTitle"
                value={taskFormData.title}
                onChange={(e) => setTaskFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Task title"
              />
            </div>

            <div>
              <Label htmlFor="taskDescription">Description</Label>
              <Textarea
                id="taskDescription"
                value={taskFormData.description}
                onChange={(e) => setTaskFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Task description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="taskPriority">Priority</Label>
                <Select value={taskFormData.priority} onValueChange={(value) => setTaskFormData(prev => ({ ...prev, priority: value }))}>
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
                <Label htmlFor="taskAssignee">Assignee</Label>
                <Select value={taskFormData.assigneeId} onValueChange={(value) => setTaskFormData(prev => ({ ...prev, assigneeId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.first_name} {user.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="taskDueDate">Due Date</Label>
              <Input
                id="taskDueDate"
                type="date"
                value={taskFormData.dueDate}
                onChange={(e) => setTaskFormData(prev => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsNewTaskOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTask}>
                Create Task
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TaskBoardEnhanced;
