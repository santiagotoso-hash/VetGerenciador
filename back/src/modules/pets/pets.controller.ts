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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PetsService } from './pets.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Pets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pets')
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  @ApiOperation({ summary: 'Criar pet' })
  @Post()
  create(@Body() createPetDto: CreatePetDto) {
    return this.petsService.create(createPetDto);
  }

  @ApiOperation({ summary: 'Listar pets' })
  @Get()
  findAll(@Query('search') search?: string, @Query('clientId') clientId?: string) {
    return this.petsService.findAll(search, clientId);
  }

  @ApiOperation({ summary: 'Buscar pet por ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.petsService.findOne(id);
  }

  @ApiOperation({ summary: 'Agendamentos do pet' })
  @Get(':id/appointments')
  getAppointments(@Param('id') id: string) {
    return this.petsService.getAppointments(id);
  }

  @ApiOperation({ summary: 'Prontuários do pet' })
  @Get(':id/medical-records')
  getMedicalRecords(@Param('id') id: string) {
    return this.petsService.getMedicalRecords(id);
  }

  @ApiOperation({ summary: 'Atualizar pet' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePetDto: UpdatePetDto) {
    return this.petsService.update(id, updatePetDto);
  }

  @ApiOperation({ summary: 'Remover pet' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.petsService.remove(id);
  }
}
