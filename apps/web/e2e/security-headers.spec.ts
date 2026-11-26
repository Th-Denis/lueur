/**
 * Test end-to-end : en-têtes de sécurité et CSP sur le vrai serveur.
 *
 * Vérifie, sur un build de production, que :
 * - chaque réponse porte la CSP et les en-têtes de sécurité attendus ;
 * - le nonce change à chaque requête et figure sur les scripts de la page ;
 * - la page s'affiche sans aucune violation de CSP dans la console.
 */
import { expect, test, type Page, type Response } from '@playwright/test';

/** Extrait le nonce de la directive script-src d'une CSP. */
function extractNonce(policy: string): string | undefined {
  return /'nonce-([^']+)'/.exec(policy)?.[1];
}

/** Charge la page d'accueil et renvoie la réponse HTTP, en échouant si elle manque. */
async function loadHomePage(page: Page): Promise<Response> {
  const response = await page.goto('/');
  if (response === null) {
    throw new Error('Aucune réponse HTTP pour la page d’accueil.');
  }
  return response;
}

test('la page d’accueil s’affiche sans violation de CSP', async ({ page }) => {
  // Arrange : toute violation de CSP apparaît comme une erreur de console.
  const cspViolations: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('Content Security Policy')) {
      cspViolations.push(message.text());
    }
  });

  // Act
  await loadHomePage(page);

  // Assert
  await expect(page.getByRole('heading', { level: 1, name: 'Lueur' })).toBeVisible();
  expect(cspViolations).toEqual([]);
});

test('la réponse porte une CSP stricte avec nonce', async ({ page }) => {
  // Act
  const headers = (await loadHomePage(page)).headers();
  const policy = headers['content-security-policy'] ?? '';

  // Assert
  expect(extractNonce(policy)).toBeDefined();
  expect(policy).toContain("'strict-dynamic'");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).not.toContain("'unsafe-eval'");
  expect(policy).not.toContain("'unsafe-inline'");
});

test('le nonce change à chaque requête et figure sur les scripts', async ({ page, request }) => {
  // Act
  const policy = (await loadHomePage(page)).headers()['content-security-policy'] ?? '';
  const nonce = extractNonce(policy);
  const otherPolicy = (await request.get('/')).headers()['content-security-policy'] ?? '';

  // Assert : nonce différent d'une requête à l'autre.
  expect(nonce).toBeDefined();
  expect(extractNonce(otherPolicy)).not.toBe(nonce);

  // Assert : chaque script avec une source porte le nonce de la requête.
  const scriptNonces = await page
    .locator('script[src]')
    .evaluateAll((scripts) => scripts.map((script) => (script as HTMLScriptElement).nonce));
  expect(scriptNonces.length).toBeGreaterThan(0);
  for (const scriptNonce of scriptNonces) {
    expect(scriptNonce).toBe(nonce);
  }
});

test('la réponse porte les en-têtes de sécurité et ne révèle pas la technologie', async ({
  page,
}) => {
  // Act
  const headers = (await loadHomePage(page)).headers();

  // Assert
  expect(headers['strict-transport-security']).toContain('max-age=63072000');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('no-referrer');
  expect(headers['cross-origin-opener-policy']).toBe('same-origin');
  expect(headers['x-powered-by']).toBeUndefined();
});
