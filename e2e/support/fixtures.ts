// Shared identities for the e2e run. The server script seeds exactly these, and specs
// log in with them. Values are local-only; the database is in-memory and discarded.
export const E2E_PORT = 3103;
export const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;
export const E2E_JWT_SECRET = 'e2e-only-secret-e2e-only-secret-e2e-only';

export const ADMIN = {
  email: 'admin@e2e.test',
  password: 'admin-e2e-password',
  name: 'E2E Admin',
};

export const EDITOR = {
  email: 'editor@e2e.test',
  password: 'editor-e2e-password',
  name: 'E2E Editor',
};

export const SITE_A = { name: 'Acme Site', slug: 'acme', domain: 'https://acme.e2e.test' };
export const SITE_B = { name: 'Beta Site', slug: 'beta', domain: 'https://beta.e2e.test' };
