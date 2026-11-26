# Specs – Calendrier photos chiffré de bout en bout

## 1. Vision

Application web et mobile permettant à un utilisateur de programmer des photos destinées à un ou plusieurs autres utilisateurs, chacune révélée à une date précise. Cas d'usage phare : un calendrier de l'Avent (une photo par jour du 1er au 25 décembre) offert à ses grands-parents. Les photos sont chiffrées de bout en bout : ni le serveur ni l'équipe technique ne peuvent les voir.

Le projet est entièrement développé avec Claude Code, mais doit atteindre une qualité de production : sécurité avancée, tests, CI, observabilité, documentation.

## 2. Périmètre

### V1 (test entre amis)

- Comptes utilisateurs (inscription, connexion, gestion des appareils).
- Création d'un « calendrier » : titre, destinataires, liste de cases datées.
- Ajout d'une photo par case (une ou plusieurs photos par date possibles).
- Invitation de destinataires ayant un compte (par email ou pseudo).
- Révélation : la photo n'est téléchargeable qu'à partir de sa date.
- Vue destinataire : calendrier avec cases verrouillées / ouvertes, animation d'ouverture.
- Notifications push et email le jour d'une révélation.

### Hors V1, mais architecture prévue dès maintenant

- Publications publiques révélées à une date pour tous les abonnés d'un auteur.
- Système d'abonnés, profils publics, modération.

## 3. Stack technique

Choix guidés par trois critères : très bien supporté par Claude Code, très documenté et facile à reprendre par un développeur, robuste.

- **Langage unique** : TypeScript strict partout.
- **Monorepo** : pnpm workspaces + Turborepo.
  - `apps/mobile` : React Native avec Expo (iOS et Android), Expo Router.
  - `apps/web` : Next.js (App Router).
  - `packages/crypto` : toute la cryptographie, partagée web et mobile.
  - `packages/core` : types, schémas de validation (Zod), client API.
  - `packages/ui` : composants partagés si pertinent.
- **Backend** : Supabase (Postgres managé, Auth, Storage, Edge Functions). Très documenté, open source, auto-hébergeable si besoin.
- **Sécurité des données** : Row Level Security Postgres activée sur toutes les tables.
- **Notifications** : Expo Push Notifications + emails via Scaleway Transactional Email.
- **Tests** : Vitest (unitaires), Playwright (web end-to-end), Maestro (mobile end-to-end).
- **CI/CD** : GitHub Actions ; builds mobiles via EAS ; web sur Scaleway Serverless Containers.
- **Observabilité** : Sentry (sans jamais envoyer de contenu ni de clé).

### Design system partagé

- **`packages/design-tokens`** : source unique des couleurs, typographies, espacements, rayons, ombres et durées d'animation, en TypeScript. Les thèmes de calendrier (base minimaliste + thèmes nostalgique ou festif) sont des jeux de tokens.
- **Styles** : Tailwind CSS sur le web, NativeWind sur mobile, alimentés par une configuration Tailwind commune générée depuis les tokens. Les mêmes classes s'écrivent des deux côtés.
- **Composants** : `packages/ui-web` et `packages/ui-native` exposent les mêmes noms et les mêmes props (Button, Card, CalendarCell, PhotoViewer…), avec une implémentation propre à chaque plateforme. La logique (états, formatage des dates) vit dans des hooks partagés.
- **Accessibilité** : contrastes AA minimum, tailles de texte adaptables (important pour les seniors), navigation clavier et lecteurs d'écran.
- **Catalogue** : Storybook pour visualiser et tester les composants.
- Alternative écartée : Tamagui (composants communs web et natif), plus puissant mais moins standard et plus difficile à reprendre pour un développeur externe.

### Hébergement (décision retenue)

Tout est hébergé dans l'Union européenne, avec Scaleway comme cible finale.

