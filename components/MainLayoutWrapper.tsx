'use client';

import React from 'react';

export default function MainLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <main 
      className="flex-1 overflow-y-auto relative"
      style={{ width: '100%' }}
    >
      <div className="bg-white min-h-full">
        {children}
      </div>
    </main>
  );
}