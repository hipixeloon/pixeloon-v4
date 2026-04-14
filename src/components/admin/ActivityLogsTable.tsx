import { format } from 'date-fns';
import { 
  User, Video, Calendar, Facebook, Settings, Shield, 
  LogIn, LogOut, Plus, Trash, Edit, Eye, Activity 
} from 'lucide-react';
import { ActivityLog } from '@/hooks/useAdminPanel';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ActivityLogsTableProps {
  logs: ActivityLog[];
}

const getActionIcon = (action: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    login: <LogIn className="w-4 h-4 text-green-500" />,
    logout: <LogOut className="w-4 h-4 text-muted-foreground" />,
    create: <Plus className="w-4 h-4 text-blue-500" />,
    update: <Edit className="w-4 h-4 text-yellow-500" />,
    delete: <Trash className="w-4 h-4 text-destructive" />,
    view: <Eye className="w-4 h-4 text-muted-foreground" />,
    grant_permission: <Shield className="w-4 h-4 text-green-500" />,
    revoke_permission: <Shield className="w-4 h-4 text-destructive" />,
    ban_user: <User className="w-4 h-4 text-destructive" />,
    unban_user: <User className="w-4 h-4 text-green-500" />,
  };
  return iconMap[action.toLowerCase()] || <Activity className="w-4 h-4" />;
};

const getEntityIcon = (entityType: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    user: <User className="w-4 h-4" />,
    campaign: <Video className="w-4 h-4" />,
    post: <Calendar className="w-4 h-4" />,
    page: <Facebook className="w-4 h-4" />,
    settings: <Settings className="w-4 h-4" />,
  };
  return iconMap[entityType.toLowerCase()] || null;
};

const getActionBadgeVariant = (action: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (['create', 'grant_permission', 'login', 'unban_user'].includes(action.toLowerCase())) {
    return 'default';
  }
  if (['delete', 'revoke_permission', 'ban_user'].includes(action.toLowerCase())) {
    return 'destructive';
  }
  if (['update', 'edit'].includes(action.toLowerCase())) {
    return 'secondary';
  }
  return 'outline';
};

export function ActivityLogsTable({ logs }: ActivityLogsTableProps) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No activity logs yet</p>
        <p className="text-sm">Actions will be recorded here</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px]">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Time</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(log.created_at), 'MMM d, h:mm:ss a')}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm truncate max-w-[150px]">
                      {log.user_email || 'System'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getActionIcon(log.action)}
                    <Badge variant={getActionBadgeVariant(log.action)} className="text-xs">
                      {log.action.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getEntityIcon(log.entity_type)}
                    <span className="text-sm">{log.entity_type}</span>
                    {log.entity_id && (
                      <span className="text-xs text-muted-foreground">
                        ({log.entity_id.slice(0, 8)}...)
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {log.details && (
                    <span className="text-xs text-muted-foreground truncate max-w-[200px] block">
                      {JSON.stringify(log.details).slice(0, 50)}...
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ScrollArea>
  );
}
