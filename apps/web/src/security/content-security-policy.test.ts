/**
 * Tests de la Content Security Policy.
 *
 * Chaque test vérifie une propriété de sécurité attendue de la politique, en
 * production comme en développement.
 */
import { describe, expect, it } from 'vitest';

import { buildContentSecurityPolicy } from './content-security-policy';

const NONCE = 'dGVzdC1ub25jZS0xMjM0NQ==';

/** Découpe la politique en dictionnaire « directive → sources ». */
function parsePolicy(policy: string): Map<string, string[]> {
  return new Map(
    policy.split('; ').map((directive) => {
      const [name = '', ...sources] = directive.split(' ');
      return [name, sources];
    }),
  );
}

describe('buildContentSecurityPolicy en production', () => {
  const directives = parsePolicy(
    buildContentSecurityPolicy({ nonce: NONCE, isDevelopment: false }),
  );

  it('n’autorise que les scripts portant le nonce de la requête', () => {
    expect(directives.get('script-src')).toEqual([
      "'self'",
      `'nonce-${NONCE}'`,
      "'strict-dynamic'",
    ]);
  });

  it('n’autorise ni eval ni script en ligne', () => {
    const policy = buildContentSecurityPolicy({ nonce: NONCE, isDevelopment: false });
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toContain("'unsafe-inline'");
  });

  it('interdit l’affichage du site dans un cadre (clickjacking)', () => {
    expect(directives.get('frame-ancestors')).toEqual(["'none'"]);
  });

  it('interdit les plugins et la balise <base>', () => {
    expect(directives.get('object-src')).toEqual(["'none'"]);
    expect(directives.get('base-uri')).toEqual(["'none'"]);
  });

  it('ne charge aucune ressource depuis une origine tierce', () => {
    for (const sources of directives.values()) {
      for (const source of sources) {
        expect(source).not.toMatch(/^https?:/);
        expect(source).not.toBe('*');
      }
    }
  });

  it('autorise blob: pour les images, nécessaire aux photos déchiffrées', () => {
    expect(directives.get('img-src')).toContain('blob:');
  });
});

describe('buildContentSecurityPolicy en développement', () => {
  const directives = parsePolicy(buildContentSecurityPolicy({ nonce: NONCE, isDevelopment: true }));

  it('autorise eval pour le rechargement à chaud', () => {
    expect(directives.get('script-src')).toContain("'unsafe-eval'");
  });

  it('autorise les styles en ligne sans nonce, sinon le navigateur les bloquerait', () => {
    expect(directives.get('style-src')).toEqual(["'self'", "'unsafe-inline'"]);
  });

  it('conserve les protections contre le clickjacking et les plugins', () => {
    expect(directives.get('frame-ancestors')).toEqual(["'none'"]);
    expect(directives.get('object-src')).toEqual(["'none'"]);
  });
});
