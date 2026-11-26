/**
 * Construction de la Content Security Policy (CSP) du site.
 *
 * Rôle : décrire, en un seul endroit testé, ce que le navigateur a le droit de
 * charger et d'exécuter. C'est notre principale défense contre les injections
 * de script (XSS) : un script injecté pourrait sinon lire les photos
 * déchiffrées ou les clés privées présentes dans la page.
 *
 * Principes retenus (spec, section 7 : « CSP stricte ») :
 * - scripts autorisés uniquement avec le nonce de la requête ('strict-dynamic'
 *   permet à ces scripts de charger les morceaux de code de Next.js) ;
 * - aucune ressource tierce : tout vient de notre propre origine ;
 * - aucun cadre (iframe) autour de notre site, aucun plugin, aucun <base>.
 *
 * Fonction pure, sans accès à la requête : elle se teste facilement.
 */

/** Options de construction de la CSP. */
export interface ContentSecurityPolicyOptions {
  /** Nonce aléatoire propre à la requête, généré par `@lueur/crypto`. */
  readonly nonce: string;
  /**
   * Mode développement. Pourquoi un mode à part : le rechargement à chaud de
   * Next.js a besoin de `eval` et de styles en ligne. Ces assouplissements ne
   * sont JAMAIS appliqués en production.
   */
  readonly isDevelopment: boolean;
}

/**
 * Construit la valeur de l'en-tête `Content-Security-Policy`.
 *
 * @param options - Nonce de la requête et mode d'exécution.
 * @returns La politique complète, directives séparées par « ; ».
 *
 * @example
 * ```ts
 * const policy = buildContentSecurityPolicy({ nonce, isDevelopment: false });
 * response.headers.set('Content-Security-Policy', policy);
 * ```
 */
export function buildContentSecurityPolicy(options: ContentSecurityPolicyOptions): string {
  const { nonce, isDevelopment } = options;
  const nonceSource = `'nonce-${nonce}'`;

  const scriptSources = ["'self'", nonceSource, "'strict-dynamic'"];
  if (isDevelopment) {
    scriptSources.push("'unsafe-eval'");
  }

  // Pourquoi pas de nonce sur les styles en développement : en présence d'un
  // nonce, le navigateur ignore 'unsafe-inline', dont Next.js a besoin en dev.
  const styleSources = isDevelopment ? ["'self'", "'unsafe-inline'"] : ["'self'", nonceSource];

  const directives: readonly (readonly [string, readonly string[]])[] = [
    ['default-src', ["'self'"]],
    ['script-src', scriptSources],
    ['style-src', styleSources],
    // blob: est nécessaire pour afficher une photo déchiffrée en mémoire.
    ['img-src', ["'self'", 'blob:', 'data:']],
    ['media-src', ["'self'", 'blob:']],
    ['font-src', ["'self'"]],
    // Les appels à Supabase seront ajoutés ici, de façon explicite, à l'étape 3.
    ['connect-src', ["'self'"]],
    ['worker-src', ["'self'", 'blob:']],
    ['manifest-src', ["'self'"]],
    ['frame-src', ["'none'"]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'none'"]],
    ['form-action', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
  ];

  return directives.map(([name, sources]) => `${name} ${sources.join(' ')}`).join('; ');
}
