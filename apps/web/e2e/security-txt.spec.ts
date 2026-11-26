/**
 * Test end-to-end : le fichier security.txt (RFC 9116) est servi par le vrai
 * serveur, au bon emplacement, avec le bon type et les en-têtes de sécurité.
 */
import { expect, test } from '@playwright/test';

test('security.txt est servi en texte brut à l’emplacement standard', async ({ request }) => {
  // Act
  const response = await request.get('/.well-known/security.txt');

  // Assert
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^text\/plain/);
  expect(await response.text()).toMatch(/^Contact: https:\/\//m);
});

test('security.txt porte les en-têtes de sécurité du site', async ({ request }) => {
  const response = await request.get('/.well-known/security.txt');

  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['strict-transport-security']).toContain('max-age=');
});
