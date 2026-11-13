import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Criar usuário' })
  @Roles('ADMIN')
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @ApiOperation({ summary: 'Listar usuários' })
  @Get()
  findAll(@Query('active') active?: string) {
    return this.usersService.findAll(active);
  }

  @ApiOperation({ summary: 'Buscar usuário por ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @ApiOperation({ summary: 'Atualizar usuário (ADMIN; demais perfis só o próprio nome, telefone e senha)' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @Request() req) {
    if (req.user.role !== 'ADMIN') {
      if (req.user.id !== id) throw new ForbiddenException('Sem permissão');
      // quem não é admin não pode mudar perfil, e-mail nem status da própria conta
      const { name, phone, password } = updateUserDto;
      return this.usersService.update(id, { name, phone, password });
    }
    return this.usersService.update(id, updateUserDto);
  }

  @ApiOperation({ summary: 'Remover usuário' })
  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
