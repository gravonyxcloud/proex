import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Status',
  description: 'Status em tempo real da Proex: APIs, ponte de licenças e modelos disponíveis.',
  alternates: { canonical: '/status' },
};

import StatusClient from './StatusClient';

export default function StatusPage() {
  return <StatusClient />;
}