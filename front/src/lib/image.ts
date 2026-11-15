/**
 * Redimensiona a imagem no navegador (lado maior até `max` px) e devolve um data URL leve (WebP/PNG).
 * Mantém a transparência quando o navegador gera WebP/PNG.
 */
export function resizeImage(file: File, max = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/webp', 0.9));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Arquivo de imagem inválido'));
    };
    img.src = url;
  });
}
