"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  User,
  FileText,
  Image,
  Calendar,
  Clipboard,
  List,
  Building2,
  Stethoscope,
  Umbrella,
  DollarSign,
  Star,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Receipt,
  MessageSquare,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "../_lib/utils";
import { decodeToken, isAuthenticated } from "@/lib/auth/utils";
import { useRouter } from "next/navigation";

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

interface MenuItem {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  href: string;
  badge?: string;
}

interface DoctorSidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function DoctorSidebar({ collapsed: externalCollapsed, onToggleCollapse }: DoctorSidebarProps = {} as DoctorSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;
  const toggleCollapse = onToggleCollapse || (() => setInternalCollapsed(prev => !prev));
  const [doctorName, setDoctorName] = useState("Doctor");
  const [doctorEmail, setDoctorEmail] = useState("");
  const [profileCompletion, setProfileCompletion] = useState<number | null>(null);
  const [credentialsCount, setCredentialsCount] = useState<number | null>(null);
  const [todayAssignments, setTodayAssignments] = useState<number | null>(null);
  const [activeAffiliations, setActiveAffiliations] = useState<number | null>(null);

  // Fetch dashboard data (profile completion, credentials, assignments, affiliations)
  const fetchDashboardData = async () => {
    if (isAuthenticated()) {
      try {
        const token = localStorage.getItem("accessToken");
        const dashboardResponse = await fetch('/api/doctors/dashboard', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const dashboardData = await dashboardResponse.json();
        if (dashboardData.success && dashboardData.data) {
          const data = dashboardData.data;
          if (data.profileCompletion !== undefined) {
            setProfileCompletion(data.profileCompletion);
          }
          // Set credentials count (total of verified + pending + rejected)
          if (data.credentials) {
            const total = (data.credentials.verified || 0) + (data.credentials.pending || 0) + (data.credentials.rejected || 0);
            setCredentialsCount(total);
          }
          // Set today's assignments count
          if (data.todayAssignments !== undefined) {
            setTodayAssignments(data.todayAssignments);
          }
          // Set active affiliations count
          if (data.activeAffiliations !== undefined) {
            setActiveAffiliations(data.activeAffiliations);
          }
        }
      } catch (err) {
        console.error('Could not fetch dashboard data:', err);
      }
    }
  };

  useEffect(() => {
    const fetchDoctorInfo = async () => {
      if (isAuthenticated()) {
        try {
          const token = localStorage.getItem("accessToken");
          const response = await fetch('/api/doctors/profile', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const data = await response.json();
          if (data.success && data.data) {
            setDoctorName(`${data.data.firstName || ''} ${data.data.lastName || ''}`.trim() || "Doctor");
            // Try to get email from user profile
            try {
              const userResponse = await fetch('/api/users/profile', {
                headers: { Authorization: `Bearer ${token}` },
              });
              const userData = await userResponse.json();
              if (userData.success && userData.data?.email) {
                setDoctorEmail(userData.data.email);
              }
            } catch (err) {
              console.error('Could not fetch user email:', err);
            }
          }
          
          // Fetch dashboard data
          await fetchDashboardData();
        } catch (error) {
          console.error('Error fetching doctor info:', error);
        }
      }
    };
    fetchDoctorInfo();
  }, []);

  // Refresh dashboard data when navigating (especially after profile updates)
  useEffect(() => {
    // Refresh when navigating to dashboard, profile, credentials, assignments, or hospitals pages
    if (
      pathname === '/doctor/dashboard' || 
      pathname.startsWith('/doctor/profile') ||
      pathname.startsWith('/doctor/credentials') ||
      pathname.startsWith('/doctor/assignments') ||
      pathname.startsWith('/doctor/hospitals')
    ) {
      fetchDashboardData();
    }
  }, [pathname]);

  const menuGroups: MenuGroup[] = [
    {
      title: 'Profile & Verification',
      items: [
        { 
          id: 'profile', 
          label: 'Complete Profile', 
          icon: User, 
          href: '/doctor/profile', 
          badge: profileCompletion !== null ? `${profileCompletion}%` : undefined 
        },
        { 
          id: 'credentials', 
          label: 'Credentials & Documents', 
          icon: FileText, 
          href: '/doctor/credentials', 
          badge: credentialsCount !== null && credentialsCount > 0 ? `${credentialsCount}` : undefined 
        },
        { id: 'profile-photos', label: 'Profile Photos', icon: Image, href: '/doctor/profile/photos' },
      ]
    },
    {
      title: 'Operations',
      items: [
        { id: 'dashboard', label: 'Dashboard Home', icon: LayoutDashboard, href: '/doctor/dashboard' },
        { id: 'schedule', label: 'My Availability', icon: Calendar, href: '/doctor/schedule' },
        { 
          id: 'assignments', 
          label: "Today's Assignments", 
          icon: Clipboard, 
          href: '/doctor/assignments', 
          badge: todayAssignments !== null && todayAssignments > 0 ? `${todayAssignments}` : undefined 
        },
        { id: 'all-assignments', label: 'All Assignments', icon: List, href: '/doctor/assignments' },
      ]
    },
    {
      title: 'Professional Network',
      items: [
        {
          id: 'hospitals',
          label: 'Affiliated Hospitals',
          icon: Building2,
          href: '/doctor/hospitals',
          badge: activeAffiliations !== null && activeAffiliations > 0 ? `${activeAffiliations}` : undefined
        },
        { id: 'specializations', label: 'Specializations', icon: Stethoscope, href: '/doctor/specializations' },
        { id: 'chat', label: 'Messages', icon: MessageSquare, href: '/doctor/chat' },
      ]
    },
    {
      title: 'Time & Finance',
      items: [
        { id: 'leaves', label: 'Leaves & Time Off', icon: Umbrella, href: '/doctor/leaves' },
        { id: 'earnings', label: 'Earnings & Payments', icon: DollarSign, href: '/doctor/earnings' },
        { id: 'fees', label: 'Fee Management (MRP)', icon: DollarSign, href: '/doctor/fees' },
        { id: 'subscriptions', label: 'Subscription Plan', icon: Star, href: '/doctor/subscriptions' },
        { id: 'transactions', label: 'Payment Transactions', icon: Receipt, href: '/doctor/transactions' },
      ]
    },
    // {
    //   title: 'Performance & Support',
    //   items: [
    //     { id: 'ratings', label: 'Ratings & Reviews', icon: Star, href: '/doctor/ratings' },
    //     { id: 'settings', label: 'Preferences', icon: Settings, href: '/doctor/settings' },
    //     { id: 'support', label: 'Support', icon: HelpCircle, href: '/doctor/support' },
    //   ]
    // }
  ];

  const isActive = (href: string) => {
    if (href === "/doctor/dashboard") {
      return pathname === "/doctor/dashboard";
    }
    return pathname.startsWith(href);
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("rememberMe");
    router.push("/login");
  };

  return (
    <aside
      className={cn(
        "bg-slate-900 text-slate-100 transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="p-4 flex items-center justify-between border-b border-slate-800">
        {!collapsed && <span className="text-teal-400">HealthCare Doctor</span>}
        <button
          onClick={toggleCollapse}
          className="p-1 hover:bg-slate-800 rounded"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      <nav className="flex-1 p-2 overflow-y-auto">
        {menuGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="mb-6">
            {!collapsed && (
              <div className="px-3 mb-2">
                <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">
                  {group.title}
                </span>
              </div>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors mb-1",
                      active ? "bg-teal-600 text-white" : "hover:bg-slate-800",
                      collapsed && "justify-center",
                    )}
                    title={collapsed ? item.label : ""}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="text-sm flex-1 text-left">{item.label}</span>
                        {item.badge && (
                          <span
                            className={cn(
                              "text-xs px-2 py-0.5 rounded-full font-medium",
                              active
                                ? "bg-white text-teal-600"
                                : "bg-slate-700 text-slate-300"
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center flex-shrink-0">
            <span>{doctorName.charAt(0)}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-slate-200">{doctorName}</div>
              <div className="text-slate-400 text-sm truncate">{doctorEmail}</div>
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
