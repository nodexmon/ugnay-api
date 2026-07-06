import { Controller, Get } from '@nestjs/common';
import { BarangaysService } from './barangays.service';
import { Public } from '@/common/decorators/public-endpoint.decorator';

@Controller('barangays')
export class BarangaysController {
  constructor(private readonly barangaysService: BarangaysService) {}

  @Public()
  @Get()
  findAll() {
    return this.barangaysService.findAll();
  }
}
