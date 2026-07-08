import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RealtimeService } from './realtime.service';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    role?: string;
  };
}

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  @UseGuards(JwtAuthGuard)
  @Get('events')
  connect(@Req() req: AuthenticatedRequest, @Res() res: Response): void {
    const userId = req.user.id;
    const role = req.user.role;
    const userAgent = req.headers['user-agent'];

    const connectionId = this.realtimeService.connect(userId, role, res, userAgent);

    req.on('close', () => {
      this.realtimeService.disconnect(userId, connectionId);
    });
  }
}