| Phase | Backend | Site web | Coût estimé |
| --- | --- | --- | --- |
| Bêta entre amis | Supabase Cloud, région UE | Scaleway Serverless Containers | Quelques euros par mois |
| Après la bêta | Supabase auto-hébergé sur Scaleway (Postgres managé, Object Storage, instance pour les services Supabase) | Scaleway Serverless Containers | Environ 30 à 40 € par mois, 60 à 100 € avec haute disponibilité |

Estimations à confirmer avec les calculateurs officiels. Comptes développeur Apple et Google en plus pour la phase mobile.

**Règles pour garantir une migration facile :**

- Tout le schéma, les politiques RLS et les fonctions en migrations versionnées ; aucune modification manuelle dans le tableau de bord.
- Aucune fonctionnalité propre à Supabase Cloud indisponible en auto-hébergement.
- Infrastructure Scaleway décrite en Terraform dès la bêta.
- Accès au stockage uniquement via une couche d'abstraction (`packages/core`), pour changer de fournisseur S3 sans toucher au reste.
- Procédure de migration écrite et répétée sur un environnement de test : dump et restauration Postgres, copie des fichiers chiffrés, bascule DNS. Les utilisateurs devront se reconnecter une fois.

## 4. Modèle de chiffrement

### Principes

- Chiffrement de bout en bout : les photos sont chiffrées sur l'appareil de l'expéditeur et déchiffrées uniquement sur celui du destinataire.
- Le serveur ne stocke que des données chiffrées et ne détient jamais de clé privée ni de clé de photo en clair.
- La protection temporelle est assurée par le serveur : il refuse de livrer le fichier chiffré avant sa date de révélation. Pas de chiffrement temporel.

### Bibliothèque

libsodium (`libsodium-wrappers-sumo` sur le web, `react-native-libsodium` sur mobile), encapsulée dans `packages/crypto`. Aucune primitive cryptographique maison.

### Clés utilisateur

- À l'inscription, chaque utilisateur génère sur son appareil une paire de clés X25519 (chiffrement) et une paire Ed25519 (signature).
- Les clés publiques sont publiées sur le serveur.
- La clé privée est stockée dans le stockage sécurisé de l'appareil (Keychain iOS, Keystore Android, IndexedDB non exportable sur le web).
- Sauvegarde et multi-appareils : la clé privée est chiffrée avec une clé dérivée d'une phrase de récupération choisie par l'utilisateur (Argon2id), puis stockée sur le serveur. Sans cette phrase, le serveur ne peut rien en faire.
- Perte de la phrase et de tous les appareils : les anciennes photos sont perdues. Ce comportement est assumé et expliqué clairement à l'utilisateur.

### Chiffrement d'une photo

1. L'appareil supprime les métadonnées EXIF (localisation notamment) et redimensionne l'image.
2. Une clé symétrique aléatoire unique est générée pour la photo.
3. La photo est chiffrée avec XChaCha20-Poly1305 (mode secretstream pour les gros fichiers).
4. La clé de la photo est « enveloppée » pour chaque destinataire avec sa clé publique (sealed box), ainsi que pour l'expéditeur.
5. L'expéditeur signe l'ensemble avec sa clé Ed25519 pour garantir l'authenticité.
6. Le fichier chiffré est envoyé dans le Storage ; les clés enveloppées sont stockées en base.

### Vérification des clés

- Chaque contact affiche une empreinte de sécurité (code court ou QR) comparable en personne, pour empêcher un serveur malveillant de substituer une clé publique.
- Alerte visible si la clé d'un contact change.

## 5. Verrouillage temporel côté serveur

