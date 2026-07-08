import { Global, Module } from '@nestjs/common';
import { RealtimeController } from './realtime.controller';
import { RealtimeService } from './realtime.service';
import { EntityRealtimeInterceptor } from './entity-realtime.interceptor';

@Global()
@Module({
  controllers: [RealtimeController],
  providers: [RealtimeService, EntityRealtimeInterceptor],
  exports: [RealtimeService, EntityRealtimeInterceptor],
})
export class RealtimeModule {}
