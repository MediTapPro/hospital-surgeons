import { redirect } from 'next/navigation';
import { PORTAL_MODE } from '@/lib/config/portal-mode';

export default function Home() {
  redirect(PORTAL_MODE === 'admin' ? '/admin/login' : '/login');
}
