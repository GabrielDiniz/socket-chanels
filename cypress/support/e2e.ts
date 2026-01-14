// cypress/support/e2e.ts — Setup global Cypress (commands custom + @testing-library/cypress for findByRole etc.)

import './commands';
import '@testing-library/cypress/add-commands'; // Add TL commands (findByRole, findByText, etc.)