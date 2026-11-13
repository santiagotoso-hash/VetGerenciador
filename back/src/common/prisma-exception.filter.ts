import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

// Converte erros conhecidos do Prisma em respostas HTTP claras (em vez de 500).
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    const map: Record<string, [number, string]> = {
      P2002: [HttpStatus.CONFLICT, 'Já existe um registro com esse valor único'],
      P2003: [HttpStatus.BAD_REQUEST, 'Registro relacionado não encontrado'],
      P2025: [HttpStatus.NOT_FOUND, 'Registro não encontrado'],
    };
    const [status, message] = map[exception.code] ?? [
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Erro interno do servidor',
    ];

    res.status(status).json({ statusCode: status, message });
  }
}
