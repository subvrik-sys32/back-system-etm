// realtime.service.ts

import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'crypto';
import { Subject, Subscription, interval } from 'rxjs';
import {
  PublishOptions,
  RealtimeConnectionInfo,
  RealtimeEvent,
} from './types/realtime-event';

interface InternalConnection {
  id: string;
  userId: string;
  role?: string;
  userAgent?: string;
  response: Response;
  subject: Subject<RealtimeEvent>;
  subscription: Subscription;
  heartbeatSubscription: Subscription;
  connectedAt: Date;
}

const HEARTBEAT_INTERVAL_MS = 30_000;

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  // Connection Hub: userId -> connectionId -> conexión
  private readonly connections = new Map<string, Map<string, InternalConnection>>();

  connect(
    userId: string,
    role: string | undefined,
    response: Response,
    userAgent?: string,
  ): string {
    const connectionId = randomUUID();

    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    response.flushHeaders();

    const subject = new Subject<RealtimeEvent>();

    const subscription = subject.subscribe({
      next: (event) => {
        // 🔍 INSTRUMENTACIÓN
        this.logger.debug(
          `[SUBJECT.next] -> user=${userId} connection=${connectionId} entity=${event.entity} action=${event.action} id=${event.id ?? '-'}`,
        );
        this.writeEvent(response, 'message', event);
      },
      error: (err) =>
        this.logger.error(`Error en stream de ${connectionId}: ${err?.message}`),
    });

    const heartbeatSubscription = interval(HEARTBEAT_INTERVAL_MS).subscribe(() => {
      this.writeComment(response, 'heartbeat');
    });

    const connection: InternalConnection = {
      id: connectionId,
      userId,
      role,
      userAgent,
      response,
      subject,
      subscription,
      heartbeatSubscription,
      connectedAt: new Date(),
    };

    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Map());
    }
    this.connections.get(userId)!.set(connectionId, connection);

    this.writeEvent(response, 'connected', {
      entity: 'connection',
      action: 'created',
      payload: { connectionId },
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `Conexión abierta: user=${userId} connection=${connectionId} ` +
        `(conexiones activas del usuario: ${this.connections.get(userId)!.size})`,
    );

    return connectionId;
  }

  disconnect(userId: string, connectionId: string): void {
    const userConnections = this.connections.get(userId);
    if (!userConnections) return;

    const connection = userConnections.get(connectionId);
    if (!connection) return;

    connection.subscription.unsubscribe();
    connection.heartbeatSubscription.unsubscribe();
    connection.subject.complete();

    try {
      if (!connection.response.writableEnded) {
        connection.response.end();
      }
    } catch (err) {
      this.logger.warn(
        `Error cerrando response de ${connectionId}: ${(err as Error).message}`,
      );
    }

    userConnections.delete(connectionId);
    if (userConnections.size === 0) {
      this.connections.delete(userId);
    }

    this.logger.log(`Conexión cerrada: user=${userId} connection=${connectionId}`);
  }

  publish<T>(options: PublishOptions<T>): void {
    // 🔍 INSTRUMENTACIÓN: confirma que publish() se está llamando y con qué
    this.logger.log(
      `[PUBLISH] entity=${options.entity} action=${options.action} id=${options.id ?? '-'} ` +
        `excludeUserId=${options.excludeUserId ?? '-'} targetUserIds=${JSON.stringify(options.targetUserIds ?? null)} ` +
        `targetRoles=${JSON.stringify(options.targetRoles ?? null)} payload=${JSON.stringify(options.payload)}`,
    );

    const event: RealtimeEvent<T> = {
      entity: options.entity,
      action: options.action,
      id: options.id,
      payload: options.payload,
      timestamp: new Date().toISOString(),
      originUserId: options.excludeUserId,
    };

    // 🔍 INSTRUMENTACIÓN: cuántos usuarios/conexiones hay en el hub en este momento
    this.logger.debug(
      `[PUBLISH] usuarios conectados actualmente: ${[...this.connections.keys()].join(', ') || '(ninguno)'}`,
    );

    let matchedUsers = 0;
    let matchedConnections = 0;

    for (const [userId, userConnections] of this.connections) {
      if (options.excludeUserId && userId === options.excludeUserId) continue;
      if (options.targetUserIds && !options.targetUserIds.includes(userId)) continue;
      if (options.targetRoles && !this.userHasAnyRole(userConnections, options.targetRoles)) {
        continue;
      }

      matchedUsers++;
      for (const connection of userConnections.values()) {
        matchedConnections++;
        connection.subject.next(event);
      }
    }

    // 🔍 INSTRUMENTACIÓN: si esto da 0, el evento no llegó a NADIE
    this.logger.log(
      `[PUBLISH] resultado: ${matchedUsers} usuario(s) / ${matchedConnections} conexión(es) recibieron el evento`,
    );
  }

  publishToUser<T>(
    userId: string,
    event: Omit<PublishOptions<T>, 'targetUserIds' | 'targetRoles'>,
  ): void {
    this.publish({ ...event, targetUserIds: [userId] });
  }

  publishToRole<T>(
    role: string,
    event: Omit<PublishOptions<T>, 'targetRoles' | 'targetUserIds'>,
  ): void {
    this.publish({ ...event, targetRoles: [role] });
  }

  publishToProject<T>(
    memberUserIds: string[],
    event: Omit<PublishOptions<T>, 'targetUserIds'>,
  ): void {
    this.publish({ ...event, targetUserIds: memberUserIds });
  }

  broadcast<T>(
    event: Omit<PublishOptions<T>, 'targetUserIds' | 'targetRoles' | 'excludeUserId'>,
  ): void {
    this.publish(event);
  }

  getActiveConnections(): RealtimeConnectionInfo[] {
    const result: RealtimeConnectionInfo[] = [];
    for (const userConnections of this.connections.values()) {
      for (const connection of userConnections.values()) {
        result.push({
          connectionId: connection.id,
          userId: connection.userId,
          role: connection.role,
          userAgent: connection.userAgent,
          connectedAt: connection.connectedAt,
        });
      }
    }
    return result;
  }

  private userHasAnyRole(
    userConnections: Map<string, InternalConnection>,
    roles: string[],
  ): boolean {
    for (const connection of userConnections.values()) {
      if (connection.role && roles.includes(connection.role)) return true;
    }
    return false;
  }

  private writeEvent(response: Response, eventName: string, data: unknown): void {
    try {
      response.write(`event: ${eventName}\n`);
      response.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      this.logger.warn(`No se pudo escribir evento SSE: ${(err as Error).message}`);
    }
  }

  private writeComment(response: Response, comment: string): void {
    try {
      response.write(`: ${comment}\n\n`);
    } catch {
      // conexión probablemente muerta
    }
  }
}