# CLAUDE.md – Calendrier photos chiffré

## Contexte
Application web et mobile de photos programmées (ex. calendrier de l'Avent),
chiffrées de bout en bout. Les specs complètes sont dans docs/SPECS.md :
lis-les avant toute tâche. En cas de doute ou de contradiction, demande.

## Stack
- TypeScript strict, monorepo pnpm + Turborepo
- apps/mobile : Expo (React Native), Expo Router
- apps/web : Next.js (App Router)
- packages/crypto : toute la cryptographie (libsodium), rien ailleurs
- packages/core : types, schémas Zod, client API
- Backend : Supabase (Postgres, Auth, Storage, Edge Functions)
- Hébergement : Supabase Cloud UE pour la bêta, puis Supabase
  auto-hébergé sur Scaleway ; site sur Scaleway Serverless Containers ;
  infrastructure en Terraform. Aucune fonctionnalité propre au cloud Supabase.
- Design system : packages/design-tokens + Tailwind (web) / NativeWind (mobile)

## Commandes
- pnpm install
- pnpm dev            # web + mobile + Supabase local
- pnpm test           # tests unitaires (Vitest)
- pnpm test:e2e       # Playwright (web) et Maestro (mobile)
- pnpm lint && pnpm typecheck
- supabase db reset   # recrée la base locale depuis les migrations

## Règles de sécurité non négociables
1. Le serveur ne voit jamais une photo, une légende ou une clé privée en clair.
2. Aucune primitive crypto maison : uniquement libsodium via packages/crypto.
3. Un fichier chiffré n'est livré qu'après reveal_local, évalué dans le fuseau
   effectif du destinataire avec l'heure du serveur, via l'Edge Function de
   révélation et une URL signée de 60 s.
4. RLS activée sur toutes les tables ; jamais de clé service_role côté client.
5. Aucune donnée sensible dans les logs, Sentry ou les messages d'erreur.
6. Toute modification de packages/crypto ou d'une politique RLS est signalée
   explicitement dans la description de la PR.
7. Respecter OWASP ASVS niveau 2 (web, API) et MASVS (mobile) ; vérifier le
   Top 10 OWASP à chaque PR.
8. CI bloquante : CodeQL, Semgrep, gitleaks, pnpm audit, tests RLS, tests
   d'autorisation (sans session, autre utilisateur, avant/après reveal_local).
   Ne jamais désactiver ni contourner un contrôle pour faire passer la CI.
9. Dépendances figées, lockfile obligatoire, GitHub Actions épinglées par
   hash. Justifier toute nouvelle dépendance dans la PR.
10. Notifications et emails sans aucun contenu ni aperçu.
11. Ne jamais loguer ni transmettre une URL signée.
12. Aucune énumération de comptes : réponses identiques que le compte
    existe ou non.
13. Validation Zod de toutes les entrées côté client ET serveur ; rate
    limiting sur auth, invitations et téléchargements.
14. Chaque nouvelle route ou table s'accompagne de ses tests de sécurité
    dans la même PR.
15. En cas de doute sur la sécurité : s'arrêter et demander, ne jamais
    supposer. La section 7 bis des specs fait foi.

## Données
- Schéma normalisé, contraintes en base (FK, NOT NULL, CHECK, UNIQUE).
- Clés primaires UUID v7, dates en timestamptz UTC (sauf reveal_local).
- COMMENT ON sur chaque table et colonne ; mettre à jour docs/DATA_MODEL.md.
- Migrations versionnées, additives et réversibles quand c'est possible.
- L'accès à un item passe uniquement par la fonction can_access_item.
- Dates de révélation en reveal_local (sans fuseau) ; fuseau par utilisateur,
  changement effectif après 24 h. Jamais l'heure de l'appareil.
- Une photo est modifiable ou retirable tant qu'elle n'est ouverte pour
  aucun destinataire, figée ensuite (règle imposée côté serveur).
- V1 : photos uniquement (JPEG, PNG, HEIC), traitées et nettoyées des EXIF
  sur l'appareil avant chiffrement ; colonne media_type pour la suite.
- Anticiper les évolutions décrites dans la section 8 ter des specs,
  sans créer les tables futures.

## Style de code
- Architecture en couches : domaine, application, infrastructure, interface.
- Commentaires abondants et verbeux : en-tête par fichier, JSDoc complète
  sur chaque fonction exportée, commentaires « pourquoi » sur les choix.
- Code crypto commenté ligne à ligne.
- Noms explicites, fonctions courtes, erreurs métier typées.
- Commentaires et documentation en français, code et identifiants en anglais.

## Façon de travailler
- Suivre le plan de développement des specs, une étape à la fois.
- Web responsive d'abord ; le mobile vient après la bêta, mais tout code
  partageable va dans packages/ dès le départ.
- Avant de coder : proposer un plan court et attendre validation.
- Une fonctionnalité = une branche = une PR, CI verte obligatoire.
- Pas de fonctionnalité terminée sans tests unitaires et un test e2e.
- Toute décision structurante est consignée dans un ADR (docs/adr/).
- Mettre à jour README, ARCHITECTURE.md et SECURITY.md si nécessaire.

## Développement agentique
### Sous-agents (.claude/agents/)
À créer à l'étape 1 du plan, puis à faire valider par Thibaut avant usage :
- security-reviewer : relit toute modification touchant crypto, auth, RLS,
  Edge Functions ou stockage ; applique la section 7 bis et l'OWASP ASVS ;
  lecture seule, produit un rapport bloquant ou non.
- data-architect : conçoit et relit schéma, migrations, index, contraintes,
  COMMENT ON et docs/DATA_MODEL.md ; vérifie normalisation et réversibilité.
- test-writer : écrit les tests unitaires, e2e et de sécurité (RLS,
  autorisations, fuseaux horaires, verrouillage temporel).
- doc-writer : vérifie en-têtes de fichiers, JSDoc, commentaires « pourquoi »,
  ADR et documentation générale.

### Workflow par fonctionnalité
1. Plan proposé et validé.
2. Implémentation, avec data-architect si la base est concernée.
3. test-writer complète les tests.
4. security-reviewer relit si le changement est sensible.
5. doc-writer vérifie la documentation.
6. PR avec le résumé de chaque relecture.

### Hooks (.claude/settings.json)
- Après chaque modification de fichier : format, lint et typecheck.
- Avant de terminer une tâche : tests unitaires concernés.
- Blocage de toute commande lisant ou écrivant des fichiers .env ou secrets.

### Permissions
- Interdits sans accord explicite : push sur main, commandes destructrices
  (rm -rf, supabase db reset hors local, drop), accès à la production.

### Garde-fous sur les agents eux-mêmes
- Ne jamais modifier CLAUDE.md, .claude/agents/, .claude/settings.json ni la
  configuration de la CI sans validation explicite de Thibaut.
- Ne jamais affaiblir un hook, une permission ou un contrôle pour avancer.
