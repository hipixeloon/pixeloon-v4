import { useState, useEffect } from 'react';
import { 
  Users, ShieldCheck, Shield, UserX, Search, RefreshCw, 
  BarChart3, Inbox, Activity, KeyRound, Ban, UserCheck, Settings 
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useAdminUsers, UserProfile } from '@/hooks/useAdminUsers';
import { useAdminPanel, PermissionType } from '@/hooks/useAdminPanel';
import { useAppSettings } from '@/hooks/useAppSettings';
import { AppLayout } from '@/components/layout/AppLayout';
import { UserTableAdvanced } from '@/components/admin/UserTableAdvanced';
import { UserActivityDialog } from '@/components/admin/UserActivityDialog';
import { AdminStats } from '@/components/admin/AdminStats';
import { AccessRequestsTable } from '@/components/admin/AccessRequestsTable';
import { ActivityLogsTable } from '@/components/admin/ActivityLogsTable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AdminPanel() {
  const { user } = useAuth();
  const { isAdmin, isModerator, loading: rolesLoading } = useUserRoles(user?.id);
  const {
    users,
    loading: usersLoading,
    refetch: refetchUsers,
    assignRole,
    removeRole,
    banUser,
    unbanUser,
  } = useAdminUsers();
  
  const {
    stats,
    accessRequests,
    activityLogs,
    loading: panelLoading,
    refetch: refetchPanel,
    approveRequest,
    rejectRequest,
    revokeAccess,
    grantPermission,
    revokePermission,
  } = useAdminPanel();

  const { settings, updateSetting, loading: settingsLoading } = useAppSettings();

  const [searchQuery, setSearchQuery] = useState('');
  const [activityUser, setActivityUser] = useState<UserProfile | null>(null);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [userPermissions, setUserPermissions] = useState<{ user_id: string; permission: PermissionType }[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [updatingSignup, setUpdatingSignup] = useState(false);

  // Fetch user permissions
  useEffect(() => {
    const fetchPermissions = async () => {
      const { data } = await supabase.from('user_permissions').select('user_id, permission');
      setUserPermissions((data || []).map(p => ({ user_id: p.user_id, permission: p.permission as PermissionType })));
    };
    fetchPermissions();
  }, [users]);

  // Filter users based on search
  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.full_name && u.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleViewActivity = (user: UserProfile) => {
    setActivityUser(user);
    setActivityDialogOpen(true);
  };

  const handleSelectUser = (userId: string, selected: boolean) => {
    setSelectedUsers(prev => 
      selected ? [...prev, userId] : prev.filter(id => id !== userId)
    );
  };

  const handleSelectAll = (selected: boolean) => {
    setSelectedUsers(selected ? filteredUsers.map(u => u.user_id) : []);
  };

  const handleRefresh = async () => {
    await Promise.all([refetchUsers(), refetchPanel()]);
  };

  // Bulk actions
  const handleBulkGrantCreator = async () => {
    if (selectedUsers.length === 0) return;
    setBulkActionLoading(true);
    try {
      for (const userId of selectedUsers) {
        await grantPermission(userId, 'creator');
      }
      toast.success(`Creator permission granted to ${selectedUsers.length} users`);
      setSelectedUsers([]);
      await refetchUsers();
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkRevokeCreator = async () => {
    if (selectedUsers.length === 0) return;
    setBulkActionLoading(true);
    try {
      for (const userId of selectedUsers) {
        await revokePermission(userId, 'creator');
      }
      toast.success(`Creator permission revoked from ${selectedUsers.length} users`);
      setSelectedUsers([]);
      await refetchUsers();
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkBan = async () => {
    if (selectedUsers.length === 0) return;
    setBulkActionLoading(true);
    try {
      for (const userId of selectedUsers) {
        await banUser(userId, 'Bulk ban action');
      }
      toast.success(`${selectedUsers.length} users banned`);
      setSelectedUsers([]);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkUnban = async () => {
    if (selectedUsers.length === 0) return;
    setBulkActionLoading(true);
    try {
      for (const userId of selectedUsers) {
        await unbanUser(userId);
      }
      toast.success(`${selectedUsers.length} users unbanned`);
      setSelectedUsers([]);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleSignupToggle = async (enabled: boolean) => {
    setUpdatingSignup(true);
    const result = await updateSetting('signup_enabled', enabled);
    if (result.success) {
      toast.success(enabled ? 'Signups enabled' : 'Signups disabled');
    } else {
      toast.error('Failed to update setting');
    }
    setUpdatingSignup(false);
  };

  const pendingRequestsCount = accessRequests.filter(r => r.status === 'pending').length;

  if (rolesLoading) {
    return (
      <AppLayout title="Admin Panel">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin && !isModerator) {
    return (
      <AppLayout title="Admin Panel">
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <ShieldCheck className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            You don't have permission to access the admin panel.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Admin Panel">
      <div className="space-y-4 sm:space-y-6 p-3 sm:p-4">
        {/* Main Tabs */}
        <Tabs defaultValue="dashboard" className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <ScrollArea className="w-full sm:w-auto">
              <TabsList className="h-auto p-1 inline-flex w-auto">
                <TabsTrigger value="dashboard" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-1.5">
                  <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline">Dashboard</span>
                  <span className="xs:hidden">Stats</span>
                </TabsTrigger>
                <TabsTrigger value="users" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-1.5">
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Users
                </TabsTrigger>
                <TabsTrigger value="requests" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-1.5">
                  <Inbox className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline">Requests</span>
                  {pendingRequestsCount > 0 && (
                    <Badge variant="destructive" className="ml-0.5 sm:ml-1 h-4 w-4 sm:h-5 sm:w-5 p-0 justify-center text-[10px] sm:text-xs">
                      {pendingRequestsCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="logs" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-1.5">
                  <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline">Logs</span>
                </TabsTrigger>
                {isAdmin && (
                  <TabsTrigger value="settings" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-1.5">
                    <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Settings</span>
                  </TabsTrigger>
                )}
              </TabsList>
            </ScrollArea>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh} 
              disabled={usersLoading || panelLoading}
              className="w-full sm:w-auto"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${(usersLoading || panelLoading) ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard">
            <AdminStats stats={stats} loading={panelLoading} />
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base sm:text-lg">User Management</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      {isAdmin ? 'Manage users, roles, permissions' : 'View users'}
                    </CardDescription>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      className="pl-9 h-9 text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-4 sm:p-6 pt-0 sm:pt-0">
                {/* Bulk Actions */}
                {selectedUsers.length > 0 && isAdmin && (
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-muted rounded-lg">
                    <span className="text-xs sm:text-sm font-medium">{selectedUsers.length} selected</span>
                    <div className="flex-1" />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleBulkGrantCreator}
                        disabled={bulkActionLoading}
                        className="text-xs h-7 sm:h-8"
                      >
                        <KeyRound className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                        <span className="hidden sm:inline">Grant Creator</span>
                        <span className="sm:hidden">Grant</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleBulkRevokeCreator}
                        disabled={bulkActionLoading}
                        className="text-xs h-7 sm:h-8"
                      >
                        <KeyRound className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                        <span className="hidden sm:inline">Revoke Creator</span>
                        <span className="sm:hidden">Revoke</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleBulkUnban}
                        disabled={bulkActionLoading}
                        className="text-xs h-7 sm:h-8"
                      >
                        <UserCheck className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                        Unban
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleBulkBan}
                        disabled={bulkActionLoading}
                        className="text-xs h-7 sm:h-8"
                      >
                        <Ban className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                        Ban
                      </Button>
                    </div>
                  </div>
                )}

                {/* User Table */}
                {usersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="min-w-[600px] sm:min-w-0 px-4 sm:px-0">
                      <UserTableAdvanced
                        users={filteredUsers}
                        userPermissions={userPermissions}
                        selectedUsers={selectedUsers}
                        onSelectUser={handleSelectUser}
                        onSelectAll={handleSelectAll}
                        onAssignRole={assignRole}
                        onRemoveRole={removeRole}
                        onBanUser={banUser}
                        onUnbanUser={unbanUser}
                        onGrantPermission={grantPermission}
                        onRevokePermission={revokePermission}
                        onViewActivity={handleViewActivity}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Access Requests Tab */}
          <TabsContent value="requests">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Access Requests</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Review and manage creator access requests
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="min-w-[500px] sm:min-w-0 px-4 sm:px-0">
                    <AccessRequestsTable
                      requests={accessRequests}
                      onApprove={approveRequest}
                      onReject={rejectRequest}
                      onRevoke={revokeAccess}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Logs Tab */}
          <TabsContent value="logs">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Activity Logs</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Audit trail of system actions
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="min-w-[500px] sm:min-w-0 px-4 sm:px-0">
                    <ActivityLogsTable logs={activityLogs} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          {isAdmin && (
            <TabsContent value="settings">
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">App Settings</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Configure global application settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 p-4 sm:p-6 pt-0 sm:pt-0">
                  <div className="flex items-center justify-between p-3 sm:p-4 border rounded-lg">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <Label htmlFor="signup-toggle" className="text-sm sm:text-base font-medium">
                        Allow New Signups
                      </Label>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        When disabled, new users cannot create accounts
                      </p>
                    </div>
                    <Switch
                      id="signup-toggle"
                      checked={settings.signup_enabled}
                      onCheckedChange={handleSignupToggle}
                      disabled={updatingSignup || settingsLoading}
                      className="ml-4 shrink-0"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      <UserActivityDialog
        user={activityUser}
        open={activityDialogOpen}
        onOpenChange={setActivityDialogOpen}
      />
    </AppLayout>
  );
}
