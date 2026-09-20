import type { ReactNode } from "react";
import { HospitalSidebar } from "./_components/Sidebar";
import { Toaster } from "../admin/_components/ui/sonner";
import { PortalModeGate } from '@/app/_components/PortalModeGate';

export default function HospitalLayout({ children }: { children: ReactNode }) {
  return (
    <PortalModeGate><div className="flex min-h-screen bg-slate-50">
      <HospitalSidebar />
      <main className="flex-1 overflow-auto bg-slate-50">{children}</main>
      <Toaster />
    </div></PortalModeGate>
  );
}
