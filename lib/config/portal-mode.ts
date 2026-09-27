export const PORTAL_MODE = process.env.NEXT_PUBLIC_PORTAL_MODE === 'admin' ? 'admin' : 'all';

export const isAdminOnlyPortal = () => PORTAL_MODE === 'admin';
