/**
 * Page d'accueil provisoire.
 *
 * Rôle : vérifier que la chaîne complète (build, en-têtes de sécurité, tests
 * e2e) fonctionne. Le vrai contenu arrive avec l'authentification (étape 3).
 */
import type { ReactNode } from 'react';

/** @returns La page d'accueil provisoire. */
export default function HomePage(): ReactNode {
  return (
    <main>
      <h1>Lueur</h1>
      <p>Des photos à ouvrir chaque jour, chiffrées de bout en bout. En construction.</p>
    </main>
  );
}
