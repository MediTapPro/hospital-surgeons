"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UserCheck,
  Users,
  Stethoscope,
  CreditCard,
  ClipboardList,
  Building2,
  Wallet,
  BarChart3,
  FileText,
  Settings,
  Headphones,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Calendar,
  CalendarX,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "../_lib/utils";
import apiClient from "@/lib/api/httpClient";

interface MenuItem {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  href?: string;
  submenu?: { id: string; label: string; href: string }[];
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("Admin User");
  const [userName, setUserName] = useState<string>("Admin User");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const response = await apiClient.get("/api/users/profile");
      const data = response.data;
      
      if (data.success && data.data) {
        setUserEmail(data.data.email || "Admin User");
        setUserName(data.data.name || data.data.fullName || "Admin User");
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      // Keep default values on error
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("rememberMe");
    router.push("/login");
  };

  const menuItems: MenuItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/admin" },
    {
      id: "verifications",
      label: "Verifications",
      icon: UserCheck,
      href: "/admin/verifications",
      submenu: [
        { id: "doctor-verifications", label: "Doctors", href: "/admin/verifications/doctors" },
        { id: "hospital-verifications", label: "Hospitals", href: "/admin/verifications/hospitals" },
      ],
    },
    { id: "users", label: "Users", icon: Users, href: "/admin/users" },
    { id: "specialties", label: "Specialties", icon: Stethoscope, href: "/admin/specialties" },
    { id: "plans", label: "Subscription Plans", icon: CreditCard, href: "/admin/plans" },
    { id: "assignments", label: "Assignments", icon: ClipboardList, href: "/admin/assignments" },
    { id: "affiliations", label: "Affiliations", icon: Building2, href: "/admin/affiliations" },
    { id: "subscriptions", label: "Subscriptions", icon: Wallet, href: "/admin/subscriptions" },
    { id: "analytics", label: "Analytics", icon: BarChart3, href: "/admin/analytics" },
    { id: "schedule-updates", label: "Schedule Updates", icon: Calendar, href: "/admin/schedule-updates" },
    { id: "vacation-updates", label: "Vacation Updates", icon: CalendarX, href: "/admin/vacation-updates" },
    { id: "audit-logs", label: "Audit Logs", icon: FileText, href: "/admin/audit-logs" },
    { id: "settings", label: "Settings", icon: Settings, href: "/admin/settings" },
    { id: "support", label: "Support", icon: Headphones, href: "/admin/support" },
  ];

  const isActive = (href?: string) => {
    if (!href) return false;
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        "bg-slate-900 text-slate-100 transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="p-4 flex items-center justify-between border-b border-slate-800">
        {!collapsed && <span className="text-teal-400">HealthCare Admin</span>}
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
          const content = (
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
          );

          return (
            <div key={item.id}>
              {item.href && !item.submenu ? (
                <Link href={item.href} className="block">
                  {content}
                </Link>
              ) : (
                <div>{content}</div>
              )}
              {item.submenu && !collapsed && (
                <div className="ml-8 mt-1 mb-2 space-y-1">
                  {item.submenu.map((subitem) => (
                    <Link
                      key={subitem.id}
                      href={subitem.href}
                      className={cn(
                        "block text-left px-3 py-1.5 rounded text-slate-300 hover:bg-slate-800 transition-colors",
                        pathname === subitem.href && "bg-slate-800 text-teal-400",
                      )}
                    >
                      {subitem.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center flex-shrink-0">
            <span>{userName.charAt(0).toUpperCase()}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-slate-200 truncate">{userName}</div>
              <div className="text-slate-400 truncate text-sm">{userEmail}</div>
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






