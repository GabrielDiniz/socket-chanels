// src/app/admin/page.tsx — Stub mínimo da página Admin (pra não dar 404 ao acessar /admin)

export default function AdminPage() {
  return (
    <main className="flex h-screen items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-gray-800 mb-8">Painel Admin</h1>
        <p className="text-2xl text-gray-600">Área de gerenciamento de canais e pareamento</p>
        <p className="mt-12 text-lg text-gray-500">Em desenvolvimento — aguarde as próximas fases! 🚀</p>
      </div>
    </main>
  );
}