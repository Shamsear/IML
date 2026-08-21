'use client';

import { useTheme } from './ThemeProvider';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      style={styles.toggle}
    >
      <span style={{
        ...styles.iconWrap,
        transform: theme === 'dark' ? 'rotate(0deg)' : 'rotate(180deg)',
        opacity: theme === 'dark' ? 1 : 0,
        position: 'absolute',
      }}>
        <Moon size={16} />
      </span>
      <span style={{
        ...styles.iconWrap,
        transform: theme === 'light' ? 'rotate(0deg)' : 'rotate(-180deg)',
        opacity: theme === 'light' ? 1 : 0,
        position: 'absolute',
      }}>
        <Sun size={16} />
      </span>
    </button>
  );
}

const styles = {
  toggle: {
    position: 'relative',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-surface-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    overflow: 'hidden',
  },
  iconWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  },
};
