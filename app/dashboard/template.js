'use client';

import { Rise } from 'cube-motion/react';

export default function DashboardTemplate({ children }) {
  return (
    <Rise as="div" className="w-full">
      {children}
    </Rise>
  );
}
