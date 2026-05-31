"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserSearch,
  ClipboardList,
  Building2,
  CreditCard,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Receipt,
  MessageSquare,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "../../admin/_lib/utils";

interface MenuItem {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  href: string;
}

export function HospitalSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("rememberMe");
    router.push("/login");
  };

  const menuItems: MenuItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/hospital/dashboard" },
    { id: "patients", label: "Patients", icon: Users, href: "/hospital/patients" },
    { id: "fees", label: "Doctor Proposals", icon: ClipboardList, href: "/hospital/fees" },
    { id: "find-doctors", label: "Find Doctors", icon: UserSearch, href: "/hospital/find-doctors" },
    { id: "assignments", label: "Assignments", icon: ClipboardList, href: "/hospital/assignments" },
    { id: "chat", label: "Messages", icon: MessageSquare, href: "/hospital/chat" },
    { id: "profile", label: "Hospital Profile", icon: Building2, href: "/hospital/profile" },
    { id: "subscription", label: "Subscription", icon: CreditCard, href: "/hospital/subscription" },
    { id: "transactions", label: "Payment Transactions", icon: Receipt, href: "/hospital/transactions" },
    { id: "settings", label: "Settings", icon: Settings, href: "/hospital/settings" },
  ];

  const isActive = (href: string) => {
    if (href === "/hospital/dashboard") {
      return pathname === "/hospital/dashboard";
    }
    return pathname?.startsWith(href);
  };

  return (
    <aside
      className={cn(
        "bg-slate-900 text-slate-100 transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="p-4 flex items-center justify-between border-b border-slate-800">
        {!collapsed && <span className="text-teal-400 font-semibold">Hospital Surgeons</span>}
        <button
          onClick={() => setCollapsed((prev) => !prev)}
          className="p-1 hover:bg-slate-800 rounded"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      <nav className="flex-1 p-2 overflow-y-auto">
        {menuItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.id} href={item.href} className="block">
              <div
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors mb-1",
                  active ? "bg-teal-600 text-white" : "hover:bg-slate-800",
                  collapsed && "justify-center",
                )}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-slate-200 text-sm font-medium">Hospital</div>
              <div className="text-slate-400 text-xs">hospital@example.com</div>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-400 hover:bg-slate-800 transition-colors",
            collapsed && "justify-center",
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}

