import { CreditCard, Stethoscope, Wallet } from 'lucide-react';
import { StatCard } from './StatCard';

interface HomeVisitOverviewProps {
  homeVisitsToday: number;
  patientPaymentsCollected: number;
  pendingDoctorPayout: number;
}

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function HomeVisitOverview({
  homeVisitsToday,
  patientPaymentsCollected,
  pendingDoctorPayout,
}: HomeVisitOverviewProps) {
  return (
    <section aria-labelledby="home-visit-overview-heading" className="space-y-4">
      <div>
        <h2 id="home-visit-overview-heading" className="text-lg font-semibold text-slate-900">Home Visit overview</h2>
        <p className="text-sm text-slate-600">Patient home-visit bookings, collections, and doctor payouts.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard title="Home visits today" value={homeVisitsToday} icon={Stethoscope} trend={{ value: 'Created today', isPositive: true }} />
        <StatCard title="Patient payments collected" value={currencyFormatter.format(patientPaymentsCollected)} icon={CreditCard} trend={{ value: 'Successful home-visit payments', isPositive: true }} />
        <StatCard title="Pending doctor payout" value={currencyFormatter.format(pendingDoctorPayout)} icon={Wallet} trend={{ value: 'Paid patients awaiting settlement', isPositive: false }} />
      </div>
    </section>
  );
}
