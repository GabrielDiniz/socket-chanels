// src/app/admin/layout.tsx — Layout protegido para rotas admin (Auth Guard futuro)

import { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  // Futuro: Auth guard via tenant token ou middleware Next.js
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow p-4">
        <h1 className="text-2xl font-bold">Painel Admin</h1>
      </header>
      <main className="p-8">{children}</main>
    </div>
  );
}