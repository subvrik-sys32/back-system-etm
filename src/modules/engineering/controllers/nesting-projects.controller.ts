import {
  Controller,
  Post,
  Get,
  Delete,
  Put,
  Param,
  Body,
  HttpCode,
} from '@nestjs/common';
import { EngineeringFilesService } from '../services/engineering-files.service';

@Controller('engineering/nesting-projects')
export class NestingProjectsController {
  constructor(private readonly service: EngineeringFilesService) {}

  @Get()
  async list() {
    return this.service.listNestingProjects();
  }

  @Post()
  async create(
    @Body() body: { name?: string; project: Record<string, unknown> },
  ) {
    return this.service.saveNestingProject(body);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; project: Record<string, unknown> },
  ) {
    return this.service.saveNestingProject({ ...body, id });
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.service.getNestingProjectJson(id);
  }

  @Get(':id/meta')
  async getMeta(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
