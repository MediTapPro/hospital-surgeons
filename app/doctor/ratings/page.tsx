'use client';

import { useEffect, useMemo, useState } from 'react';
import { MessageSquare, Star, UserRound } from 'lucide-react';
import apiClient from '@/lib/api/httpClient';
import { toast } from 'sonner';

interface ReviewRow {
  review: { id: string; rating: number; reviewText: string | null; reviewerType: 'hospital' | 'patient'; positiveTags: string[] | null; negativeTags: string[] | null; createdAt: string };
  hospital: { id: string; name: string } | null;
  patient: { id: string; fullName: string } | null;
}

function Stars({ value }: { value: number }) {
  return <div className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((star) => <Star key={star} className={`h-4 w-4 ${star <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />)}
  </div>;
}

export default function RatingsReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [summary, setSummary] = useState({ averageRating: 0, totalRatings: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReviews = async () => {
      try {
        const profileResponse = await apiClient.get('/api/doctors/profile');
        const doctorId = profileResponse.data?.data?.id;
        if (!doctorId) throw new Error('Doctor profile not found');
        const ratingsResponse = await apiClient.get(`/api/doctors/${doctorId}/ratings?page=1&limit=50`);
        if (!ratingsResponse.data?.success) throw new Error(ratingsResponse.data?.message || 'Unable to load reviews');
        setReviews(ratingsResponse.data.data || []);
        setSummary({
          averageRating: Number(profileResponse.data?.data?.averageRating || 0),
          totalRatings: Number(profileResponse.data?.data?.totalRatings || 0),
        });
      } catch (error) {
        console.error('Error loading doctor reviews:', error);
        toast.error('Unable to load ratings and reviews.');
      } finally {
        setLoading(false);
      }
    };
    loadReviews();
  }, []);

  const breakdown = useMemo(() => [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviews.filter((row) => row.review.rating === rating).length,
  })), [reviews]);

  if (loading) return <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">Loading ratings and reviews…</div>;

  return <div className="space-y-6">
    <header>
      <h1 className="text-2xl font-bold text-slate-900">Ratings &amp; Reviews</h1>
      <p className="mt-1 text-sm text-slate-500">Feedback from hospitals and patients after completed assignments.</p>
    </header>

    <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">Overall rating</p>
        <div className="mt-3 flex items-end gap-3"><span className="text-4xl font-bold text-slate-900">{summary.averageRating.toFixed(1)}</span><span className="pb-1 text-sm text-slate-500">from {summary.totalRatings} review{summary.totalRatings === 1 ? '' : 's'}</span></div>
        <Stars value={Math.round(summary.averageRating)} />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">Review breakdown</p>
        <div className="mt-3 space-y-2">{breakdown.map((item) => <div key={item.rating} className="flex items-center gap-3 text-sm"><span className="w-10 text-slate-600">{item.rating} star</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-amber-400" style={{ width: `${summary.totalRatings ? (item.count / summary.totalRatings) * 100 : 0}%` }} /></div><span className="w-6 text-right text-slate-500">{item.count}</span></div>)}</div>
      </div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4"><h2 className="font-semibold text-slate-900">All reviews</h2></div>
      {reviews.length === 0 ? <div className="px-6 py-16 text-center"><MessageSquare className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-medium text-slate-700">No reviews yet</p><p className="mt-1 text-sm text-slate-500">Reviews will appear after a completed assignment is rated.</p></div> : <div className="divide-y divide-slate-100">{reviews.map((row) => {
        const reviewer = row.review.reviewerType === 'patient' ? row.patient?.fullName || 'Patient' : row.hospital?.name || 'Hospital';
        return <article key={row.review.id} className="px-6 py-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">{row.review.reviewerType === 'patient' ? <UserRound className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}</div><div><p className="font-semibold text-slate-900">{reviewer}</p><p className="text-xs capitalize text-slate-500">{row.review.reviewerType} review</p></div></div><div className="flex items-center gap-3"><Stars value={row.review.rating} /><time className="text-xs text-slate-400" dateTime={row.review.createdAt}>{new Date(row.review.createdAt).toLocaleDateString('en-IN')}</time></div></div>{row.review.reviewText && <p className="mt-4 text-sm leading-6 text-slate-700">{row.review.reviewText}</p>}{(row.review.positiveTags?.length || row.review.negativeTags?.length) ? <div className="mt-3 flex flex-wrap gap-2">{[...(row.review.positiveTags || []), ...(row.review.negativeTags || [])].map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{tag}</span>)}</div> : null}</article>;
      })}</div>}
    </section>
  </div>;
}
