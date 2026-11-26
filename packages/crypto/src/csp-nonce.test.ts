/**
 * Tests de la génération du nonce CSP.
 *
 * On vérifie le format (base64, 16 octets), l'unicité entre appels et le refus
 * de fonctionner sans générateur aléatoire cryptographique.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CSP_NONCE_BYTE_LENGTH, CryptoError, generateCspNonce } from './index';

/** Décode une chaîne base64 en octets, pour inspecter le nonce produit. */
function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

describe('generateCspNonce', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('produit une chaîne base64 valide', () => {
    // Act
    const nonce = generateCspNonce();

    // Assert
    expect(nonce).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });

  it('représente exactement 16 octets, soit 128 bits d’aléa', () => {
    // Act
    const decoded = decodeBase64(generateCspNonce());

    // Assert
    expect(CSP_NONCE_BYTE_LENGTH).toBe(16);
    expect(decoded).toHaveLength(CSP_NONCE_BYTE_LENGTH);
  });

  it('ne produit jamais deux fois le même nonce sur 1 000 appels', () => {
    // Act
    const nonces = new Set(Array.from({ length: 1000 }, () => generateCspNonce()));

    // Assert
    expect(nonces.size).toBe(1000);
  });

  it('utilise le générateur cryptographique du système', () => {
    // Arrange
    const spy = vi.spyOn(globalThis.crypto, 'getRandomValues');

    // Act
    generateCspNonce();

    // Assert
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it('refuse de fonctionner sans générateur cryptographique, sans repli faible', () => {
    // Arrange
    vi.stubGlobal('crypto', undefined);

    // Act et Assert
    expect(() => generateCspNonce()).toThrow(CryptoError);
    try {
      generateCspNonce();
    } catch (error) {
      expect(error).toBeInstanceOf(CryptoError);
      expect((error as CryptoError).code).toBe('RANDOM_SOURCE_UNAVAILABLE');
      expect((error as CryptoError).name).toBe('CryptoError');
    }
  });
});
