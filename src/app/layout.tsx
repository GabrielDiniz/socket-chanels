// src/app/layout.tsx — Layout raiz global (RootLayout) para todo o app Next.js

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Painel de Chamada de Pacientes',
  description: 'Sistema de chamada em tempo real para clínicas e hospitais',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}