export type RealtimeAction = 'CREATED' | 'UPDATED' | 'DELETED' | 'REORDERED' | string;

export interface RealtimeEvent<T = unknown> {
  entity: string;
  action: RealtimeAction;
  id?: string;
  payload?: T;
  timestamp: string;
  originUserId?: string;
}

export interface PublishOptions<T = unknown> {
  entity: string;
  action: RealtimeAction;
  id?: string;
  payload?: T;
  /** El usuario que originó el cambio. No recibirá el evento. */
  excludeUserId?: string;
  /** Si se define, solo estos userIds reciben el evento. */
  targetUserIds?: string[];
  /** Si se define, solo usuarios con alguna conexión en estos roles reciben el evento. */
  targetRoles?: string[];
}

export interface RealtimeConnectionInfo {
  connectionId: string;
  userId: string;
  role?: string;
  userAgent?: string;
  connectedAt: Date;
}