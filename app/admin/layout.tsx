import type { ReactNode } from "react";
import { Sidebar } from "./_components/Sidebar";
import { Toaster } from "./_components/ui/sonner";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-slate-50">{children}</main>
      <Toaster />
    </div>
  );
}




