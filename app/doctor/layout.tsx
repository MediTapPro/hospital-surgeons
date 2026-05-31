'use client';

import type { ReactNode } from "react";
import { DoctorSidebar } from "./_components/Sidebar";
import { Toaster } from "sonner";
import { useState } from "react";

export default function DoctorLayout({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50" style={{ backgroundImage: 'none' }}>
      <DoctorSidebar collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <main 
        className={`flex-1 overflow-auto transition-all duration-300 bg-slate-50 ${
          sidebarCollapsed ? 'ml-16' : 'ml-64'
        }`}
        style={{ backgroundImage: 'none' }}
      >
        <div className="p-6 max-w-[1400px] mx-auto bg-slate-50" style={{ backgroundImage: 'none' }}>
          {children}
        </div>
      </main>
      <Toaster />
    </div>
  );
}

