import { Menu, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  rightAction?: React.ReactNode;
}

export function Header({ title, onMenuClick, rightAction }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 ios-blur bg-background/80 border-b border-border safe-top">
      <div className="flex items-center justify-between h-14 px-4">
        <button
          onClick={onMenuClick}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-secondary active:bg-secondary/80 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6 text-foreground" />
        </button>

        <h1 className="text-ios-headline text-foreground">{title}</h1>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-secondary active:bg-secondary/80 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-ios-orange" />
            ) : (
              <Moon className="w-5 h-5 text-primary" />
            )}
          </button>
          {rightAction}
        </div>
      </div>
    </header>
  );
}
