/**
 * Tests de la classe de base des erreurs métier.
 */
import { describe, expect, it } from 'vitest';

import { DomainError } from './domain-error';

/** Erreur métier factice, pour tester le comportement hérité. */
class SampleFrozenError extends DomainError<'SAMPLE_FROZEN'> {
  public constructor() {
    super('SAMPLE_FROZEN', 'Élément figé.');
  }
}

describe('DomainError', () => {
  it('expose le code et le message fournis par la sous-classe', () => {
    // Act
    const error = new SampleFrozenError();

    // Assert
    expect(error.code).toBe('SAMPLE_FROZEN');
    expect(error.message).toBe('Élément figé.');
  });

  it('porte le nom de la sous-classe pour faciliter le diagnostic', () => {
    // Act
    const error = new SampleFrozenError();

    // Assert
    expect(error.name).toBe('SampleFrozenError');
  });

  it('reste une Error standard, identifiable par instanceof', () => {
    // Act
    const error = new SampleFrozenError();

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(SampleFrozenError);
  });
});
