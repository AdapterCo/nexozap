import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NexoZap - Agendamento Inteligente para WhatsApp',
  description: 'Plataforma SaaS de agendamento de serviços via WhatsApp com IA e fluxos automatizados',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
