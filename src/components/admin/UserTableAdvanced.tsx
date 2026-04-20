import { useState } from 'react';
import { format } from 'date-fns';
import { MoreHorizontal, Shield, ShieldCheck, User, Ban, UserCheck, Eye, Key, KeyRound } from 'lucide-react';
import { UserProfile, AppRole } from '@/hooks/useAdminUsers';
import { PermissionType } from '@/hooks/useAdminPanel';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface UserPermission {
  user_id: string;
  permission: PermissionType;
}

interface UserTableAdvancedProps {
  users: UserProfile[];
  userPermissions: UserPermission[];
  selectedUsers: string[];
  onSelectUser: (userId: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onAssignRole: (userId: string, role: AppRole) => Promise<void>;
  onRemoveRole: (userId: string, role: AppRole) => Promise<void>;
  onBanUser: (userId: string, reason: string) => Promise<void>;
  onUnbanUser: (userId: string) => Promise<void>;
  onGrantPermission: (userId: string, permission: PermissionType) => Promise<void>;
  onRevokePermission: (userId: string, permission: PermissionType) => Promise<void>;
  onViewActivity: (user: UserProfile) => void;
}

export function UserTableAdvanced({
  users,
  userPermissions,
  selectedUsers,
  onSelectUser,
  onSelectAll,
  onAssignRole,
  onRemoveRole,
  onBanUser,
  onUnbanUser,
  onGrantPermission,
  onRevokePermission,
  onViewActivity,
}: UserTableAdvancedProps) {
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [banReason, setBanReason] = useState('');

  const getUserPermissions = (userId: string): PermissionType[] => {
    return userPermissions
      .filter((p) => p.user_id === userId)
      .map((p) => p.permission);
  };

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'moderator':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const handleBanClick = (user: UserProfile) => {
    setSelectedUser(user);
    setBanReason('');
    setBanDialogOpen(true);
  };

  const handleConfirmBan = async () => {
    if (selectedUser && banReason.trim()) {
      await onBanUser(selectedUser.user_id, banReason);
      setBanDialogOpen(false);
      setSelectedUser(null);
      setBanReason('');
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const allSelected = users.length > 0 && selectedUsers.length === users.length;
  const someSelected = selectedUsers.length > 0 && selectedUsers.length < users.length;

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allSelected || (someSelected ? "indeterminate" : false)}
                  onCheckedChange={(checked) => onSelectAll(!!checked)}
                />
              </TableHead>
              <TableHead>User</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Activity</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const permissions = getUserPermissions(user.user_id);
              const isSelected = selectedUsers.includes(user.user_id);
              
              return (
                <TableRow key={user.id} className={user.is_banned ? 'opacity-60' : ''}>
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => onSelectUser(user.user_id, !!checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar_url || ''} />
                        <AvatarFallback className="text-xs">
                          {getInitials(user.full_name, user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{user.full_name || 'No name'}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <Badge key={role} variant={getRoleBadgeVariant(role)} className="text-xs">
                          {role === 'admin' && <ShieldCheck className="w-3 h-3 mr-1" />}
                          {role === 'moderator' && <Shield className="w-3 h-3 mr-1" />}
                          {role === 'user' && <User className="w-3 h-3 mr-1" />}
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {permissions.length > 0 ? (
                        permissions.map((perm) => (
                          <Badge key={perm} variant="outline" className="text-xs">
                            <Key className="w-3 h-3 mr-1" />
                            {perm}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.is_banned ? (
                      <Badge variant="destructive" className="text-xs">
                        <Ban className="w-3 h-3 mr-1" />Banned
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                        <UserCheck className="w-3 h-3 mr-1" />Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {user.campaigns_count || 0}c / {user.pages_count || 0}p
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(user.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onViewActivity(user)}>
                          <Eye className="w-4 h-4 mr-2" />View Activity
                        </DropdownMenuItem>
                        
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs text-muted-foreground">Roles</DropdownMenuLabel>
                        {!user.roles.includes('admin') && (
                          <DropdownMenuItem onClick={() => onAssignRole(user.user_id, 'admin')}>
                            <ShieldCheck className="w-4 h-4 mr-2" />Make Admin
                          </DropdownMenuItem>
                        )}
                        {user.roles.includes('admin') && (
                          <DropdownMenuItem onClick={() => onRemoveRole(user.user_id, 'admin')}>
                            <ShieldCheck className="w-4 h-4 mr-2" />Remove Admin
                          </DropdownMenuItem>
                        )}
                        {!user.roles.includes('moderator') && (
                          <DropdownMenuItem onClick={() => onAssignRole(user.user_id, 'moderator')}>
                            <Shield className="w-4 h-4 mr-2" />Make Moderator
                          </DropdownMenuItem>
                        )}
                        {user.roles.includes('moderator') && (
                          <DropdownMenuItem onClick={() => onRemoveRole(user.user_id, 'moderator')}>
                            <Shield className="w-4 h-4 mr-2" />Remove Moderator
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs text-muted-foreground">Permissions</DropdownMenuLabel>
                        {!permissions.includes('creator') && (
                          <DropdownMenuItem onClick={() => onGrantPermission(user.user_id, 'creator')}>
                            <KeyRound className="w-4 h-4 mr-2" />Grant Creator
                          </DropdownMenuItem>
                        )}
                        {permissions.includes('creator') && (
                          <DropdownMenuItem onClick={() => onRevokePermission(user.user_id, 'creator')}>
                            <KeyRound className="w-4 h-4 mr-2" />Revoke Creator
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />
                        {user.is_banned ? (
                          <DropdownMenuItem onClick={() => onUnbanUser(user.user_id)}>
                            <UserCheck className="w-4 h-4 mr-2" />Unban User
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => handleBanClick(user)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Ban className="w-4 h-4 mr-2" />Ban User
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban User</DialogTitle>
            <DialogDescription>
              Are you sure you want to ban {selectedUser?.email}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="banReason">Reason for ban</Label>
            <Textarea
              id="banReason"
              placeholder="Enter the reason..."
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmBan} disabled={!banReason.trim()}>
              Ban User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
