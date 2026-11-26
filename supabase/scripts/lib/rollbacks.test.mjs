/**
 * Tests des fonctions pures du vérificateur de retours arrière (lib/rollbacks.mjs).
 */
import { describe, expect, it } from 'vitest';

import {
  RollbackPairingError,
  describeSchemaDifference,
  normalizeSchemaDump,
  pairMigrations,
  readProjectId,
} from './rollbacks.mjs';

describe('pairMigrations', () => {
  it('renvoie les migrations appariées dans l’ordre chronologique', () => {
    // Arrange
    const migrations = ['20261201000000_items.sql', '20261126131836_base.sql', 'README.md'];
    const rollbacks = ['20261126131836_base.sql', '20261201000000_items.sql'];

    // Act
    const paired = pairMigrations(migrations, rollbacks);

    // Assert
    expect(paired).toEqual(['20261126131836_base.sql', '20261201000000_items.sql']);
  });

  it('signale une migration sans retour arrière', () => {
    expect(() => pairMigrations(['20261126131836_base.sql'], [])).toThrow(RollbackPairingError);
  });

  it('signale un retour arrière orphelin', () => {
    expect(() => pairMigrations([], ['20261126131836_base.sql'])).toThrow(
      /sans migration correspondante/,
    );
  });

  it('signale un nom de migration invalide et liste tous les écarts', () => {
    // Act
    let error;
    try {
      pairMigrations(['base-Schemas.sql'], ['base-Schemas.sql', '20261126131836_x.sql']);
    } catch (caught) {
      error = caught;
    }

    // Assert
    expect(error).toBeInstanceOf(RollbackPairingError);
    expect(error.problems).toHaveLength(2);
    expect(error.problems[0]).toContain('nom invalide');
  });
});

describe('readProjectId', () => {
  it('lit project_id malgré les commentaires du fichier', () => {
    const config = '{\n  // commentaire\n  "project_id": "lueur",\n  "api": {},\n}';
    expect(readProjectId(config)).toBe('lueur');
  });

  it.each(['{}', '{ "project_id": "Lueur Prod" }', '{ "project_id": "x;rm" }'])(
    'refuse une configuration sans identifiant valide (%s)',
    (config) => {
      expect(() => readProjectId(config)).toThrow('project_id');
    },
  );
});

describe('normalizeSchemaDump', () => {
  it('retire les lignes \\restrict et \\unrestrict à clé aléatoire', () => {
    const dump = '\\restrict abc123\r\nCREATE SCHEMA private;\r\n\\unrestrict abc123\r\n';
    expect(normalizeSchemaDump(dump)).toBe('CREATE SCHEMA private;\n');
  });
});

describe('describeSchemaDifference', () => {
  it('renvoie null pour deux exports identiques', () => {
    expect(describeSchemaDifference('a\nb', 'a\nb')).toBeNull();
  });

  it('décrit la première ligne différente', () => {
    expect(describeSchemaDifference('a\nb\nc', 'a\nB\nc')).toBe(
      'ligne 2 : attendu "b", obtenu "B"',
    );
  });

  it('signale une ligne manquante', () => {
    expect(describeSchemaDifference('a\nb', 'a')).toBe('ligne 2 : attendu "b", obtenu ""');
  });
});
