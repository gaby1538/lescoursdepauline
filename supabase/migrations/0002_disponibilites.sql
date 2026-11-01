-- =====================================================================
--  Disponibilités de départ : 10 h – 12 h et 14 h – 21 h, tous les jours.
--  Pauline les modifiera depuis l'administration ; ce fichier ne sert
--  qu'à ne pas démarrer avec un calendrier vide.
-- =====================================================================

insert into disponibilites (jour_semaine, heure_debut, heure_fin)
select jour, plage.debut, plage.fin
from generate_series(1, 7) as jour,
     (values (time '10:00', time '12:00'),
             (time '14:00', time '21:00')) as plage(debut, fin);
