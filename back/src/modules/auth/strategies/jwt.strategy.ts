import { HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { blockedMessage, computeBilling } from '../../billing/billing';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  // Consulta o usuário a cada requisição: conta desativada perde o acesso na hora
  // e mudanças de perfil (role) valem imediatamente, sem esperar o token expirar.
  async validate(payload: any) {
    const user = await this.usersService.findOne(payload.sub).catch(() => null);
    if (!user || !user.active) {
      throw new UnauthorizedException('Usuário inativo ou inexistente');
    }
    if (user.companyId && user.company && !user.company.active) {
      throw new UnauthorizedException('Empresa desativada');
    }
    const billing = user.company ? computeBilling(user.company) : null;
    // teste encerrado ou mensalidade atrasada além da tolerância: bloqueia (exceto o superadmin)
    if (billing?.blocked && user.role !== 'SUPER_ADMIN') throw new HttpException(blockedMessage(billing), 402);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId ?? null,
      company: user.company ? { id: user.company.id, name: user.company.name, logo: user.company.logo, billing } : null,
    };
  }
}
