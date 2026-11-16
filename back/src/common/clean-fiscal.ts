/** Campos fiscais de texto: string vazia limpa o campo (null), para o sistema saber o que ainda falta. */
export function cleanFiscal<T extends Record<string, any>>(dto: T, keys: string[]): T {
  const out: Record<string, any> = { ...dto };
  for (const k of keys) if (typeof out[k] === 'string' && out[k].trim() === '') out[k] = null;
  return out as T;
}
