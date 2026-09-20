'use client';

import React, { useState, useEffect } from 'react';
import { PageHeader } from '../PageHeader';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Search, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import apiClient from '@/lib/api/httpClient';
import { AdminDataTable, type AdminDataTableColumn } from '../ui/AdminDataTable';

interface AuditLog {
  id: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  actorType: string;
  action: string;
  entityType: string;
  entityId?: string;
  details: any;
  createdAt: string;
}

export function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actorTypeFilter, setActorTypeFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchLogs();
  }, [actorTypeFilter, actionFilter, entityTypeFilter, searchQuery, page, pageSize]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        search: searchQuery.trim(),
      });
      if (actorTypeFilter !== 'all') {
        params.append('actorType', actorTypeFilter);
      }
      if (actionFilter !== 'all') {
        params.append('action', actionFilter);
      }
      if (entityTypeFilter !== 'all') {
        params.append('entityType', entityTypeFilter);
      }

      const { data } = await apiClient.get(`/api/admin/audit-logs?${params.toString()}`);

      if (data.success) {
        setLogs(data.data || []);
        setTotalCount(data.pagination?.total || 0);
      } else {
        toast.error(data.message || 'Failed to fetch audit logs');
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  const columns: AdminDataTableColumn<AuditLog>[] = [
    { id: 'timestamp', label: 'Timestamp', widthClassName: 'w-[190px]', cell: (log) => <span className="text-sm text-slate-600">{new Date(log.createdAt).toLocaleString()}</span> },
    { id: 'actor', label: 'Actor', widthClassName: 'w-[220px]', cell: (log) => <div><div className="font-medium text-slate-900">{log.userEmail || 'System'}</div><div className="text-xs capitalize text-slate-500">{log.actorType}</div></div> },
    { id: 'action', label: 'Action', widthClassName: 'w-[180px]', cell: (log) => <span className="font-medium text-slate-900">{log.action.replaceAll('_', ' ')}</span> },
    { id: 'entity', label: 'Entity', widthClassName: 'w-[200px]', cell: (log) => { const source = log.details?.source || log.details?.paymentSource; const isHomeVisit = source === 'home_visit'; return <div><div className="flex items-center gap-2 text-slate-900"><span>{log.entityType}</span>{isHomeVisit && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700">Home visit</span>}</div>{log.entityId && <div className="font-mono text-xs text-slate-500">{log.entityId.substring(0, 8)}…</div>}</div>; } },
    { id: 'details', label: 'Details', widthClassName: 'w-[420px]', cell: (log) => <div>{expandedLog === log.id ? <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(log.details, null, 2)}</pre> : <Button size="sm" variant="ghost" onClick={() => setExpandedLog(log.id)}><ChevronDown className="mr-1 h-4 w-4" />View</Button>}{expandedLog === log.id && <Button size="sm" variant="ghost" onClick={() => setExpandedLog(null)}><ChevronUp className="mr-1 h-4 w-4" />Hide</Button>}</div> },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Audit Logs" 
        description="Track all system activities and changes"
      />

      <div className="p-8">
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
              <Select 
                value={actorTypeFilter} 
                onValueChange={(value) => {
                  setActorTypeFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Actor Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actors</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                </SelectContent>
              </Select>
              <Select 
                value={actionFilter} 
                onValueChange={(value) => {
                  setActionFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Action Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="verify">Verify</SelectItem>
                  <SelectItem value="reject">Reject</SelectItem>
                  <SelectItem value="assign">Assign</SelectItem>
                  <SelectItem value="comment">Comment</SelectItem>
                  <SelectItem value="update_status">Update Status</SelectItem>
                  <SelectItem value="update_role">Update Role</SelectItem>
                  <SelectItem value="credential_verified">Credential Verified</SelectItem>
                  <SelectItem value="credential_rejected">Credential Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select 
                value={entityTypeFilter} 
                onValueChange={(value) => {
                  setEntityTypeFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Entity Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="hospital">Hospital</SelectItem>
                  <SelectItem value="assignment">Assignment</SelectItem>
                  <SelectItem value="subscription">Subscription</SelectItem>
                  <SelectItem value="subscription_plan">Subscription Plan</SelectItem>
                  <SelectItem value="specialty">Specialty</SelectItem>
                  <SelectItem value="support_ticket">Support Ticket</SelectItem>
                  <SelectItem value="affiliation">Affiliation</SelectItem>
                  <SelectItem value="doctor_credential">Doctor Credential</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            </div>
          ) : (
            <AdminDataTable columns={columns} data={logs} emptyMessage="No audit logs found" getRowKey={(log) => log.id} minWidthClassName="min-w-[1200px]" pagination={{ page, pageSize, total: totalCount, onPageChange: setPage, onPageSizeChange: (size) => { setPageSize(size); setPage(1); }, disabled: loading }} />
          )}
        </div>
      </div>
    </div>
  );
}
