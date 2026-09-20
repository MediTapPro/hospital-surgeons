'use client';

import type { ReactNode } from 'react';
import { PortalModeGate } from '@/app/_components/PortalModeGate';

export default function RegistrationLayout({ children }: { children: ReactNode }) {
  return <PortalModeGate>{children}</PortalModeGate>;
}
