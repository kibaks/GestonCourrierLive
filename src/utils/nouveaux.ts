// P8 — Badges « nouveaux courriers » : un courrier est « nouveau » si sa date de
// création est postérieure à la dernière visite de la liste par cet utilisateur
// (traçage localStorage, zéro backend). Premier passage : référence = maintenant
// → les badges n'apparaissent qu'après une visite, pour les courriers créés
// ENTRE deux visites.
const KEY = 'sigc_last_liste_courriers';

export const getLastListeVisit = (): number => {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) {
      // Premier passage : référence = maintenant → aucun badge au tout premier
      // affichage (les badges n'apparaissent qu'après une visite, pour les
      // courriers créés ENTRE deux visites).
      const now = Date.now();
      window.localStorage.setItem(KEY, String(now));
      return now;
    }
    const v = Number(raw);
    return Number.isFinite(v) && v > 0 ? v : Date.now();
  } catch {
    return Date.now();
  }
};

/** À appeler quand l'utilisateur consulte la liste : éteint les badges. */
export const touchListeVisit = (): void => {
  try {
    window.localStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* stockage indisponible : on ignore */
  }
};

export const isNouveauCourrier = (createdAt: string | number | Date | null | undefined): boolean => {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return false;
  return t > getLastListeVisit();
};

export const countNouveauxCourriers = <T extends { createdAt?: string | number | Date | null }>(
  items: T[]
): number => items.filter((c) => isNouveauCourrier(c.createdAt)).length;
