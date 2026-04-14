import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { ViewOnlyDashboard } from '@/components/access/ViewOnlyDashboard';
import Dashboard from './Dashboard';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user } = useAuth();
  const { canCreate, loading } = usePermissions(user?.id);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Users with creator permission, admin, or moderator see full dashboard
  if (canCreate) {
    return <Dashboard />;
  }

  // Regular users see view-only dashboard with request access form
  return <ViewOnlyDashboard />;
};

export default Index;
