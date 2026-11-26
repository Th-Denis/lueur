/**
 * Proxy Next.js (anciennement « middleware ») : exécuté avant chaque requête.
 *
 * Rôle : générer un nonce neuf pour chaque requête et poser la Content
 * Security Policy correspondante.
 * - Le nonce est transmis à Next.js via l'en-tête de requête
 *   `Content-Security-Policy` : Next.js le lit et l'ajoute automatiquement à
 *   ses propres balises <script>.
 * - La même politique est renvoyée au navigateur dans la réponse.
 *
 * Pourquoi un nonce par requête plutôt qu'une liste de hachages : c'est la
 * méthode documentée par Next.js pour une CSP stricte avec l'App Router.
 * Contrepartie assumée : les pages sont rendues dynamiquement (pas de cache
 * statique), ce qui convient à une application dont tout le contenu est privé.
 */
import { generateCspNonce } from '@lueur/crypto/csp-nonce';
import { NextResponse, type NextRequest } from 'next/server';

import { buildContentSecurityPolicy } from './security/content-security-policy';

const CSP_HEADER = 'Content-Security-Policy';

/**
 * Pose la CSP de la requête.
 *
 * @param request - Requête entrante.
 * @returns La réponse, enrichie de l'en-tête CSP.
 */
export function proxy(request: NextRequest): NextResponse {
  const policy = buildContentSecurityPolicy({
    nonce: generateCspNonce(),
    isDevelopment: process.env.NODE_ENV === 'development',
  });

  // Next.js lit le nonce dans l'en-tête CSP de la requête pour l'appliquer à
  // ses scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_HEADER, policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(CSP_HEADER, policy);
  return response;
}

/**
 * Requêtes concernées : toutes les pages, sauf les fichiers statiques de
 * Next.js (déjà servis tels quels) et les préchargements de liens.
 */
export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
