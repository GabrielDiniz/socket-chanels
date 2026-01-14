// cypress/e2e/pairing.feature.cy.ts — Teste de feature e2e TDD para pareamento realtime MVP (TV gera code, simulate admin paired via localStorage + reload, switch ActiveView realtime)

describe('Feature: Pareamento Realtime TV-Admin (MVP simulate paired)', () => {
  it('Deve gerar código na TV, simulate admin paired, e switch ActiveView realtime', () => {
    cy.visit('/panel');

    // Verify PairingView + code gerado
    cy.findByRole('heading', { name: /Parear esta TV/i }).should('be.visible');
    cy.findByText(/Digite este código no Painel Admin/i).should('be.visible');
    cy.findByText(/Expira em/i).should('be.visible');
    cy.findByText(/Atualize a página para novo código/i).should('be.visible');

    // Captura code gerado (6 dígitos)
    cy.findByTestId('generated-code')
      .invoke('text')
      .should('match', /^\d{6}$/);

    // Simulate admin paired (set localStorage direct client-side)
    cy.window().then(win => {
      win.localStorage.setItem('pairedChannel', JSON.stringify({ slug: 'recepcao-principal', token: 'token-real' }));
    });

    // Reload pra hook useEffect on mount load paired (simula TV aberta enquanto admin pareia)
    cy.reload();

    // Verify switch realtime ActiveView
    cy.findByTestId('active-view-heading').contains(/Canal Pareado: recepcao-principal/i).should('be.visible');
    cy.findByText(/Conectado e pronto!/i).should('be.visible');
    cy.findByText(/Aguardando próxima chamada/i).should('be.visible');

    // Verify localStorage persistente (após reload)
    cy.window().its('localStorage').invoke('getItem', 'pairedChannel').should('contain', 'recepcao-principal');
  });
});