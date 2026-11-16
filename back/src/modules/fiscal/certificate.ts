import { BadRequestException } from '@nestjs/common';
import * as forge from 'node-forge';

export interface CertificateInfo {
  /** Nome do titular, como no certificado (ex.: "EMPRESA LTDA:12345678000190"). */
  subject: string;
  expiresAt: Date;
}

/** Abre um certificado A1 (.pfx/.p12) com a senha e lê titular e validade. Lança erro claro se a senha estiver errada. */
export function readCertificate(pfx: Buffer, password: string): CertificateInfo {
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(pfx.toString('binary')), false, password);
  } catch (e) {
    const msg = String((e as Error).message ?? '');
    if (/password|mac|pkcs12/i.test(msg)) throw new BadRequestException('Senha do certificado incorreta');
    throw new BadRequestException('Arquivo de certificado inválido: envie o arquivo .pfx ou .p12 do certificado A1');
  }
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? [];
  if (!certBags.length || !keyBags.length) throw new BadRequestException('O arquivo não contém certificado com chave privada (precisa ser um A1)');

  // o certificado do titular é o que tem o mesmo identificador da chave privada (os outros são a cadeia)
  const keyId = (keyBags[0].attributes?.localKeyId ?? [])[0];
  const own = certBags.find((b) => keyId && (b.attributes?.localKeyId ?? [])[0] === keyId) ?? certBags[0];
  const cert = own.cert!;
  return {
    subject: String(cert.subject.getField('CN')?.value ?? cert.subject.attributes.map((a) => a.value).join(' ')),
    expiresAt: cert.validity.notAfter,
  };
}
