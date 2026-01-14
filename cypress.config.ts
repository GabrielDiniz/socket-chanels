// cypress.config.ts — Configuração Cypress com baseUrl pra Next.js custom server rodando localhost:3000

import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000', // App dev rodando em 3000 (npm run dev)
    setupNodeEvents(on, config) {
      // Futuro: tasks mock socket emit real
      return config;
    },
  },
});