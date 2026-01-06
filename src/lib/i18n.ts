import { create } from 'zustand';

export type Language = 'vi' | 'en';

interface I18nState {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  vi: {
    // Common
    'common.loading': 'Đang tải...',
    'common.save': 'Lưu',
    'common.cancel': 'Hủy',
    'common.add': 'Thêm',
    'common.edit': 'Sửa',
    'common.delete': 'Xóa',
    'common.actions': 'Hành động',
    'common.success': 'Thành công',
    'common.error': 'Lỗi',
    'common.confirm': 'Xác nhận',
    'common.search': 'Tìm kiếm',
    'common.filter': 'Lọc',
    'common.total': 'Tổng cộng',
    'common.noData': 'Không có dữ liệu',
    
    // Navigation
    'nav.dashboard': 'Bảng điều khiển',
    'nav.attendance': 'Chấm công',
    'nav.tasks': 'Công việc',
    'nav.meetings': 'Cuộc họp',
    'nav.leave': 'Nghỉ phép',
    'nav.salary': 'Lương thưởng',
    'nav.messages': 'Tin nhắn',
    'nav.organization': 'Tổ chức',
    'nav.profile': 'Hồ sơ',
    'nav.logout': 'Đăng xuất',
    
    // Teams
    'team.title': 'Quản lý Team',
    'team.members': 'Thành viên',
    'team.membersOf': 'Thành viên của',
    'team.addMember': 'Thêm thành viên',
    'team.removeMember': 'Xóa khỏi team',
    'team.selectUser': 'Chọn người dùng để thêm vào team',
    'team.noAvailableUsers': 'Không có người dùng khả dụng',
    'team.noMembers': 'Chưa có thành viên nào trong team',
    'team.cannotRemoveLeader': 'Không thể xóa leader khỏi team',
    'team.memberAdded': 'Đã thêm thành viên vào team',
    'team.memberRemoved': 'Đã xóa thành viên khỏi team',
    'team.loadError': 'Không thể tải danh sách thành viên',
    'team.addError': 'Không thể thêm thành viên',
    'team.removeError': 'Không thể xóa thành viên',
    'team.projects': 'Dự án',
    
    // Roles
    'role.label': 'Vai trò',
    'role.leader': 'Leader',
    'role.member': 'Member',
    'role.developer': 'Developer',
    'role.designer': 'Designer',
    'role.tester': 'Tester',
    'role.selectRole': 'Chọn vai trò',
    'role.updated': 'Đã cập nhật vai trò',
    'role.updateError': 'Không thể cập nhật vai trò',
    
    // Email
    'email': 'Email',
  },
  en: {
    // Common
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.add': 'Add',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.actions': 'Actions',
    'common.success': 'Success',
    'common.error': 'Error',
    'common.confirm': 'Confirm',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.total': 'Total',
    'common.noData': 'No data',
    
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.attendance': 'Attendance',
    'nav.tasks': 'Tasks',
    'nav.meetings': 'Meetings',
    'nav.leave': 'Leave',
    'nav.salary': 'Salary',
    'nav.messages': 'Messages',
    'nav.organization': 'Organization',
    'nav.profile': 'Profile',
    'nav.logout': 'Logout',
    
    // Teams
    'team.title': 'Team Management',
    'team.members': 'Members',
    'team.membersOf': 'Members of',
    'team.addMember': 'Add member',
    'team.removeMember': 'Remove from team',
    'team.selectUser': 'Select user to add to team',
    'team.noAvailableUsers': 'No available users',
    'team.noMembers': 'No members in this team yet',
    'team.cannotRemoveLeader': 'Cannot remove leader from team',
    'team.memberAdded': 'Member added to team',
    'team.memberRemoved': 'Member removed from team',
    'team.loadError': 'Failed to load team members',
    'team.addError': 'Failed to add member',
    'team.removeError': 'Failed to remove member',
    'team.projects': 'Projects',
    
    // Roles
    'role.label': 'Role',
    'role.leader': 'Leader',
    'role.member': 'Member',
    'role.developer': 'Developer',
    'role.designer': 'Designer',
    'role.tester': 'Tester',
    'role.selectRole': 'Select role',
    'role.updated': 'Role updated',
    'role.updateError': 'Failed to update role',
    
    // Email
    'email': 'Email',
  }
};

const getInitialLanguage = (): Language => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('language');
    if (saved === 'vi' || saved === 'en') return saved;
  }
  return 'vi';
};

export const useI18n = create<I18nState>((set, get) => ({
  language: getInitialLanguage(),
  setLanguage: (lang: Language) => {
    localStorage.setItem('language', lang);
    set({ language: lang });
  },
  t: (key: string) => {
    const { language } = get();
    return translations[language][key] || key;
  }
}));

// Helper hook for translation
export const useTranslation = () => {
  const { t, language, setLanguage } = useI18n();
  return { t, language, setLanguage };
};
