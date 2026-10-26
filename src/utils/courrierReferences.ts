export function courrierReferences(courrier: { numero: string; numeroOrganisationnel?: string | null }): string {
  return courrier.numeroOrganisationnel
    ? `${courrier.numero} · ${courrier.numeroOrganisationnel}`
    : courrier.numero;
}
