'use client';

import React, { useState, useEffect } from 'react';
import { PageHeader } from '../PageHeader';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Search, Filter, Download, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';

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
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchLogs();
  }, [actorTypeFilter, actionFilter, entityTypeFilter, page]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
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

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setLogs(data.data || []);
        setTotalPages(data.pagination?.totalPages || 1);
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

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (actorTypeFilter !== 'all') params.append('actorType', actorTypeFilter);
      if (actionFilter !== 'all') params.append('action', actionFilter);
      if (entityTypeFilter !== 'all') params.append('entityType', entityTypeFilter);
      params.append('format', 'csv');

      const res = await fetch(`/api/admin/audit-logs/export?${params.toString()}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Audit logs exported successfully');
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      toast.error('Failed to export audit logs');
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        log.action.toLowerCase().includes(query) ||
        log.entityType.toLowerCase().includes(query) ||
        log.userEmail?.toLowerCase().includes(query) ||
        JSON.stringify(log.details).toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Audit Logs" 
        description="Track all system activities and changes"
        actions={
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export Logs
          </Button>
        }
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-slate-600">Timestamp</th>
                    <th className="px-6 py-3 text-left text-slate-600">Actor</th>
                    <th className="px-6 py-3 text-left text-slate-600">Action</th>
                    <th className="px-6 py-3 text-left text-slate-600">Entity</th>
                    <th className="px-6 py-3 text-left text-slate-600">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        No audit logs found
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <React.Fragment key={log.id}>
                        <tr className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-slate-600">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <div className="text-slate-900">{log.userEmail || 'System'}</div>
                              <div className="text-slate-500 text-sm">{log.actorType}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-900">{log.action}</td>
                          <td className="px-6 py-4">
                            <div>
                              <div className="text-slate-900">{log.entityType}</div>
                              {log.entityId && (
                                <div className="text-slate-500 text-sm">{log.entityId.substring(0, 8)}...</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                            >
                              {expandedLog === log.id ? (
                                <>
                                  <ChevronUp className="w-4 h-4 mr-1" />
                                  Hide
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-4 h-4 mr-1" />
                                  View
                                </>
                              )}
                            </Button>
                          </td>
                        </tr>
                        {expandedLog === log.id && (
                          <tr key={`${log.id}-details`}>
                            <td colSpan={5} className="px-6 py-4 bg-slate-50">
                              <pre className="text-slate-700 overflow-x-auto text-sm">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
              {/* Pagination */}
              {!loading && totalPages > 1 && (
                <div className="p-4 border-t border-slate-200 flex items-center justify-between">
                  <div className="text-sm text-slate-600">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
