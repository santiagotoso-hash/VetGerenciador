import { HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcryptjs';
import { blockedMessage, computeBilling } from '../billing/billing';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

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
