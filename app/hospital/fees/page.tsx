'use client';

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  User,
  HandCoins,
  History,
  FileText
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/app/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/app/components/ui/table';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/httpClient';
import { cn } from "../../admin/_lib/utils";

export default function HospitalFeesPage() {
  const [fees, setFees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchFees();
  }, []);

  const fetchFees = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/hospitals/fees');
      if (res.data.success) {
        setFees(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching fees:', error);
      toast.error('Failed to load pending proposals');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, status: 'approved' | 'rejected') => {
    const originalFees = [...fees];
    
    // Optimistic update
    setFees(prev => prev.map(f => f.id === id ? { ...f, status } : f));
    
    try {
      const res = await apiClient.post('/api/hospitals/fees/status', { id, status });
      if (res.data.success) {
        toast.success(`Proposal ${status === 'approved' ? 'accepted' : 'rejected'} successfully`);
      } else {
        toast.error(res.data.message);
        setFees(originalFees);
      }
    } catch (error) {
      toast.error('Failed to update status');
      setFees(originalFees);
    }
  };

  const filteredFees = fees.filter(fee => 
    !searchQuery || 
    fee.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    fee.specialtyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (fee.procedureName && fee.procedureName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const pendingCount = fees.filter(f => f.status === 'pending' || !f.status).length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto min-h-screen bg-slate-50/50">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Doctor Fee Proposals</h1>
          <p className="text-slate-500 mt-1">Review, approve, or reject baseline pricing proposals from your affiliated doctors.</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-100">
          <History className="h-4 w-4 text-teal-600" />
          <span className="text-sm font-medium text-slate-700">{pendingCount} Pending Reviews</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative group flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-teal-600 transition-colors" />
          <Input
            placeholder="Search by doctor, specialty, or procedure..."
            className="pl-10 bg-white border-slate-200 focus-visible:ring-teal-500 h-11"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead className="text-slate-600 font-semibold py-4">Doctor</TableHead>
                <TableHead className="text-slate-600 font-semibold py-4">Specialty & Procedure</TableHead>
                <TableHead className="text-slate-600 font-semibold py-4">Room Type</TableHead>
                <TableHead className="text-slate-600 font-semibold py-4">Proposed Fee</TableHead>
                <TableHead className="text-slate-600 font-semibold py-4">Status</TableHead>
                <TableHead className="text-right text-slate-600 font-semibold py-4 pr-6">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell colSpan={6} className="py-6">
                      <div className="h-4 bg-slate-100 rounded w-full"></div>
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredFees.length > 0 ? (
                filteredFees.map((fee) => (
                  <TableRow key={fee.id} className="hover:bg-slate-50/50 transition-colors border-slate-100">
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-teal-50 flex items-center justify-center text-teal-700">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{fee.doctorName}</p>
                          <p className="text-xs text-slate-500">Affiliated Surgeon</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="space-y-1">
                        <p className="font-medium text-slate-700">{fee.specialtyName}</p>
                        <p className="text-xs text-slate-500 flex items-center">
                          <FileText className="h-3 w-3 mr-1" />
                          {fee.procedureName || 'Default Specialty Fee'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-slate-600">{fee.roomTypeName}</TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center text-teal-600 font-bold">
                        <HandCoins className="h-4 w-4 mr-1.5" />
                        ₹{parseFloat(fee.fee).toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-xs font-medium border-0 capitalize",
                          fee.status === 'approved' ? "bg-green-100 text-green-700" : 
                          fee.status === 'rejected' ? "bg-red-100 text-red-700" : 
                          "bg-amber-100 text-amber-700"
                        )}
                      >
                        {fee.status || 'pending'}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 text-right pr-6">
                      {(fee.status === 'pending' || !fee.status) ? (
                        <div className="flex gap-2 justify-end">
                          <Button 
                            size="sm" 
                            className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm h-8"
                            onClick={() => handleStatusUpdate(fee.id, 'approved')}
                          >
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Accept
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="text-slate-500 hover:text-red-600 hover:bg-red-50 h-8"
                            onClick={() => handleStatusUpdate(fee.id, 'rejected')}
                          >
                            <XCircle className="mr-1.5 h-3.5 w-3.5" /> Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          Decision made on {new Date().toLocaleDateString()}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="bg-slate-100 p-4 rounded-full mb-4">
                        <AlertCircle className="h-8 w-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900">No proposals found</h3>
                      <p className="text-slate-500 max-w-sm mt-1">
                        There are no fee proposals currently awaiting your review. They will appear here once doctors submit them.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
