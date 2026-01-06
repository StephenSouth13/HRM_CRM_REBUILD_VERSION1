import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserPlus, UserMinus, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";

type TeamRole = 'developer' | 'designer' | 'tester' | 'leader' | 'member';

interface TeamMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  avatar_url: string | null;
  team_id: string | null;
  team_role: TeamRole | null;
}

interface Team {
  id: string;
  name: string;
  leader_id: string | null;
}

interface TeamMembersManagementProps {
  team: Team;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMembersChange: () => void;
}

const TeamMembersManagement = ({ team, open, onOpenChange, onMembersChange }: TeamMembersManagementProps) => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [availableUsers, setAvailableUsers] = useState<TeamMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useTranslation();

  const teamRoles: { value: TeamRole; labelKey: string }[] = [
    { value: 'developer', labelKey: 'role.developer' },
    { value: 'designer', labelKey: 'role.designer' },
    { value: 'tester', labelKey: 'role.tester' },
    { value: 'member', labelKey: 'role.member' },
  ];

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, team.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: membersData, error: membersError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, avatar_url, team_id, team_role')
        .eq('team_id', team.id)
        .order('first_name');

      if (membersError) throw membersError;
      setMembers((membersData || []) as TeamMember[]);

      const { data: availableData, error: availableError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, avatar_url, team_id, team_role')
        .is('team_id', null)
        .order('first_name');

      if (availableError) throw availableError;
      setAvailableUsers((availableData || []) as TeamMember[]);
    } catch (error) {
      console.error('Error loading team members:', error);
      toast({
        title: t('common.error'),
        description: t('team.loadError'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ team_id: team.id, team_role: 'member' })
        .eq('id', selectedUserId);

      if (error) throw error;

      toast({
        title: t('common.success'),
        description: t('team.memberAdded')
      });

      setSelectedUserId("");
      loadData();
      onMembersChange();
    } catch (error: any) {
      console.error('Error adding member:', error);
      toast({
        title: t('common.error'),
        description: error.message || t('team.addError'),
        variant: "destructive"
      });
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ team_id: null, team_role: null })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: t('common.success'),
        description: t('team.memberRemoved')
      });

      loadData();
      onMembersChange();
    } catch (error: any) {
      console.error('Error removing member:', error);
      toast({
        title: t('common.error'),
        description: error.message || t('team.removeError'),
        variant: "destructive"
      });
    }
  };

  const handleRoleChange = async (userId: string, newRole: TeamRole) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ team_role: newRole })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: t('common.success'),
        description: t('role.updated')
      });

      loadData();
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast({
        title: t('common.error'),
        description: error.message || t('role.updateError'),
        variant: "destructive"
      });
    }
  };

  const getInitials = (firstName: string | null, lastName: string | null) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase() || '?';
  };

  const getFullName = (user: TeamMember) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
    return user.email;
  };

  const getRoleBadgeVariant = (role: TeamRole | null, isLeader: boolean): "default" | "secondary" | "outline" => {
    if (isLeader) return "default";
    switch (role) {
      case 'developer': return "default";
      case 'designer': return "secondary";
      case 'tester': return "outline";
      default: return "secondary";
    }
  };

  const getRoleLabel = (role: TeamRole | null, isLeader: boolean): string => {
    if (isLeader) return t('role.leader');
    switch (role) {
      case 'developer': return t('role.developer');
      case 'designer': return t('role.designer');
      case 'tester': return t('role.tester');
      default: return t('role.member');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('team.membersOf')} {team.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Add member section */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('team.selectUser')} />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.length === 0 ? (
                    <SelectItem value="none" disabled>
                      {t('team.noAvailableUsers')}
                    </SelectItem>
                  ) : (
                    availableUsers.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {getFullName(user)} ({user.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleAddMember} 
              disabled={!selectedUserId || selectedUserId === "none"}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {t('common.add')}
            </Button>
          </div>

          {/* Members list */}
          <div className="border rounded-lg overflow-auto flex-1">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">{t('common.loading')}</div>
            ) : members.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{t('team.noMembers')}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('team.members')}</TableHead>
                    <TableHead>{t('email')}</TableHead>
                    <TableHead>{t('role.label')}</TableHead>
                    <TableHead className="text-right">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => {
                    const isLeader = member.id === team.leader_id;
                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={member.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {getInitials(member.first_name, member.last_name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">
                              {getFullName(member)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {member.email}
                        </TableCell>
                        <TableCell>
                          {isLeader ? (
                            <Badge variant="default" className="bg-primary">
                              {t('role.leader')}
                            </Badge>
                          ) : (
                            <Select
                              value={member.team_role || 'member'}
                              onValueChange={(value) => handleRoleChange(member.id, value as TeamRole)}
                            >
                              <SelectTrigger className="w-32 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {teamRoles.map(role => (
                                  <SelectItem key={role.value} value={role.value}>
                                    {t(role.labelKey)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveMember(member.id)}
                            disabled={isLeader}
                            title={isLeader ? t('team.cannotRemoveLeader') : t('team.removeMember')}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            {t('common.total')}: {members.length} {t('team.members').toLowerCase()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TeamMembersManagement;
