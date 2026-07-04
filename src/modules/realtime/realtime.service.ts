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

    // Determinar si esta es la PRIMERA conexión activa del usuario
    // (debe calcularse ANTES de registrar la nueva conexión en el Map)
    const existingUserConnections = this.connections.get(userId);
    const isFirstConnection =
      !existingUserConnections || existingUserConnections.size === 0;

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

    // Presencia: solo emitir online:true si es la primera pestaña/conexión
    if (isFirstConnection) {
      this.emitPresence(userId, true);
    }

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

    // Determinar si esa era la ÚLTIMA conexión activa del usuario
    const isLastConnection = userConnections.size === 0;

    if (isLastConnection) {
      this.connections.delete(userId);
    }

    this.logger.log(`Conexión cerrada: user=${userId} connection=${connectionId}`);

    // Presencia: solo emitir online:false si ya no quedan conexiones
    if (isLastConnection) {
      this.emitPresence(userId, false);
    }
  }

  publish<T>(options: PublishOptions<T>): void {

    const event: RealtimeEvent<T> = {
      entity: options.entity,
      action: options.action,
      id: options.id,
      payload: options.payload,
      timestamp: new Date().toISOString(),
      originUserId: options.excludeUserId,
    };

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

  /**
   * Indica si el usuario tiene al menos una conexión SSE activa.
   * Única fuente de verdad para presencia: nadie debe acceder al Map directamente.
   */
  isUserOnline(userId: string): boolean {
    const userConnections = this.connections.get(userId);
    return !!userConnections && userConnections.size > 0;
  }

  /**
   * Devuelve los ids de todos los usuarios con al menos una conexión SSE activa.
   */
  getOnlineUserIds(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Emite el evento de presencia USER/UPDATED con el payload mínimo
   * { id, online }, usado por el frontend para hacer merge parcial.
   */
  private emitPresence(userId: string, online: boolean): void {
    this.publish<{ id: string; online: boolean }>({
      entity: 'USER',
      action: 'UPDATED',
      id: userId,
      payload: { id: userId, online },
    });
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