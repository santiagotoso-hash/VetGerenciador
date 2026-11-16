import { BadRequestException, HttpException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcryptjs';
import { MailService } from '../mail/mail.service';
import { blockedMessage, computeBilling } from '../billing/billing';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mail: MailService,
  ) {}

  private readonly logger = new Logger(AuthService.name);
  private static RESET_TTL_MS = 60 * 60 * 1000; // o link vale 1 hora

  private hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

  /**
   * "Esqueci minha senha": gera um link de uso único e envia por e-mail. A resposta é sempre a mesma,
   * exista ou não o e-mail, para ninguém descobrir quem tem conta. O endereço do site vem de WEB_URL
   * (nunca da requisição), para o link não poder ser desviado.
   */
  async forgotPassword(emailInput: string) {
    const user = await this.usersService.findByEmail(emailInput);
    if (user && user.active && !(user.company && !user.company.active)) {
      const token = randomBytes(32).toString('hex');
      await PrismaService.raw.user.update({
        where: { id: user.id },
        data: { passwordResetHash: this.hashToken(token), passwordResetExpires: new Date(Date.now() + AuthService.RESET_TTL_MS) },
      });
      const base = (this.configService.get<string>('WEB_URL') || 'http://localhost:3000').replace(/\/$/, '');
      const link = `${base}/redefinir-senha?token=${token}`;
      const brand = user.company?.name ?? 'VetPet';
      const html = `<div style="font-family:Arial,sans-serif;max-width:520px">
        <h2 style="color:#0d9488">🐾 ${brand.replace(/[<>&"']/g, '')}</h2>
        <p>Olá, ${user.name.replace(/[<>&"']/g, '')}!</p>
        <p>Recebemos um pedido para redefinir a sua senha. Clique no botão abaixo para escolher uma nova senha. O link vale por <b>1 hora</b> e só pode ser usado uma vez.</p>
        <p><a href="${link}" style="display:inline-block;background:#0d9488;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Redefinir minha senha</a></p>
        <p style="color:#666;font-size:13px">Se o botão não funcionar, copie este endereço no navegador:<br>${link}</p>
        <p style="color:#666;font-size:13px">Se você não pediu isso, ignore este e-mail: a sua senha continua a mesma.</p>
      </div>`;
      const sent = await this.mail.send(user.email, 'Redefinição de senha', html);
      if (!sent && process.env.NODE_ENV !== 'production') this.logger.warn(`[dev, sem SMTP] link de redefinição de ${user.email}: ${link}`);
    }
    return { message: 'Se o e-mail estiver cadastrado, enviamos um link para redefinir a senha.' };
  }

  /** Define a nova senha com o link recebido por e-mail. O link é de uso único e encerra as sessões antigas. */
  async resetPassword(token: string, password: string) {
    const user = await PrismaService.raw.user.findFirst({
      where: { passwordResetHash: this.hashToken(token), passwordResetExpires: { gt: new Date() }, active: true },
    });
    if (!user) throw new BadRequestException('Link inválido ou expirado. Peça um novo em "Esqueci minha senha".');
    await PrismaService.raw.user.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(password, 10),
        passwordResetHash: null,
        passwordResetExpires: null,
        passwordChangedAt: new Date(),
      },
    });
    return { message: 'Senha alterada. Entre com a nova senha.' };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && user.active && (await bcrypt.compare(password, user.password))) {
      if (user.companyId && user.company && !user.company.active) {
        throw new UnauthorizedException('Empresa desativada. Entre em contato com o suporte.');
      }
      if (user.company && user.role !== 'SUPER_ADMIN') {
        const billing = computeBilling(user.company);
        if (billing.blocked) throw new HttpException(blockedMessage(billing), 402);
      }
      const { password: _pw, refreshToken: _rt, ...result } = user;
      return {
        ...result,
        company: user.company ? { id: user.company.id, name: user.company.name, logo: user.company.logo, active: user.company.active, billing: computeBilling(user.company) } : null,
      };
    }
    return null;
  }

  async login(user: any) {
    // registra o último acesso (relatório de uso do superadmin); falha aqui não impede o login
    PrismaService.raw.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => undefined);
    const payload = { email: user.email, sub: user.id, role: user.role, companyId: user.companyId ?? null };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '30d'),
    });
    return { accessToken, refreshToken, user };
  }

  async refreshToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });
      const user = await this.usersService.findOne(payload.sub);
      return this.login(user);
    } catch {
      throw new UnauthorizedException('Token inválido');
    }
  }
}