- Chaque photo possède une date de révélation (`reveal_local`, en heure locale sans fuseau, interprétée dans le fuseau du destinataire : voir « Fuseaux horaires » ci-dessous).
- Le bucket Storage est privé : aucun accès direct possible.
- Le téléchargement passe obligatoirement par une Edge Function qui vérifie : utilisateur authentifié, utilisateur destinataire de la photo, et `now()` côté serveur, converti dans le fuseau effectif du destinataire, supérieur ou égal à `reveal_local`.
- Si tout est valide, elle renvoie une URL signée à durée de vie courte (60 secondes).
- Les politiques RLS empêchent aussi de lire les métadonnées sensibles et les clés enveloppées avant la date.
- L'heure de l'appareil n'est jamais utilisée pour décider d'un accès.
- L'application ne précharge jamais une photo non révélée.
- Limite assumée : un attaquant disposant à la fois du stockage chiffré et de la clé privée d'un destinataire pourrait déchiffrer en avance.

### Fuseaux horaires (règle retenue)

L'utilisateur ne gère jamais de fuseau : une case s'ouvre à l'heure locale du destinataire, où qu'il soit.

- **Date de révélation « flottante »** : `items.reveal_local` en `timestamp without time zone` (ex. 2026-12-01 00:00), sans fuseau.
- **Fuseau par utilisateur** : `profiles.timezone` (identifiant IANA, ex. Europe/Paris), détecté automatiquement depuis l'appareil, validé contre la liste IANA.
- **Décision d'accès** : `can_access_item` vérifie `(now() AT TIME ZONE fuseau_effectif_du_destinataire) >= reveal_local`, toujours avec l'horloge du serveur.
- **Anti-triche** : un changement de fuseau ne prend effet qu'après 24 heures. Champs `timezone_pending` et `timezone_effective_at` ; tant que le délai court, l'ancien fuseau s'applique. Chaque changement est journalisé dans `audit_log`.
- **Notifications** : planifiées par destinataire selon son fuseau effectif.
- **Publications publiques futures** : chaque abonné voit la case s'ouvrir à minuit chez lui, par la même règle.
- **Tests obligatoires** : fuseaux extrêmes (UTC+14, UTC−12), passage heure d'été / heure d'hiver, changement de fuseau avant et après le délai de 24 heures.

### Modification et retrait d'une photo (règle retenue)

- L'expéditeur peut remplacer ou retirer une photo tant que sa case n'est ouverte pour aucun destinataire. Une fois ouverte, elle est figée.
- « Ouverte » s'évalue avec le fuseau effectif le plus en avance parmi les destinataires.
- Un remplacement crée un nouveau fichier chiffré avec une nouvelle clé ; l'ancien fichier et ses clés enveloppées sont purgés du Storage et de la base.
- Règle imposée côté serveur (RLS et fonction dédiée), pas seulement dans l'interface, et couverte par des tests.
- Chaque remplacement ou retrait est journalisé dans `audit_log`.

### Formats de médias (règle retenue)

- V1 : photos uniquement, en JPEG, PNG et HEIC.
- Traitement sur l'appareil avant chiffrement : conversion en JPEG (ou WebP), suppression des métadonnées EXIF, redimensionnement (2 048 px sur le plus grand côté) et miniature chiffrée séparément.
- Le type réel du fichier est vérifié (signature binaire), pas seulement son extension. Taille maximale avant traitement : 25 Mo.
- Anticipation : colonne `media_type` (enum, valeur unique `photo` en V1) pour ajouter vidéo et message vocal plus tard sans migration lourde. Le chiffrement en flux (secretstream) supporte déjà les gros fichiers.

## 6. Modèle de données (Postgres)

| Table | Rôle | Champs principaux |
| --- | --- | --- |
| profiles | Profil public minimal | id, pseudo, avatar_chiffré, timezone, timezone_pending, timezone_effective_at, account_type (personnel par défaut), created_at |
| user_keys | Clés publiques et sauvegarde chiffrée | user_id, enc_public_key, sign_public_key, encrypted_private_key_backup, kdf_params |
| devices | Appareils et jetons push | id, user_id, push_token, last_seen |
| contacts | Relations entre utilisateurs | owner_id, contact_id, status, verified_fingerprint |
| calendars | Un calendrier offert | id, owner_id, titre_chiffré, visibility (private / public, public réservé à plus tard) |
| calendar_recipients | Destinataires d'un calendrier | calendar_id, recipient_id |
| items | Une photo programmée | id, calendar_id, reveal_local, media_type, audience_type, storage_path, signature, created_at |
| item_keys | Clé de photo enveloppée par destinataire | item_id, recipient_id, wrapped_key |
| audit_log | Journal de sécurité | actor_id, action, target, ip_hash, created_at |

