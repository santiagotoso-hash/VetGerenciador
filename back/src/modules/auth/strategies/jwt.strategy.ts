import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

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
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId ?? null,
      company: user.company ? { id: user.company.id, name: user.company.name, logo: user.company.logo } : null,
    };
  }
}
