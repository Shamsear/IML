'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children }) {
  const [theme] = useState('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    setMounted(true);
  }, []);

  const setTheme = () => {
    document.documentElement.setAttribute('data-theme', 'light');
  };

  const toggleTheme = () => {
    document.documentElement.setAttribute('data-theme', 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme: 'light', toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
