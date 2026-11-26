/**
 * Génération du nonce de la Content Security Policy (CSP) du site web.
 *
 * Rôle : produire, à chaque requête, une valeur aléatoire imprévisible que la
 * CSP utilise pour n'autoriser que les scripts émis par notre serveur
 * (`script-src 'nonce-…'`). Un attaquant qui injecterait un script ne peut
 * pas deviner ce nonce, donc son script est bloqué par le navigateur.
 *
 * Pourquoi ce fichier est dans packages/crypto : la règle 2 du CLAUDE.md
 * réserve toute utilisation d'aléa cryptographique à ce paquet.
 *
 * Pourquoi l'API Web Crypto plutôt que libsodium : le nonce est généré dans le
 * proxy Next.js, à chaque requête. `crypto.getRandomValues` est le générateur
 * aléatoire cryptographique (CSPRNG) natif du navigateur, de Node et du runtime
 * Edge, disponible de façon synchrone et sans charger le WebAssembly de
 * libsodium. Ce n'est pas une primitive maison : c'est la même source d'aléa
 * système que celle utilisée par `randombytes_buf` de libsodium.
 * Choix validé en revue de la PR 1 (voir l'ADR 0004).
 *
 * Références :
 * - CSP niveau 3, nonces : https://www.w3.org/TR/CSP3/#security-nonces
 * - getRandomValues : https://developer.mozilla.org/docs/Web/API/Crypto/getRandomValues
 */
import { CryptoError } from './errors';

/**
 * Taille du nonce en octets.
 * Pourquoi 16 : la spécification CSP3 demande au moins 128 bits d'aléa.
 */
export const CSP_NONCE_BYTE_LENGTH = 16;

/**
 * Génère un nonce CSP aléatoire, encodé en base64.
 *
 * À appeler une fois par requête HTTP, jamais à réutiliser entre deux requêtes.
 * Le nonce n'est pas un secret durable, mais il ne doit pas non plus être
 * journalisé inutilement.
 *
 * @returns Une chaîne base64 de 24 caractères représentant 16 octets aléatoires.
 * @throws {CryptoError} `RANDOM_SOURCE_UNAVAILABLE` si l'environnement ne fournit
 *   pas de générateur aléatoire cryptographique (on refuse alors tout repli sur
 *   un aléa faible comme `Math.random`).
 *
 * @example
 * ```ts
 * const nonce = generateCspNonce(); // ex. "3q2+7w8kR1m0bX9aZ4c2Fg=="
 * response.headers.set('Content-Security-Policy', `script-src 'nonce-${nonce}'`);
 * ```
 */
export function generateCspNonce(): string {
  // Récupère l'API Web Crypto globale. Les types TypeScript la déclarent
  // toujours présente, mais elle peut manquer dans un environnement exotique :
  // on la relit donc comme optionnelle pour vérifier sa présence à l'exécution.
  const webCrypto = (globalThis as { crypto?: Crypto }).crypto;

  // Sans générateur cryptographique, on échoue franchement : aucun repli.
  if (webCrypto === undefined) {
    throw new CryptoError(
      'RANDOM_SOURCE_UNAVAILABLE',
      'Aucun générateur aléatoire cryptographique disponible dans cet environnement.',
    );
  }

  // Alloue un tampon de 16 octets initialisés à zéro.
  const randomBytes = new Uint8Array(CSP_NONCE_BYTE_LENGTH);

  // Remplit le tampon avec de l'aléa issu du CSPRNG du système.
  webCrypto.getRandomValues(randomBytes);

  // Convertit chaque octet en caractère « binaire » (code 0 à 255), seule
  // forme acceptée par btoa.
  const binaryString = String.fromCharCode(...randomBytes);

  // Encode en base64 : c'est le format attendu par la directive 'nonce-…'.
  return btoa(binaryString);
}
