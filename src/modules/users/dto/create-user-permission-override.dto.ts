import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator"
import { PermissionEffect } from "@prisma/client"

export class CreateUserPermissionOverrideDto {

  @IsUUID()
  permissionId!: string

  @IsEnum(PermissionEffect)
  effect!: PermissionEffect

  @IsOptional()
  @IsString()
  reason?: string

  // ISO string — opcional, un override sin esto queda vigente hasta
  // que alguien lo revoque a mano.
  @IsOptional()
  @IsDateString()
  expiresAt?: string

}