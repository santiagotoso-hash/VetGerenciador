import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/** Envia e-mails via SMTP. Sem SMTP_HOST configurado, apenas registra no log (nada é enviado). */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private from: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    this.from = config.get<string>('MAIL_FROM') || config.get<string>('SMTP_USER') || 'VetPet <no-reply@vetpet.local>';
    if (host) {
      const port = Number(config.get('SMTP_PORT') ?? 587);
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: config.get('SMTP_USER')
          ? { user: config.get('SMTP_USER'), pass: config.get('SMTP_PASS') }
          : undefined,
      });
    } else {
      this.logger.warn('SMTP_HOST não configurado: e-mails não serão enviados (apenas logados).');
    }
  }

  get enabled() {
    return !!this.transporter;
  }

  /** Envia e LANÇA erro se não conseguir (usado na cobrança, em que o superadmin precisa saber da falha). */
  async sendStrict(opts: {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    attachments?: { filename: string; content: Buffer }[];
  }) {
    if (!this.transporter) throw new Error('Configure o e-mail (SMTP_HOST, SMTP_USER, SMTP_PASS) no servidor para enviar cobranças');
    await this.transporter.sendMail({ from: this.from, ...opts });
  }

  /** Retorna true se o e-mail foi realmente enviado. Nunca lança exceção. */
  async send(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.log(`[sem SMTP] para ${to}: ${subject}`);
      return false;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
      return true;
    } catch (e) {
      this.logger.error(`Falha ao enviar e-mail para ${to}: ${(e as Error).message}`);
      return false;
    }
  }
}
