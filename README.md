# Mamma Mia — POS de prise de commande

Prise de commande à table, pensée pour le téléphone du serveur.
Next.js 15 · React 19 · Tailwind v4 · Supabase (Postgres + Realtime + RLS).

---

## Démarrage

### 1. Créer le projet Supabase

Sur [supabase.com](https://supabase.com), crée un projet, puis va dans
**Project Settings › API** et récupère trois valeurs.

### 2. Renseigner `.env.local`

À la racine du projet, copie `.env.local.example` en `.env.local` :

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

> `SUPABASE_SERVICE_ROLE_KEY` est **secrète**. Elle ne quitte jamais le serveur
> et ne doit jamais être préfixée `NEXT_PUBLIC_`.

### 3. Exécuter les migrations

Dans **SQL Editor**, colle et exécute les fichiers de `supabase/migrations/`
**dans l'ordre**, un par un :

| Fichier | Contenu |
|---|---|
| `0001_init.sql` | Schéma, RLS, envoi de commande idempotent |
| `0002_seed.sql` | 24 tables, catégories, options, menu de démonstration |
| `0003_encaissement.sql` | Encaissement qui ne libère pas la table |
| `0004_zones_et_admin.sql` | Zones modifiables, suppressions, libération forcée |

### 4. Lancer

```bash
npm install
npm run dev
```

Ouvre `http://localhost:3000`, tape ton prénom, c'est parti.

---

## Connexion

Pas de mot de passe : le serveur **tape son prénom** et entre.

L'équipe est définie dans [`src/lib/roster.ts`](src/lib/roster.ts) :

| Prénom | Rôle |
|---|---|
| Ewen, Ramy, Ismail | admin |
| Caisse | manager |
| Ayline, Riyad, Emir | serveur |

Ajouter quelqu'un = ajouter une ligne dans ce fichier. Son compte technique est
créé automatiquement à sa première connexion.

Les rôles peuvent ensuite être changés dans **Admin › Équipe** — ce choix-là
prime sur le fichier.

| Rôle | Peut faire |
|---|---|
| serveur | prendre les commandes, encaisser, libérer une table payée |
| manager | + menu, tables, zones, remises, annuler une ligne envoyée, libérer de force |
| admin | + changer les rôles de l'équipe |

> **À savoir** : sans mot de passe, toute personne qui atteint l'URL peut
> choisir n'importe quel prénom, y compris un compte admin. C'est le choix
> assumé pour aller vite en service. Si tu veux durcir ça plus tard, le point
> d'entrée unique est `signInAs` dans `src/app/login/actions.ts`.

---

## Le parcours du serveur

```
SALLE  →  TABLE  →  CATÉGORIE  →  PRODUIT  →  PANIER  →  ENVOYER
```

- **Un tap sur un produit = un ajout.** Pas de confirmation, pas d'écran
  intermédiaire. Les produits à options ouvrent un panneau ; un appui long
  l'ouvre aussi pour les autres.
- **Taper 5 fois le même produit** donne une seule ligne ×5, jamais 5 lignes.
- **Le panier est toujours visible** en bas de l'écran, avec le nombre
  d'articles et le total.
- **La dernière catégorie utilisée est conservée** d'une table à l'autre, et un
  onglet « Récents » remonte les produits les plus commandés du service.

### États d'une table

| | État | Signification |
|---|---|---|
| 🟢 | **LIBRE** | aucune commande ouverte |
| 🟠 | **EN COURS** | commande ouverte, non encaissée |
| 🔴 | **OCCUPÉE** | ouverte depuis plus de 90 min |
| 🟢 | **ENCAISSÉE** | payée, **table toujours occupée** |
| 🔴 | **RESTE À PAYER** | articles ajoutés après l'encaissement |
| ⚫ | badge noir | panier commencé sur ce téléphone, pas encore envoyé |

### Encaisser ≠ libérer

Ce sont deux gestes séparés, volontairement :

- **Encaisser** enregistre le paiement. La table **reste ouverte** — le client
  peut recommander, et le reste à payer apparaît tout seul.
- **Libérer la table** est un second geste explicite. Il refuse de s'exécuter
  s'il reste quelque chose à payer. Un manager peut forcer si besoin.

---

## Administration (managers et admins)

**Admin › Menu**
- Catégories : créer, renommer, recolorer, réordonner, désactiver, supprimer
- Produits : créer, modifier le prix, rattacher des groupes d'options,
  basculer « disponible » (rupture du jour), archiver, supprimer
- Options : groupes réutilisables (cuisson, suppléments, sauce…), choix
  unique ou multiple, obligatoire ou non

**Admin › Tables**
- Tables : une par une ou en série (« B 1 » à « B 20 » d'un coup), modifier,
  désactiver, supprimer
- Zones : créer, renommer, recolorer, supprimer — la salle s'adapte seule

**Admin › Équipe**
- Activer/désactiver un compte, changer les rôles

Les suppressions refusent proprement quand elles détruiraient un historique :
une table qui a reçu des commandes, une catégorie qui contient des produits,
une zone qui contient des tables. Le message dit quoi faire à la place.

---

## Ce qui protège les commandes

### Jamais de double envoi

Chaque envoi porte un `client_request_id` généré une seule fois. La fonction
`pos_submit_order` est idempotente sur cette clé : un double-tap, un retry
réseau ou un rechargement rejouent la même clé et la base renvoie le résultat
d'origine **sans rien réinsérer**.

Trois verrous en cascade, du plus local au plus sûr :

1. un verrou synchrone côté client (deux événements dans le même tick) ;
2. le panier est vidé immédiatement, le bouton se désactive ;
3. la base refuse le doublon, quoi qu'il arrive.

### Jamais deux commandes sur une table

Un index unique partiel Postgres :

```sql
create unique index orders_one_open_per_table
  on orders (table_id) where status = 'open';
```

Ce n'est pas une règle applicative qu'on peut contourner : la base rend la
situation structurellement impossible.

### Jamais de commande perdue

Le panier est écrit dans le téléphone à chaque frappe. À l'envoi, la commande
part dans une file durable (`localStorage`) **avant** tout appel réseau, et
n'en sort qu'après confirmation de la base. Coupure réseau, téléphone en
veille, onglet fermé : la file repart toute seule au retour du réseau, avec un
délai qui double à chaque tentative.

Une erreur définitive (produit retiré du menu, session expirée) s'affiche en
haut de l'écran avec **Réessayer** et **Abandonner** — jamais un abandon
silencieux.

### Les prix ne viennent jamais du téléphone

Le client envoie **uniquement** des identifiants et des quantités. La fonction
`pos_submit_order` relit tous les prix en base et recalcule les totaux. Une
option qu'on essaierait de forcer sur un produit auquel elle n'appartient pas
est purement ignorée.

Les commandes sont en **lecture seule** depuis le navigateur : aucune policy
RLS n'autorise `insert`/`update`/`delete` sur `orders` et `order_items`. Le
seul chemin d'écriture passe par les fonctions `SECURITY DEFINER`.

### Plusieurs serveurs en même temps

Supabase Realtime pousse les changements de salle à tous les téléphones. Un
rafraîchissement périodique prend le relais si le socket tombe. Côté base, les
envois concurrents sur une même table sont sérialisés par un verrou de ligne.

---

## Architecture

```
src/
├── app/
│   ├── page.tsx                  salle (grille des tables)
│   ├── table/[tableId]/page.tsx  écran de commande
│   ├── login/                    connexion par prénom (server action)
│   └── admin/                    menu · tables · équipe
├── components/
│   ├── pos/                      TableCard, OrderScreen, CartSheet,
│   │                             ProductCard, ProductOptionsSheet, OutboxBanner
│   ├── admin/                    MenuAdmin, TablesAdmin, StaffAdmin + panneaux
│   └── ui/                       Sheet, Spinner
└── lib/
    ├── cart.ts                   réducteur de panier (fusion, quantités)
    ├── outbox.ts                 file d'envoi durable + idempotence
    ├── menu.ts / useMenu         menu dénormalisé, cache local
    ├── useTables.ts / useOrder   état de salle et de commande + Realtime
    ├── roster.ts                 l'équipe
    └── supabase/                 clients navigateur et serveur
```

## Commandes

```bash
npm run dev        # développement
npm run build      # build de production
npm run start      # servir le build
npm run typecheck  # TypeScript
npm run lint       # ESLint
```

## Mettre le vrai menu

Le seed installe un menu de démonstration pour que tout soit testable tout de
suite. Pour le vrai menu, deux options :

1. **Depuis le site** — Admin › Menu, catégorie par catégorie. Les prix se
   saisissent normalement (`120` ou `120.50`), la conversion est automatique.
2. **En SQL** — remplace la section 4 de `0002_seed.sql` par tes produits.

Pour repartir du menu de démonstration :

```sql
delete from products;
delete from categories;
```
