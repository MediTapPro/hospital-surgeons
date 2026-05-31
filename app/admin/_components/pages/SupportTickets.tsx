'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '../PageHeader';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Search, Filter, Loader2, Eye } from 'lucide-react';
import { StatusBadge } from '../StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';

interface Ticket {
  id: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  subject: string;
  description: string;
  category?: string;
  priority: string;
  status: string;
  assignedTo?: string;
  assignedToEmail?: string;
  createdAt: string;
}

export function SupportTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState('');
  const [priorityUpdate, setPriorityUpdate] = useState('');
  const [comment, setComment] = useState('');

  useEffect(() => {
    fetchTickets();
  }, [statusFilter]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      params.append('limit', '100');

      const res = await fetch(`/api/admin/support/tickets?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setTickets(data.data || []);
      } else {
        toast.error(data.message || 'Failed to fetch support tickets');
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error('Failed to fetch support tickets');
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/support/tickets/${id}`);
      const data = await res.json();

      if (data.success) {
        setSelectedTicket(data.data);
        setStatusUpdate(data.data.status);
        setPriorityUpdate(data.data.priority);
        setShowDetailModal(true);
      } else {
        toast.error(data.message || 'Failed to fetch ticket details');
      }
    } catch (error) {
      console.error('Error fetching ticket details:', error);
      toast.error('Failed to fetch ticket details');
    }
  };

  const handleUpdateTicket = async () => {
    if (!selectedTicket) return;

    try {
      setUpdating(true);
      const res = await fetch(`/api/admin/support/tickets/${selectedTicket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: statusUpdate,
          priority: priorityUpdate,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Ticket updated successfully');
        setShowDetailModal(false);
        fetchTickets();
      } else {
        toast.error(data.message || 'Failed to update ticket');
      }
    } catch (error) {
      console.error('Error updating ticket:', error);
      toast.error('Failed to update ticket');
    } finally {
      setUpdating(false);
    }
  };

  const handleAddComment = async () => {
    if (!selectedTicket || !comment.trim()) return;

    try {
      const res = await fetch(`/api/admin/support/tickets/${selectedTicket.id}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: comment.trim() }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Comment added successfully');
        setComment('');
        fetchTicketDetails(selectedTicket.id);
      } else {
        toast.error(data.message || 'Failed to add comment');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    }
  };

  const statusCounts = {
    open: tickets.filter(t => t.status === 'open').length,
    'in-progress': tickets.filter(t => t.status === 'in_progress' || t.status === 'in-progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  };

  const displayTickets = tickets.filter(t => {
    if (statusFilter === 'open') return t.status === 'open';
    if (statusFilter === 'in-progress') return t.status === 'in_progress' || t.status === 'in-progress';
    if (statusFilter === 'resolved') return t.status === 'resolved';
    if (statusFilter === 'closed') return t.status === 'closed';
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Support Tickets" 
        description="Manage user support requests and issues"
      />

      <div className="p-8">
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="space-y-6">
          <TabsList>
            <TabsTrigger value="open">Open ({statusCounts.open})</TabsTrigger>
            <TabsTrigger value="in-progress">In Progress ({statusCounts['in-progress']})</TabsTrigger>
            <TabsTrigger value="resolved">Resolved ({statusCounts.resolved})</TabsTrigger>
            <TabsTrigger value="closed">Closed ({statusCounts.closed})</TabsTrigger>
          </TabsList>

          <TabsContent value={statusFilter} className="space-y-4">
            <div className="bg-white rounded-lg shadow">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                </div>
              ) : (
                <>
                  <div className="p-4 border-b border-slate-200">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <Input placeholder="Search tickets..." className="pl-10" />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-slate-600">ID</th>
                          <th className="px-6 py-3 text-left text-slate-600">User</th>
                          <th className="px-6 py-3 text-left text-slate-600">Subject</th>
                          <th className="px-6 py-3 text-left text-slate-600">Priority</th>
                          <th className="px-6 py-3 text-left text-slate-600">Category</th>
                          <th className="px-6 py-3 text-left text-slate-600">Assigned To</th>
                          <th className="px-6 py-3 text-left text-slate-600">Created</th>
                          <th className="px-6 py-3 text-left text-slate-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {displayTickets.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                              No tickets found
                            </td>
                          </tr>
                        ) : (
                          displayTickets.map((ticket) => (
                            <tr key={ticket.id} className="hover:bg-slate-50">
                              <td className="px-6 py-4 text-slate-900">{ticket.id.substring(0, 8)}...</td>
                              <td className="px-6 py-4 text-slate-900">{ticket.userEmail || 'Unknown'}</td>
                              <td className="px-6 py-4 text-slate-900">{ticket.subject}</td>
                              <td className="px-6 py-4">
                                <StatusBadge status={ticket.priority} />
                              </td>
                              <td className="px-6 py-4 text-slate-600">{ticket.category || '-'}</td>
                              <td className="px-6 py-4 text-slate-600">{ticket.assignedToEmail || 'Unassigned'}</td>
                              <td className="px-6 py-4 text-slate-600">
                                {new Date(ticket.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4">
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => fetchTicketDetails(ticket.id)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent aria-describedby={undefined} className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle>Ticket Details</DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>User</Label>
                  <p className="text-slate-900 mt-1">{selectedTicket.userEmail || 'Unknown'}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <div className="mt-1">
                    <Select value={statusUpdate} onValueChange={setStatusUpdate}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Priority</Label>
                  <div className="mt-1">
                    <Select value={priorityUpdate} onValueChange={setPriorityUpdate}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Category</Label>
                  <p className="text-slate-600 mt-1">{selectedTicket.category || '-'}</p>
                </div>
              </div>
              <div>
                <Label>Subject</Label>
                <p className="text-slate-900 mt-1">{selectedTicket.subject}</p>
              </div>
              <div>
                <Label>Description</Label>
                <p className="text-slate-600 mt-1 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>
              <div>
                <Label>Add Comment</Label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="mt-1"
                  placeholder="Add a comment..."
                />
                <Button 
                  size="sm" 
                  onClick={handleAddComment}
                  className="mt-2"
                  disabled={!comment.trim()}
                >
                  Add Comment
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailModal(false)} disabled={updating}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateTicket} 
              disabled={updating}
              className="bg-navy-600 hover:bg-navy-700"
            >
              {updating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