- Les titres et légendes sont aussi chiffrés : le serveur ne connaît que les dates et les identifiants.
- Le champ `visibility` et une future table `followers` permettront les publications publiques sans migration lourde.
- Toutes les migrations sont versionnées (Supabase CLI) et revues.

## 7. Sécurité applicative

- **Authentification** : email + mot de passe ou lien magique, MFA (TOTP) proposée, passkeys en V2.
- **Sessions** : jetons courts avec rotation des refresh tokens, déconnexion à distance d'un appareil.
- **Autorisations** : RLS sur chaque table, testée automatiquement ; aucune clé `service_role` côté client.
- **Validation** : toutes les entrées validées par Zod côté client et côté serveur.
- **Limitation de débit** : sur la connexion, l'inscription, les invitations et les téléchargements.
- **Fichiers** : taille maximale, types autorisés vérifiés avant chiffrement, noms de fichiers aléatoires.
- **Web** : Content Security Policy stricte, HSTS, cookies sécurisés, protection CSRF, aucune dépendance chargée depuis un CDN tiers.
- **Mobile** : pas de capture des photos déchiffrées dans les logs, cache déchiffré en mémoire uniquement, verrouillage optionnel par biométrie.
- **Secrets** : jamais dans le dépôt, gestion via les variables d'environnement de la CI et de Supabase.
- **Dépendances** : Dependabot, `pnpm audit` et analyse CodeQL dans la CI.
- **Modèle de menace** : document `SECURITY.md` décrivant ce qui est protégé, contre qui, et les limites assumées.
- **RGPD** : export et suppression complète du compte, hébergement en Union européenne.

## 7 bis. Sécurité : compléments et garde-fous contre le vibe coding

Un code généré par IA a les mêmes failles qu'un code humain, en plus nombreuses s'il n'est pas contrôlé. La sécurité repose donc sur des vérifications automatiques et des revues, pas sur la confiance.

### Référentiels

- OWASP ASVS niveau 2 pour le web et l'API, OWASP MASVS pour le mobile, OWASP Top 10 comme liste de contrôle à chaque PR.

### Vérifications automatiques en CI (bloquantes)

- Analyse statique : CodeQL et Semgrep (règles OWASP et TypeScript).
- Détection de secrets : gitleaks sur chaque commit et dans l'historique.
- Dépendances : `pnpm audit`, Dependabot, lockfile obligatoire, versions figées, GitHub Actions épinglées par hash.
- Tests RLS automatisés : pour chaque table, un utilisateur ne peut ni lire ni modifier les données d'un autre.
- Tests d'autorisation de l'API : chaque route testée sans session, avec un autre utilisateur, avant et après `reveal_local` (protection contre les IDOR).
- Scan dynamique OWASP ZAP sur l'environnement de préproduction.

### Fuites de données à éviter

- Notifications push et emails : jamais de contenu, de légende ni d'aperçu, seulement « Une nouvelle case est ouverte ».
- URL signées : jamais loguées, jamais transmises à un service tiers.
- Pas d'énumération de comptes : réponses identiques à l'inscription, la connexion et l'invitation, que le compte existe ou non.
- Métadonnées : le serveur connaît les dates et qui envoie à qui. C'est assumé et documenté dans SECURITY.md.
- Captures d'écran : option pour les bloquer sur Android (FLAG_SECURE), détection sur iOS.

### Comptes et récupération

