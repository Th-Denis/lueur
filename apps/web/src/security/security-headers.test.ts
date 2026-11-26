/**
 * Tests des en-têtes de sécurité statiques.
 */
import { describe, expect, it } from 'vitest';

import { SECURITY_HEADERS } from './security-headers';

/** Retrouve la valeur d'un en-tête, sans tenir compte de la casse. */
function headerValue(name: string): string | undefined {
  return SECURITY_HEADERS.find((header) => header.key.toLowerCase() === name.toLowerCase())?.value;
}

describe('SECURITY_HEADERS', () => {
  it('impose HTTPS pendant au moins un an, sous-domaines compris', () => {
    const hsts = headerValue('Strict-Transport-Security') ?? '';
    const maxAge = Number(/max-age=(\d+)/.exec(hsts)?.[1]);

    expect(maxAge).toBeGreaterThanOrEqual(31_536_000);
    expect(hsts).toContain('includeSubDomains');
  });

  it('interdit l’intégration du site dans un cadre', () => {
    expect(headerValue('X-Frame-Options')).toBe('DENY');
  });

  it('désactive la détection automatique du type de contenu', () => {
    expect(headerValue('X-Content-Type-Options')).toBe('nosniff');
  });

  it('ne transmet jamais l’URL de la page aux sites externes', () => {
    expect(headerValue('Referrer-Policy')).toBe('no-referrer');
  });

  it('désactive caméra, micro et géolocalisation', () => {
    const permissions = headerValue('Permissions-Policy') ?? '';

    expect(permissions).toContain('camera=()');
    expect(permissions).toContain('microphone=()');
    expect(permissions).toContain('geolocation=()');
  });

  it('ne déclare aucun en-tête en double', () => {
    const names = SECURITY_HEADERS.map((header) => header.key.toLowerCase());

    expect(new Set(names).size).toBe(names.length);
  });
});
