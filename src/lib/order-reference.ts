/** Only the complete public order number may be used as a numeric lookup. */
export function parsePublicOrderId(reference: string): number | null {
  const match = /^#?RD-(\d+)$/i.exec(reference.trim());
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
