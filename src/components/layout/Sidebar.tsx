import { X, Home, Plus, Settings, Activity, ShieldCheck, Sparkles } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const menuItems = [
  { icon: Home, label: 'Dashboard', path: '/' },
  { icon: Plus, label: 'New Campaign', path: '/campaign/new' },
  { icon: Sparkles, label: 'Profile Assistant', path: '/profile-assistant' },
  { icon: Activity, label: 'Executions', path: '/executions' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

const adminMenuItem = { icon: ShieldCheck, label: 'Admin Panel', path: '/admin' };

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const { isAdminOrModerator } = useUserRoles(user?.id);

  const allMenuItems = isAdminOrModerator ? [...menuItems, adminMenuItem] : menuItems;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sidebar Panel */}
      <div
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-sidebar ios-blur transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="safe-top" />
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          <h2 className="text-ios-title3 text-sidebar-foreground">Menu</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-sidebar-accent transition-colors"
          >
            <X className="w-5 h-5 text-sidebar-foreground" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-3">
          <div className="ios-section">
            {allMenuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={`ios-list-item transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="text-ios-body">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 safe-bottom">
          <p className="text-ios-caption text-muted-foreground text-center">
            Pixeloon
          </p>
        </div>
      </div>
    </>
  );
}
