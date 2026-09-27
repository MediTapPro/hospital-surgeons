import { Eye, Loader2 } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Button } from '../ui/button';
import { StatusBadge } from '../StatusBadge';
import { AdminDataTable, type AdminDataTableColumn } from '../ui/AdminDataTable';
import { USER_ACCOUNT_STATUS_ACTIONS, type UserAccountStatus } from '@/lib/enums/users.enums';

export type AdminUserListItem = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  verificationStatus: string;
  subscriptionTier: string | null;
  subscriptionPlanName: string | null;
  lastLoginAt: string | null;
};

type UsersDataTableProps = {
  users: AdminUserListItem[];
  loadingUserDetail: boolean;
  updatingUserId: string | null;
  onView: (userId: string) => void;
  onStatusChange: (userId: string, status: string) => void;
  pagination?: ComponentProps<typeof AdminDataTable>['pagination'];
};

const roleBadgeColors: Record<string, string> = {
  doctor: 'bg-teal-100 text-teal-700',
  hospital: 'bg-navy-100 text-navy-700',
  admin: 'bg-purple-100 text-purple-700',
};

function formatDate(value: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function UsersDataTable({ users, loadingUserDetail, updatingUserId, onView, onStatusChange, pagination }: UsersDataTableProps) {
  const columns: AdminDataTableColumn<AdminUserListItem>[] = [
    {
      id: 'user', label: 'User', widthClassName: 'w-[26%]',
      cell: (user) => <div className="flex min-w-0 items-center gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-semibold ${user.role === 'doctor' ? 'bg-teal-100 text-teal-700' : user.role === 'hospital' ? 'bg-navy-100 text-navy-700' : 'bg-slate-100 text-slate-700'}`}>{user.name.charAt(0)}</div><div className="min-w-0"><p className="truncate font-medium text-slate-900">{user.name}</p><p className="truncate text-sm text-slate-500">{user.email}</p></div></div>,
    },
    { id: 'role', label: 'Role', widthClassName: 'w-[10%]', cell: (user) => <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${roleBadgeColors[user.role] ?? 'bg-slate-100 text-slate-700'}`}>{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span> },
    { id: 'status', label: 'Status', widthClassName: 'w-[11%]', cell: (user) => <StatusBadge status={user.status} /> },
    { id: 'verification', label: 'Verification', widthClassName: 'w-[13%]', cell: (user) => <StatusBadge status={user.verificationStatus} /> },
    { id: 'subscription', label: 'Subscription', widthClassName: 'w-[13%]', cell: (user) => <span className="block truncate text-slate-900">{user.subscriptionPlanName || user.subscriptionTier || 'N/A'}</span> },
    { id: 'last-login', label: 'Last Login', widthClassName: 'w-[14%]', cell: (user) => <span className="text-sm text-slate-600">{formatDate(user.lastLoginAt)}</span> },
    {
      id: 'actions', label: 'Actions', widthClassName: 'w-[13%]', sticky: 'right', headerClassName: 'min-w-[172px]', cellClassName: 'min-w-[172px]',
      cell: (user) => {
        const action = USER_ACCOUNT_STATUS_ACTIONS[user.status as UserAccountStatus] ?? USER_ACCOUNT_STATUS_ACTIONS.pending;
        return <div className="flex items-center justify-center gap-2"><Button size="sm" variant="ghost" onClick={() => onView(user.id)} disabled={loadingUserDetail} aria-label={`View ${user.name}`}><Eye className="h-4 w-4" /></Button>{updatingUserId === user.id ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : <Button size="sm" variant={user.status === 'active' ? 'outline' : 'default'} onClick={() => onStatusChange(user.id, action.nextStatus)} aria-label={`${action.label} ${user.name}`}>{action.label}</Button>}</div>;
      },
    },
  ];

  return <AdminDataTable columns={columns} data={users} emptyMessage="No users found" getRowKey={(user) => user.id} minWidthClassName="min-w-[1120px]" pagination={pagination} />;
}
