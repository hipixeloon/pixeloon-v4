import { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { AIMuseChat } from '@/components/chat/AIMuseChat';

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
  rightAction?: React.ReactNode;
}

export function AppLayout({ children, title, rightAction }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background relative">
      <Header
        title={title}
        onMenuClick={() => setSidebarOpen(true)}
        rightAction={rightAction}
      />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pb-6 safe-bottom">{children}</main>
      <AIMuseChat />
    </div>
  );
}
