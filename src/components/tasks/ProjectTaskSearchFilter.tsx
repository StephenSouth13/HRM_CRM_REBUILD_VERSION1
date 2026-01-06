import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X, Search, Filter } from "lucide-react";

interface User {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface ProjectTaskSearchFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  priorityFilter: string;
  onPriorityChange: (priority: string) => void;
  assigneeFilter: string;
  onAssigneeChange: (assignee: string) => void;
  deadlineFilter: string;
  onDeadlineChange: (deadline: string) => void;
  users: User[];
}

const ProjectTaskSearchFilter = ({
  searchQuery,
  onSearchChange,
  priorityFilter,
  onPriorityChange,
  assigneeFilter,
  onAssigneeChange,
  deadlineFilter,
  onDeadlineChange,
  users,
}: ProjectTaskSearchFilterProps) => {
  const hasActiveFilters = searchQuery || priorityFilter !== "all" || assigneeFilter !== "all" || deadlineFilter !== "all";

  const handleClearFilters = () => {
    onSearchChange("");
    onPriorityChange("all");
    onAssigneeChange("all");
    onDeadlineChange("all");
  };

  return (
    <div className="space-y-3 p-4 bg-secondary/30 rounded-lg border border-border">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <Filter className="h-4 w-4" />
        <span>Lọc & Tìm kiếm</span>
      </div>
      
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm theo tiêu đề..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-background pl-9"
          />
        </div>

        <div className="min-w-[140px]">
          <Select value={priorityFilter} onValueChange={onPriorityChange}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Độ ưu tiên" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả độ ưu tiên</SelectItem>
              <SelectItem value="low">Thấp</SelectItem>
              <SelectItem value="medium">Trung bình</SelectItem>
              <SelectItem value="high">Cao</SelectItem>
              <SelectItem value="urgent">Khẩn cấp</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[160px]">
          <Select value={assigneeFilter} onValueChange={onAssigneeChange}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Người được giao" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả người được giao</SelectItem>
              <SelectItem value="unassigned">Chưa giao</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.first_name} {user.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[140px]">
          <Select value={deadlineFilter} onValueChange={onDeadlineChange}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Thời hạn" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả thời hạn</SelectItem>
              <SelectItem value="overdue">Quá hạn</SelectItem>
              <SelectItem value="today">Hôm nay</SelectItem>
              <SelectItem value="week">Tuần này</SelectItem>
              <SelectItem value="month">Tháng này</SelectItem>
              <SelectItem value="no_deadline">Không có deadline</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={handleClearFilters} className="gap-1 h-10">
            <X className="h-4 w-4" />
            Xóa bộ lọc
          </Button>
        )}
      </div>
    </div>
  );
};

export default ProjectTaskSearchFilter;
