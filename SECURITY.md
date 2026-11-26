# Sécurité de Lueur

Ce document décrit ce que Lueur protège, contre qui, comment, et les limites assumées. Les règles
de développement correspondantes sont dans [CLAUDE.md](CLAUDE.md) et dans la section 7 bis des
[spécifications](docs/SPECS.md), qui fait foi.

> **Statut** : projet en construction (étape 1, fondations). Aucune donnée réelle n'est encore
> traitée. Ce modèle de menace décrit la cible ; chaque protection est marquée comme **en place**
> ou **prévue** avec l'étape du plan de développement qui la livre.

## Signaler une vulnérabilité

- Utilisez le **signalement privé de GitHub** :
  [Security → Report a vulnerability](https://github.com/Th-Denis/lueur/security/advisories/new).
  N'ouvrez pas d'issue publique.
- Indiquez la version ou le commit concerné, les étapes de reproduction et l'impact estimé.
- Nous accusons réception sous 7 jours et vous tenons informé jusqu'à la correction. Merci de ne
  pas divulguer la faille avant la publication du correctif, ou 90 jours au plus.
- Ne testez que sur votre propre compte, sans accéder aux données d'autrui ni dégrader le service.

Le fichier [`security.txt`](apps/web/public/.well-known/security.txt) (RFC 9116) reprend ces
informations ; un test de la CI échoue 30 jours avant son expiration pour rappeler de le renouveler.

## Ce qui est protégé

| Bien                                 | Objectif                                                             |
| ------------------------------------ | -------------------------------------------------------------------- |
| Photos, miniatures, légendes, titres | Confidentialité : seuls l'expéditeur et les destinataires les voient |
| Clés privées des utilisateurs        | Ne quittent jamais l'appareil en clair                               |
| Date de révélation                   | Aucune photo n'est livrée avant sa date, même au destinataire        |
| Authenticité d'une photo             | Le destinataire sait qui l'a envoyée et qu'elle n'a pas été modifiée |
| Comptes                              | Pas de prise de contrôle, pas d'énumération des comptes              |

## Contre qui

| Adversaire                           | Capacité supposée                                          |
| ------------------------------------ | ---------------------------------------------------------- |
| Le serveur et l'équipe technique     | Lisent toute la base et tout le stockage                   |
| Un attaquant réseau                  | Intercepte ou modifie le trafic                            |
| Un autre utilisateur                 | Possède un compte valide et appelle l'API directement      |
| Un destinataire impatient            | Veut voir une photo avant sa date                          |
| Un voleur d'appareil                 | Dispose de l'appareil déverrouillé ou non                  |
| Une dépendance ou un outil compromis | Code malveillant dans la chaîne d'approvisionnement        |
| Du code vulnérable généré par IA     | Faille introduite sans intention, non repérée en relecture |

## Comment

**Chiffrement de bout en bout** (prévu, étapes 2 à 5) — libsodium uniquement, dans
`packages/crypto` :

- clés X25519 (chiffrement) et Ed25519 (signature) générées sur l'appareil ;
- chaque photo chiffrée avec une clé aléatoire unique (XChaCha20-Poly1305, `secretstream`),
  enveloppée pour chaque destinataire (`sealed box`) et signée par l'expéditeur ;
- sauvegarde de la clé privée chiffrée avec une clé dérivée de la phrase de récupération
  (Argon2id) ;
- empreintes de sécurité comparables en personne, alerte si la clé d'un contact change.

**Verrouillage temporel côté serveur** (prévu, étape 6) — bucket privé ; fichier livré uniquement
par l'Edge Function de révélation, après `can_access_item`, avec l'horloge du serveur dans le
fuseau effectif du destinataire, via une URL signée de 60 secondes jamais journalisée.

**Base de données** (en place) :

- RLS imposée sur toute table par un test automatique ;
- **aucun droit par défaut** pour les rôles de l'API, y compris `TRUNCATE`, que Supabase accorde
  par défaut et qui n'est pas soumis à la RLS ([ADR 0006](docs/adr/0006-droits-par-defaut-et-retours-arriere.md)) ;
- schémas `private` et `audit` non exposés par l'API ; fonctions à `search_path` figé, sans
  `EXECUTE` implicite.

**Application web** (en place) — CSP stricte à nonce, sans `unsafe-inline` ni `unsafe-eval`, HSTS,
`X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy` restrictive, aucune
ressource tierce, pas de source map en production.

**Authentification** (configurée en local, livrée à l'étape 3) — jetons d'accès de 15 minutes
avec rotation des refresh tokens, mots de passe de 12 caractères minimum, email confirmé, MFA
TOTP, réponses identiques que le compte existe ou non ; vérification Have I Been Pwned (prévue).

**Chaîne d'approvisionnement et CI** (en place) — versions figées, aucune version de moins de
7 jours, sources exotiques interdites, actions épinglées par SHA, CodeQL, Semgrep, gitleaks,
zizmor, `pnpm audit`, dependency-review ([ADR 0002](docs/adr/0002-versions-et-chaine-approvisionnement.md),
[ADR 0005](docs/adr/0005-outils-securite-ci.md)).

**Développement agentique** (en place) — hooks Claude Code qui refusent l'accès aux fichiers de
secrets et demandent une confirmation humaine avant toute commande destructrice ; sous-agent de
relecture de sécurité en lecture seule ([.claude/README.md](.claude/README.md)).

## Limites assumées

- **Métadonnées visibles par le serveur** : qui envoie à qui, combien de photos, leurs dates de
  révélation, leur taille approximative et les horaires de connexion.
- **Date de création des identifiants** : les UUID v7 révèlent leur date de création à la
  milliseconde. Ils ne servent jamais de secret ni de jeton
  ([ADR 0003](docs/adr/0003-uuid-v7-fonction-sql.md)).
- **Le verrouillage temporel repose sur le serveur**, pas sur la cryptographie : un attaquant
  disposant à la fois du stockage chiffré et de la clé privée d'un destinataire peut déchiffrer en
  avance.
- **Serveur malveillant et clés publiques** : sans comparaison des empreintes, un serveur
  malveillant pourrait substituer une clé publique. La vérification des empreintes est proposée,
  pas imposée.
- **Perte de la phrase de récupération et de tous les appareils** : les photos sont définitivement
  perdues. C'est la contrepartie du chiffrement de bout en bout.
- **Appareil compromis** : un appareil déverrouillé ou infecté expose les photos déjà révélées.
- **Garde-fous des agents heuristiques** : l'analyse des commandes par les hooks évite les
  accidents mais ne résiste pas à un contournement volontaire.

## Réponse aux incidents

Procédure détaillée à rédiger avant la bêta (étape 8). Principes retenus :

1. Contenir : révoquer les jetons et clés concernés, couper l'accès en cause.
2. Évaluer l'impact, en s'appuyant sur `audit_log`.
3. Notifier la CNIL **sous 72 heures** en cas de violation de données personnelles, et les
   personnes concernées si le risque est élevé.
4. Corriger, publier un avis de sécurité et tirer les leçons (post-mortem sans recherche de
   coupable).
