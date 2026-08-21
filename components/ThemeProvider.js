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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    setMounted(true);
  }, []);

  const setTheme = (t) => {
    document.documentElement.setAttribute('data-theme', t);
  };

  const toggleTheme = () => {
    // Currently locked to light mode
    document.documentElement.setAttribute('data-theme', 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme: 'light', toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
