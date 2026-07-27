import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RealtimeService } from './realtime.service';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    roles?: string[];
  };
}

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  @UseGuards(JwtAuthGuard)
  @Get('events')
  connect(@Req() req: AuthenticatedRequest, @Res() res: Response): void {
    const userId = req.user.id;
    const roles = req.user.roles;
    const userAgent = req.headers['user-agent'];

    const connectionId = this.realtimeService.connect(userId, roles, res, userAgent);

    req.on('close', () => {
      this.realtimeService.disconnect(userId, connectionId);
    });
  }
}