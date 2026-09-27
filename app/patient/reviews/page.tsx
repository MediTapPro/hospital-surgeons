'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, MessageSquare, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/httpClient';
import { toast } from 'sonner';

interface ReviewRow { review: { id: string; rating: number; reviewText: string | null; createdAt: string; reviewerType: string }; doctor: { firstName: string; lastName: string } | null; assignment: { id: string } | null; }

export default function PatientReviewsPage() {
  const router = useRouter();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ReviewRow | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [saving, setSaving] = useState(false);

  const loadReviews = async (nextPage = 1) => {
    try {
      if (nextPage === 1) setLoading(true);
      const response = await apiClient.get(`/api/patients/reviews?page=${nextPage}&limit=20`);
      if (!response.data?.success) throw new Error(response.data?.message || 'Unable to load reviews');
      const rows = response.data.data || [];
      setReviews((current) => nextPage === 1 ? rows : [...current, ...rows]);
      setPage(nextPage);
      setHasMore(rows.length === 20);
    } catch (error) {
      console.error('Error loading patient reviews:', error);
      toast.error('Unable to load your reviews.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReviews(); }, []);

  const openEdit = (row: ReviewRow) => {
    setEditing(row);
    setRating(row.review.rating);
    setReviewText(row.review.reviewText || '');
  };

  const saveEdit = async () => {
    if (!editing?.assignment?.id || !rating || saving) return;
    try {
      setSaving(true);
      const response = await apiClient.patch(`/api/patients/bookings/${editing.assignment.id}/rating`, { rating, reviewText: reviewText.trim() || undefined });
      if (!response.data?.success) throw new Error(response.data?.message || 'Unable to update review');
      setReviews((current) => current.map((row) => row.review.id === editing.review.id ? { ...row, review: { ...row.review, rating, reviewText: reviewText.trim() || null } } : row));
      setEditing(null);
      toast.success('Review updated successfully.');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to update review.');
    } finally {
      setSaving(false);
    }
  };

  return <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
    <div className="mx-auto max-w-3xl">
      <button type="button" onClick={() => router.back()} className="mb-5 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-blue-600"><ChevronLeft className="h-4 w-4" />Back</button>
      <div className="mb-6"><h1 className="text-2xl font-bold text-slate-900">My reviews</h1><p className="mt-1 text-sm text-slate-500">Reviews you submitted for completed home visits, newest first.</p></div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? <div className="px-6 py-16 text-center text-sm text-slate-500">Loading your reviews…</div> : reviews.length === 0 ? <div className="px-6 py-16 text-center"><MessageSquare className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-semibold text-slate-700">You have not submitted any reviews</p><p className="mt-1 text-sm text-slate-500">After a home visit is completed, you can rate the doctor from My Bookings.</p></div> : <div className="divide-y divide-slate-100">{reviews.map((row) => <article key={row.review.id} className="px-6 py-5"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-slate-900">Dr. {row.doctor?.firstName || ''} {row.doctor?.lastName || ''}</p><p className="text-xs text-slate-400">Home visit review</p></div><time className="text-xs text-slate-400" dateTime={row.review.createdAt}>{new Date(row.review.createdAt).toLocaleDateString('en-IN')}</time></div><div className="mt-3 flex items-center gap-1">{[1, 2, 3, 4, 5].map((star) => <Star key={star} className={`h-4 w-4 ${star <= row.review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />)}</div>{row.review.reviewText && <p className="mt-3 text-sm leading-6 text-slate-700">{row.review.reviewText}</p>}<button type="button" onClick={() => openEdit(row)} className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-700">Edit review</button></article>)}</div>}
        {!loading && hasMore && <div className="border-t border-slate-100 px-6 py-4 text-center"><button type="button" onClick={() => loadReviews(page + 1)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Load more reviews</button></div>}
      </section>
    </div>
    {editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-review-title"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 id="edit-review-title" className="text-lg font-bold text-slate-900">Edit review</h2><button type="button" onClick={() => setEditing(null)} aria-label="Close edit review" className="text-2xl text-slate-400">×</button></div><div className="mt-5 flex gap-2">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" onClick={() => setRating(value)} aria-label={`${value} stars`}><Star className={`h-8 w-8 ${value <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} /></button>)}</div><textarea value={reviewText} onChange={(event) => setReviewText(event.target.value)} maxLength={2000} rows={4} className="mt-5 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button><button type="button" onClick={saveEdit} disabled={!rating || saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button></div></div></div>}
  </main>;
}
