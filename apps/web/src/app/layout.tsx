/**
 * Mise en page racine de l'app web.
 *
 * Rôle : structure HTML commune à toutes les pages (langue, métadonnées).
 *
 * Pourquoi `connection()` : la CSP utilise un nonce différent à chaque requête.
 * Next.js ne peut l'insérer que dans une page rendue à la demande ; cet appel
 * désactive donc le rendu statique pour toute l'application.
 */
import type { Metadata } from 'next';
import { connection } from 'next/server';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Lueur',
  description: 'Des photos à ouvrir chaque jour, chiffrées de bout en bout.',
  // Bêta privée : aucune indexation par les moteurs de recherche.
  robots: { index: false, follow: false },
};

/**
 * @param props.children - Contenu de la page affichée.
 * @returns La structure HTML de la page.
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>): Promise<ReactNode> {
  await connection();

  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
