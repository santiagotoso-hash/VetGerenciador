// Pix "copia e cola" (BR Code estático do Banco Central) e o QR Code dele em PNG.
// O dinheiro cai direto na conta do recebedor: o sistema só monta o código com chave, valor e identificador.
import * as QRCode from 'qrcode';

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;

/** Nome e cidade do recebedor: só ASCII maiúsculo, no tamanho máximo do padrão. */
const ascii = (text: string, max: number) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .toUpperCase()
    .trim()
    .slice(0, max);

/** CRC16/CCITT-FALSE exigido no fim do código. */
function crc16(text: string) {
  let crc = 0xffff;
  for (const byte of Buffer.from(text, 'utf8')) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Código Pix copia e cola. `txid`: só letras e números (até 25); o valor vai em reais. */
export function pixPayload(o: { key: string; name: string; city: string; amountCents?: number; txid?: string }) {
  const id = (o.txid ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  const body =
    field('00', '01') +
    field('01', '11') +
    field('26', field('00', 'br.gov.bcb.pix') + field('01', o.key.trim())) +
    field('52', '0000') +
    field('53', '986') +
    (o.amountCents ? field('54', (o.amountCents / 100).toFixed(2)) : '') +
    field('58', 'BR') +
    field('59', ascii(o.name, 25) || 'RECEBEDOR') +
    field('60', ascii(o.city, 15) || 'BRASIL') +
    field('62', field('05', id)) +
    '6304';
  return body + crc16(body);
}

/** PNG do QR Code (Buffer) com o código Pix. */
export const pixQrPng = (payload: string) =>
  QRCode.toBuffer(payload, { type: 'png', width: 360, margin: 2, errorCorrectionLevel: 'M' });
