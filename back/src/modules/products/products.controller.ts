import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProductsService } from './products.service';
import { AdjustStockDto, CreateProductDto, UpdateProductDto } from './dto';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Post() create(@Body() dto: CreateProductDto) { return this.service.create(dto); }
  @Get() findAll(@Query('search') search?: string, @Query('category') category?: string, @Query('active') active?: string) { return this.service.findAll(search, category, active); }
  @Get('low-stock') lowStock() { return this.service.lowStock(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateProductDto) { return this.service.update(id, dto); }
  @Patch(':id/stock') adjustStock(@Param('id') id: string, @Body() dto: AdjustStockDto) { return this.service.adjustStock(id, dto.quantity); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
