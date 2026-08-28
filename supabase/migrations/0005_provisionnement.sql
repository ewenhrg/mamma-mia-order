-- =============================================================================
-- MAMMA MIA — POS : provisionnement fiable des comptes
-- A executer APRES 0004_zones_et_admin.sql.
--
-- Probleme corrige : un compte cree par le trigger arrive inactif, et c'est
-- la connexion qui l'active. Si cette activation echouait une seule fois
-- (reseau, cle de service absente), le compte restait bloque pour toujours,
-- sans aucun moyen de s'en sortir depuis l'application.
--
-- On distingue desormais explicitement :
--   provisioned_at IS NULL  -> le compte n'a jamais ete initialise : la
--                              prochaine connexion le fera, autant de fois
--                              qu'il le faudra.
--   provisioned_at renseigne -> le compte est etabli ; les choix faits dans
--                              Admin > Equipe font foi et ne sont plus
--                              ecrases par le fichier roster.ts.
-- =============================================================================

alter table public.staff add column if not exists provisioned_at timestamptz;

comment on column public.staff.provisioned_at is
  'Date de la premiere connexion reussie. Tant qu''elle est nulle, le role et '
  'l''activation sont repris du fichier src/lib/roster.ts a chaque connexion.';

-- Les comptes deja actifs sont consideres comme etablis : on ne veut pas que
-- roster.ts vienne reecrire par-dessus un role change a la main.
update public.staff
   set provisioned_at = coalesce(provisioned_at, created_at)
 where active and provisioned_at is null;
