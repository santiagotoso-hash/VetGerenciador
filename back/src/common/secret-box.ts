import { BadRequestException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Cifra segredos guardados no banco (certificado digital, senha do certificado, CSC) com AES-256-GCM.
 * A chave vem de FISCAL_ENCRYPTION_KEY (64 caracteres hexadecimais = 32 bytes) e NUNCA fica no banco.
 * Sem a chave, nada é guardado: melhor recusar do que gravar um certificado sem proteção.
 *
 * Gerar uma chave:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 * ATENÇÃO: se a chave for perdida ou trocada, os segredos já guardados não podem mais ser lidos
 * (basta enviar o certificado de novo).
 */
function key(): Buffer {
  const hex = process.env.FISCAL_ENCRYPTION_KEY?.trim();
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new BadRequestException(
      'Configure FISCAL_ENCRYPTION_KEY (64 caracteres hexadecimais) no servidor antes de guardar certificado ou CSC.',
    );
  }
  return Buffer.from(hex, 'hex');
}

export const secretBoxReady = () => /^[0-9a-fA-F]{64}$/.test(process.env.FISCAL_ENCRYPTION_KEY?.trim() ?? '');

/** Texto -> "v1:iv:tag:dados" (tudo em base64). */
export function encryptSecret(plain: string | Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

export function decryptSecret(box: string): Buffer {
  const [v, iv, tag, data] = box.split(':');
  if (v !== 'v1' || !iv || !tag || !data) throw new Error('Segredo em formato desconhecido');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]);
}
