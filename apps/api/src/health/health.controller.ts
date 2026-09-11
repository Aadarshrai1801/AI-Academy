import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '../common/throttle.decorator.js';

@Controller('health')
export class HealthController {
  @Get()
  @SkipThrottle()
  status() {
    return {
      status: 'ok',
      service: 'ai-academy-api',
      phase: 'phase-1',
      time: new Date().toISOString(),
    };
  }
}
