// P11 — Logique d'orientation des courriers (secrétariat DG).
// Règle : le secrétaire du DG oriente chaque courrier selon SON DESTINATAIRE :
//   - destinataire = Direction Générale / DG  → Directeur Général
//   - destinataire = une direction X         → le Directeur de X
// Repli : si le destinataire n'est pas reconnu, l'utilisateur choisit manuellement.
import { Role } from '../types';
import type { Utilisateur } from '../types';

/** Normalise un libellé pour comparaison (minuscules, espaces compressés). */
export const normalizeText = (s: string | null | undefined): string =>
  (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

/** P11 — Secrétaire du DG (rôle SECRETAIRE + drapeau estSecrétaireDG). */
export function isDGSecretary(
  user: { role?: Role | string; estSecrétaireDG?: boolean } | null | undefined
): boolean {
  return !!user && user.role === Role.SECRETAIRE && user.estSecrétaireDG === true;
}

export interface OrientationCible {
  target: Utilisateur;
  /** Motif de la résolution (affiché dans l'instruction de l'assignation). */
  motif: string;
  /** Statut à poser sur le courrier après orientation. */
  statut: 'ORIENTE_DG' | 'ORIENTE_DIRECTEUR';
}

/** Le Directeur Général actif (1er par ordre d'email, comportement existant). */
export function getDG(users: Utilisateur[]): Utilisateur | null {
  const dg = users
    .filter(
      (u) =>
        (u.role === Role.DIRECTEUR_GENERAL || String(u.role || '').toUpperCase() === 'DIRECTEUR_GENERAL') &&
        u.actif !== false
    )
    .sort((a, b) => (a.email || '').localeCompare(b.email || ''));
  return dg[0] || null;
}

/** Les directeurs de directions actifs. */
export function getDirecteurs(users: Utilisateur[]): Utilisateur[] {
  return users.filter((u) => u.role === Role.DIRECTEUR && u.actif !== false);
}

const estDestinataireDG = (dest: string): boolean => {
  if (!dest) return false;
  return (
    dest.includes('direction générale') ||
    dest.includes('direction generale') ||
    dest.includes('directeur général') ||
    dest.includes('directeur general') ||
    dest === 'dg'
  );
};

const matchDirecteurParNom = (nom: string, directeurs: Utilisateur[]): Utilisateur | null => {
  const n = normalizeText(nom);
  if (!n) return null;
  // 1) égalité normalisée
  const exact = directeurs.find((d) => normalizeText(d.direction) === n);
  if (exact) return exact;
  // 2) inclusion (le destinataire mentionne la direction, ou l'inverse)
  const partial = directeurs.find((d) => {
    const dir = normalizeText(d.direction);
    return dir.length > 3 && (n.includes(dir) || dir.includes(n));
  });
  return partial || null;
};

/**
 * Résout la cible d'orientation d'un courrier à partir de son DESTINATAIRE
 * (règle secrétariat DG). Renvoie null si aucune cible ne peut être déduite
 * (→ repli manuel par l'utilisateur).
 */
export function resolveOrientationTarget(
  courrier: { destinataire?: string | null; direction?: string | null },
  users: Utilisateur[]
): OrientationCible | null {
  const dg = getDG(users);
  const directeurs = getDirecteurs(users);
  const dest = normalizeText(courrier.destinataire);

  // 1) Destinataire DG / Direction Générale
  if (estDestinataireDG(dest)) {
    return dg
      ? { target: dg, motif: 'destinataire : Direction Générale', statut: 'ORIENTE_DG' }
      : null;
  }

  // 2) Destinataire = une direction → son directeur
  if (dest && dest !== 'non renseigné') {
    const directeur = matchDirecteurParNom(dest, directeurs);
    if (directeur) {
      return {
        target: directeur,
        motif: `destinataire : ${directeur.direction}`,
        statut: 'ORIENTE_DIRECTEUR',
      };
    }
  }

  // 3) Repli sur la colonne direction du courrier (si renseignée)
  const dirCourrier = normalizeText(courrier.direction);
  if (dirCourrier && !estDestinataireDG(dirCourrier)) {
    const directeur = matchDirecteurParNom(dirCourrier, directeurs);
    if (directeur) {
      return {
        target: directeur,
        motif: `direction : ${directeur.direction}`,
        statut: 'ORIENTE_DIRECTEUR',
      };
    }
  }

  return null;
}

/** Libellé court d'une cible (pour les menus / boutons). */
export function libelleCible(target: Utilisateur): string {
  return target.role === Role.DIRECTEUR_GENERAL ? 'le Directeur Général' : `le Directeur de ${target.direction || 'sa direction'}`;
}