- Mots de passe vérifiés contre les fuites connues (Have I Been Pwned, mode k-anonymité).
- Changement d'email, de mot de passe ou ajout d'appareil : confirmation par email et notification sur les autres appareils.
- Ajout d'un nouvel appareil : validation depuis un appareil existant ou via la phrase de récupération.
- Verrouillage progressif après échecs de connexion.

### Infrastructure

- Environnements séparés : local, préproduction, production, sans données réelles hors production.
- Sauvegardes chiffrées quotidiennes de la base, restauration testée régulièrement.
- Accès à la production limité et protégé par MFA, journalisé.
- Alertes sur comportements anormaux : pics de téléchargements, d'échecs de connexion, de refus d'accès avant date.

### Revues humaines

- Revue de sécurité dédiée à chaque PR touchant la crypto, l'authentification, les RLS ou l'Edge Function de révélation.
- Avant toute ouverture publique : audit de sécurité et test d'intrusion par un prestataire externe.
- Procédure de réponse aux incidents documentée (qui prévenir, comment révoquer, notification CNIL sous 72 h).
- Fichier `security.txt` et adresse de signalement des vulnérabilités.

## 8. Règles de qualité pour Claude Code

- Le fichier `CLAUDE.md` à la racine reprend les règles essentielles, les conventions et les commandes du projet.
- TypeScript strict, ESLint, Prettier ; aucun `any` non justifié.
- Chaque fonctionnalité : tests unitaires + au moins un test end-to-end avant d'être considérée terminée.
- `packages/crypto` : couverture de tests proche de 100 %, vecteurs de test connus, tests d'interopérabilité web et mobile.
- Tests dédiés au verrouillage temporel : accès refusé avant la date, autorisé après, refusé pour un non-destinataire.
- Petites étapes : une fonctionnalité par branche et par pull request, CI verte obligatoire.
- Claude Code ne modifie jamais la cryptographie ou les politiques RLS sans le signaler explicitement dans la PR.
- Documentation tenue à jour : README, ARCHITECTURE.md, SECURITY.md, guide d'installation locale.

## 8 bis. Architecture des données et documentation du code

### Architecture des données

- **Schéma normalisé (3NF)** : une seule source de vérité par information, aucune duplication non justifiée et documentée.
- **Contraintes en base, pas seulement dans le code** : clés étrangères avec règles ON DELETE explicites, NOT NULL, CHECK (ex. `reveal_local` dans une plage valide), contraintes d'unicité.
- **Identifiants** : UUID v7 (ordonnés dans le temps) pour toutes les clés primaires.
- **Temps** : toutes les dates techniques en `timestamptz` UTC (seule exception : `reveal_local`) ; colonnes `created_at`, `updated_at` gérées par triggers.
- **Types forts** : enums Postgres pour les statuts, domaines pour les valeurs contraintes.
- **Index réfléchis** : chaque index justifié par une requête réelle (ex. index sur `(recipient_id, reveal_local)`), plans d'exécution vérifiés.
- **Séparation des schémas Postgres** : `public` (exposé via RLS), `private` (fonctions et données internes), `audit`.
- **Suppression** : suppression logique pour les calendriers, purge définitive planifiée des fichiers et clés pour respecter le RGPD.
- **Stockage des fichiers** : arborescence déterministe `{calendar_id}/{item_id}.bin`, aucun nom ou métadonnée lisible, cohérence base / Storage vérifiée par un job de réconciliation (fichiers orphelins).
- **Traitements** : toute logique métier critique dans des fonctions Postgres ou Edge Functions idempotentes, transactions explicites, file d'attente (pgmq) pour les notifications.
- **Documentation du schéma** : `COMMENT ON` sur chaque table et colonne, diagramme entité-relation généré automatiquement et versionné, dictionnaire de données dans `docs/DATA_MODEL.md`.
- **Migrations** : uniquement additives quand c'est possible, réversibles, testées sur une copie de la base en CI.

