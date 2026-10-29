/** Public reference: administrative number first; legacy reference when unassigned. */
export function courrierReferences(courrier: { numero: string; numeroOrganisationnel?: string | null }): string {
  return courrier.numeroOrganisationnel?.trim() || courrier.numero;
}
/** Search also accepts the immutable technical reference. */
export function courrierSearchReferences(courrier: { numero: string; numeroOrganisationnel?: string | null }): string {
  return `${courrier.numero} ${courrier.numeroOrganisationnel || ''}`;
}
