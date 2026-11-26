/**
 * Tests du fichier security.txt (RFC 9116) servi par le site web.
 *
 * Rôle : garantir que le fichier de signalement des vulnérabilités (specs,
 * section 7 bis, « Revues humaines ») reste valide.
 *
 * Pourquoi tester la date d'expiration : la RFC 9116 impose une date
 * d'expiration, à moins d'un an, après laquelle le fichier ne doit plus être
 * considéré comme fiable. Ce test échoue 30 jours avant l'échéance : la CI
 * rappelle ainsi de renouveler le fichier, au lieu de le laisser expirer.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SECURITY_TXT_PATH = path.join(import.meta.dirname, '../../public/.well-known/security.txt');

/** Durée de validité maximale recommandée par la RFC 9116 (§ 2.5.5). */
const MAX_VALIDITY_MS = 366 * 24 * 60 * 60 * 1000;

/** Délai avant l'échéance à partir duquel le test réclame un renouvellement. */
const RENEWAL_NOTICE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Lit les champs du fichier security.txt.
 *
 * @returns Une liste de couples [champ, valeur], dans l'ordre du fichier.
 */
function readFields(): [string, string][] {
  return readFileSync(SECURITY_TXT_PATH, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0 && !line.startsWith('#'))
    .map((line) => {
      const separator = line.indexOf(':');
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    });
}

/**
 * Renvoie l'unique valeur d'un champ.
 *
 * @param name - Nom du champ, par exemple `Expires`.
 * @returns La valeur du champ.
 * @throws {Error} Si le champ est absent ou présent plusieurs fois.
 */
function readSingleField(name: string): string {
  const values = readFields()
    .filter(([field]) => field === name)
    .map(([, value]) => value);
  const [value] = values;
  if (values.length !== 1 || value === undefined) {
    throw new Error(`Le champ ${name} doit apparaître exactement une fois.`);
  }
  return value;
}

describe('security.txt', () => {
  it('indique un contact en HTTPS', () => {
    expect(readSingleField('Contact')).toMatch(/^https:\/\//);
  });

  it('expire dans le futur, avec au moins 30 jours de marge', () => {
    // Arrange
    const expires = Date.parse(readSingleField('Expires'));

    // Assert
    expect(Number.isNaN(expires)).toBe(false);
    expect(expires - Date.now()).toBeGreaterThan(RENEWAL_NOTICE_MS);
  });

  it('n’est pas valide plus d’un an', () => {
    const expires = Date.parse(readSingleField('Expires'));
    expect(expires - Date.now()).toBeLessThan(MAX_VALIDITY_MS);
  });

  it('respecte le format ISO 8601 imposé par la RFC pour Expires', () => {
    expect(readSingleField('Expires')).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/,
    );
  });

  it('ne contient que des champs définis par la RFC 9116', () => {
    const allowed = new Set([
      'Acknowledgments',
      'Canonical',
      'Contact',
      'Encryption',
      'Expires',
      'Hiring',
      'Policy',
      'Preferred-Languages',
    ]);
    expect(
      readFields()
        .map(([field]) => field)
        .filter((field) => !allowed.has(field)),
    ).toEqual([]);
  });
});
