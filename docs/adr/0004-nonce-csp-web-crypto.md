# 0004. Nonce CSP généré avec Web Crypto plutôt que libsodium

- Statut : accepté (validé en revue de la PR 1)
- Date : 2026-11-26

## Contexte

La Content Security Policy stricte du site (`script-src 'nonce-…' 'strict-dynamic'`) exige un
nonce imprévisible et nouveau à chaque requête, généré dans le proxy Next.js. La règle 2 du
CLAUDE.md impose « uniquement libsodium via packages/crypto » pour la cryptographie.

## Décision

- `generateCspNonce()` dans `packages/crypto`, avec `crypto.getRandomValues` (API Web Crypto) :
  16 octets (128 bits, minimum de la spécification CSP3), encodés en base64.
- Échec explicite (`CryptoError`) si aucun générateur cryptographique n'est disponible, sans repli
  sur `Math.random`.
- La fonction reste dans `packages/crypto` : la règle d'isolement de la cryptographie s'applique.

## Alternatives écartées

- **libsodium (`randombytes_buf`)** : chargement asynchrone d'un module WebAssembly à chaque
  démarrage du runtime du proxy, pour un résultat équivalent : `randombytes_buf` utilise la même
  source d'aléa du système.
- **Hachages de scripts** : incompatibles avec les scripts générés dynamiquement par Next.js.

## Conséquences

- Exception documentée et limitée à l'aléa du nonce CSP. Toute autre opération cryptographique
  (chiffrement, signatures, dérivation de clés) passe par libsodium.
- Les pages sont rendues dynamiquement (pas de cache statique), ce qui convient à une application
  dont tout le contenu est privé.
