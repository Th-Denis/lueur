# 0003. UUID v7 générés par une fonction SQL

- Statut : accepté
- Date : 2026-11-26

## Contexte

Le CLAUDE.md impose des clés primaires UUID v7 : ordonnées dans le temps, elles gardent les index
B-tree compacts, contrairement aux UUID v4 aléatoires. La fonction native `uuidv7()` n'existe qu'à
partir de Postgres 18, or Supabase Cloud et Scaleway (base managée, vérifié avec
`scw rdb engine list`) proposent au plus Postgres 17.

## Décision

- Fonction `private.uuid_generate_v7()` en SQL pur (RFC 9562, section 5.7) : un UUID v4 de
  `gen_random_uuid()` dont les 48 premiers bits sont remplacés par l'horodatage Unix en
  millisecondes (`clock_timestamp()`), et la version passée de 4 à 7.
- Valeur par défaut de toute colonne `id`, vérifiée par un garde-fou pgTAP.
- Générée en base, jamais par le client : le serveur reste maître des identifiants.

## Alternatives écartées

- **Extension `pg_uuidv7`** : non disponible sur toutes les cibles d'hébergement.
- **Génération côté client** : un client pourrait choisir ses identifiants (collision volontaire,
  antidatage).
- **UUID v4** : index fragmentés et aucun ordre naturel.

## Conséquences

- **Fuite assumée** : un UUID v7 révèle sa date de création à la milliseconde. Les identifiants
  ne doivent donc jamais servir de secret ni de jeton (documenté dans SECURITY.md).
- Deux UUID générés dans la même milliseconde ne sont pas ordonnés entre eux.
- À remplacer par `uuidv7()` natif quand Postgres 18 sera disponible sur toutes les cibles : la
  migration consistera à changer la valeur par défaut des colonnes, sans toucher aux données.
