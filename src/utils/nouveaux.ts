// P8 — Badges « nouveaux courriers » : un courrier est « nouveau » si sa date de
// création est postérieure à la dernière visite de la liste par cet utilisateur
// (traçage localStorage, zéro backend). Défaut : fenêtre de 7 jours pour un
// premier passage (évite de badger tout l'historique).
const KEY = 'sigc_last_liste_courriers';
const DEFAULT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const getLastListeVisit = (): number => {
  try {
    const v = Number(window.localStorage.getItem(KEY));
    return Number.isFinite(v) && v > 0 ? v : Date.now() - DEFAULT_WINDOW_MS;
  } catch {
    return Date.now() - DEFAULT_WINDOW_MS;
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
