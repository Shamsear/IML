'use client';

import { useTheme } from './ThemeProvider';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className="relative w-9 h-9 flex items-center justify-center bg-surface-elevated border border-border rounded-[var(--radius-sm)] cursor-pointer text-text-secondary transition-all duration-300 overflow-hidden hover:bg-surface-hover hover:text-text-primary"
    >
      <span
        className={`flex items-center justify-center transition-all duration-300 ${
          theme === 'dark' ? 'rotate-0 opacity-100' : 'rotate-180 opacity-0'
        } absolute`}
      >
        <Moon size={16} />
      </span>
      <span
        className={`flex items-center justify-center transition-all duration-300 ${
          theme === 'light' ? 'rotate-0 opacity-100' : '-rotate-180 opacity-0'
        } absolute`}
      >
        <Sun size={16} />
      </span>
    </button>
  );
}
