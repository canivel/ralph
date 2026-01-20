import { Link, useLocation } from 'react-router-dom';
import { Home, FolderOpen, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useProjectStore } from '@/stores/projectStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useConnectionToast } from '@/hooks/useConnectionToast';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    label: 'Projects',
    href: '/',
    icon: <Home className="h-5 w-5" />,
  },
];

function Sidebar() {
  const location = useLocation();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center border-b border-border px-4">
        <Link to="/" className="flex items-center gap-2">
          <FolderOpen className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">Ralph Dashboard</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-4">
        <p className="text-xs text-muted-foreground">
          Monitor your Ralph projects
        </p>
      </div>
    </aside>
  );
}

function ConnectionStatus() {
  const connectionStatus = useProjectStore((state) => state.connectionStatus);

  return (
    <div className="flex items-center gap-1.5">
      {connectionStatus === 'connected' ? (
        <>
          <Wifi className="h-4 w-4 text-green-500" />
          <span className="text-xs text-green-500">Connected</span>
        </>
      ) : connectionStatus === 'connecting' ? (
        <>
          <Wifi className="h-4 w-4 text-yellow-500 animate-pulse" />
          <span className="text-xs text-yellow-500">Connecting...</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-destructive" />
          <span className="text-xs text-destructive">Disconnected</span>
        </>
      )}
    </div>
  );
}

function Header() {
  // Initialize WebSocket connection at the layout level
  useWebSocket();
  // Show toast notifications for connection changes
  useConnectionToast();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Ralph Agent Monitor
        </span>
      </div>
      <div className="flex items-center gap-4">
        <ConnectionStatus />
        <ThemeToggle />
      </div>
    </header>
  );
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
