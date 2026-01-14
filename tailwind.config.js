// tailwind.config.js — Configuração Tailwind CSS para o projeto Next.js (App Router)

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}', // Todos os arquivos na src (incluindo app/)
    './app/**/*.{js,ts,jsx,tsx}', // Compatibilidade extra se precisar
  ],
  theme: {
    extend: {
      // Futuras customizações (cores hospitalares, fonts, etc.) podem vir aqui
    },
  },
  plugins: [],
};