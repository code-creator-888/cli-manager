export function buildFTSQuery(search: string): string | undefined {
  const terms = search
    .trim()
    .match(/[\p{L}\p{N}_-]+/gu)
    ?.map((term) => term.replace(/"/g, '""'))
    .filter(Boolean);

  if (!terms || terms.length === 0) {
    return undefined;
  }

  return terms.map((term) => `"${term}"*`).join(' AND ');
}