### Code et documentation

- **Architecture en couches** : domaine (règles métier pures), application (cas d'usage), infrastructure (Supabase, stockage, push), interface. Le domaine ne dépend d'aucune librairie externe.
- **Commentaires abondants et verbeux** : chaque fichier commence par un en-tête expliquant son rôle ; chaque fonction exportée a une JSDoc complète (but, paramètres, retour, erreurs, exemple) ; chaque choix non évident est expliqué par un commentaire « pourquoi ».
- **Code crypto** : commenté ligne à ligne, avec référence à la documentation libsodium.
- **Nommage explicite** plutôt que court ; fonctions courtes à responsabilité unique.
- **Gestion d'erreurs typée** : erreurs métier nommées, jamais d'erreur avalée silencieusement.
- **Décisions d'architecture** : chaque choix structurant consigné dans un ADR (`docs/adr/`).
- **Documentation générée** : TypeDoc pour les packages, publiée en CI.
- **Tests lisibles** : chaque test décrit un comportement en français clair, structure Arrange / Act / Assert.

## 8 ter. Évolutions anticipées : publications publiques et monétisation

Aucune de ces tables n'est créée en V1. Le schéma V1 est conçu pour qu'elles s'ajoutent par migrations additives, sans casser l'existant.

### Modèle visé

Abonnements à des créateurs, dans l'esprit des plateformes de contenu payant, avec le calendrier de déblocage comme signature : un créateur programme des contenus révélés à date pour ses abonnés payants, et peut vendre des calendriers à l'unité (ex. un calendrier de l'Avent premium).

### Préparations dès la V1

- **Notion d'audience générique** : un item n'est pas lié directement à des destinataires mais à une audience (`audience_type` : direct, abonnés, acheteurs, public). En V1 seul `direct` est utilisé.
- **Rôles** : champ `account_type` (personnel / créateur) prévu dans `profiles`, valeur par défaut personnel.
- **Droits d'accès centralisés** : une seule fonction Postgres `can_access_item(user, item)` décide de l'accès. Demain elle intégrera abonnement actif ou achat, sans toucher au reste.
- **Chiffrement par audience** : pour un grand nombre d'abonnés, la clé de chaque photo est enveloppée avec une clé d'audience (une par créateur et par période), elle-même distribuée aux abonnés actifs. Rotation de la clé à chaque désabonnement pour les contenus futurs.
- **Montants** : toujours en entiers (centimes) avec code devise ISO, jamais en flottants.

### Tables futures (esquisse)

| Table | Rôle |
| --- | --- |
| creator_profiles | Infos créateur, statut de vérification, compte de paiement Stripe Connect |
| subscription_plans | Offres d'abonnement d'un créateur (prix, périodicité) |
| subscriptions | Abonnement d'un utilisateur, statut, période en cours |
| products | Calendriers vendus à l'unité |
| purchases | Achats à l'unité |
| audience_keys | Clés d'audience enveloppées par abonné |
| payouts | Reversements aux créateurs |
| ledger_entries | Grand livre comptable en double entrée, immuable, source de vérité financière |
| reports | Signalements de contenus et de comptes |

- **Paiements** : Stripe Billing et Stripe Connect ; webhooks idempotents, état réconcilié avec Stripe par un job quotidien.

### Points d'attention à trancher avant la monétisation

- **Chiffrement contre modération** : une plateforme publique et payante a des obligations légales de modération (Digital Services Act, retrait de contenus illicites). Le chiffrement de bout en bout empêche toute modération côté serveur. Piste : garder le bout en bout pour les envois privés, et un mode « contenu créateur » chiffré au repos mais modérable.
- **Contenus pour adultes** : si la plateforme les autorise, vérification d'âge et d'identité des créateurs et des acheteurs obligatoire, et Stripe les refuse : il faudrait un prestataire de paiement spécialisé.
- **Fiscalité et statut** : TVA sur services numériques, obligations de déclaration des revenus des créateurs (DAC7). À valider avec un expert-comptable ou un avocat.

## 9. Plan de développement

Stratégie : web responsive d'abord, mobile ensuite. Le monorepo et les packages partagés (`crypto`, `core`) existent dès le départ pour que le mobile réutilise tout sans réécriture.

1. Mise en place du monorepo, de la CI de sécurité, du projet Supabase et du fichier `CLAUDE.md`. Squelette `apps/mobile` minimal créé mais non développé.
2. Package `packages/crypto` avec ses tests, plus une preuve de compatibilité : la même suite de tests exécutée dans le navigateur et dans une app Expo minimale.
3. Authentification web, génération des clés, phrase de récupération, gestion des appareils.
4. Contacts, invitations et vérification des empreintes.
5. Création de calendrier et envoi de photos chiffrées (web responsive).
6. Edge Function de révélation et URL signées, avec ses tests de sécurité.
7. Vue destinataire, animation d'ouverture, notifications email et web push.
8. Durcissement : revue de sécurité, scan ZAP, tests de charge, audit des dépendances.
9. Bêta privée web avec les amis.
10. Application mobile Expo réutilisant `crypto` et `core` : stockage sécurisé des clés natif, notifications push, publication sur les stores.
11. Préparation des publications publiques, puis éventuellement de la monétisation.

## 10. Pistes de design (à choisir)

| Critère | A. Chaleureux et nostalgique | B. Minimal et premium | C. Ludique et festif |
| --- | --- | --- | --- |
| Ambiance | Cadeau fait main, album de famille | Galerie d'art, élégance discrète | Fête, surprise, partage entre amis |
| Palette | Crème #F6EFE3, kraft #C9A27E, rouge sapin #9E2A2B, vert #2F5D50 | Blanc #FFFFFF, gris pierre #E7E5E1, encre #111111, accent or #B8935A | Violet #6C3BFF, rose #FF4F8B, jaune #FFD23F, fond nuit #1B1236 |
| Typographie | Titres Fraunces (serif ronde), texte Nunito | Titres Playfair Display, texte Inter | Titres Baloo 2 (arrondie, grasse), texte Inter |
| Grille du calendrier | Cases en carton avec numéros manuscrits, légère texture papier | Grille fine et aérée, numéros discrets, photo floue en fond de case | Cases de tailles variées façon mosaïque, numéros géants |
| Case verrouillée | Petite porte fermée avec un ruban et un cadenas dessiné | Case grise avec la date et un compte à rebours sobre | Case colorée qui tremble légèrement le jour J |
| Ouverture | On glisse le doigt pour ouvrir la porte, son de papier, la photo apparaît en Polaroid | Fondu lent, la photo passe en plein écran avec sa légende | Surface à gratter au doigt, puis explosion de confettis |
| Écran d'envoi | Album à remplir case par case, glisser-déposer des photos | Timeline verticale par date, épurée | Tableau de jeu avec progression « 18 cases sur 25 remplies » |
| Public idéal | Famille, grands-parents | Couples, créateurs, future version payante | Groupes d'amis, anniversaires |
| Atouts | Très émotionnel, lisible pour les seniors (grandes tailles) | Intemporel, évolue bien vers la monétisation | Viral, très mémorable |
| Limites | Peut sembler saisonnier, moins adapté aux créateurs | Moins de surprise et de féerie | Fatigue vite, moins sérieux pour du payant |

Piste hybride envisagée : la base B (structure, typographie, navigation) avec des thèmes de calendrier interchangeables inspirés de A et C, choisis par l'expéditeur pour chaque calendrier. Décision à prendre après les maquettes.

## Documents liés

- `CLAUDE.md` (racine) : règles opérationnelles pour Claude Code.
- `docs/legal/PRIVACY.md` : politique de confidentialité (bêta).
- `docs/legal/TERMS.md` : conditions générales d'utilisation (bêta).
