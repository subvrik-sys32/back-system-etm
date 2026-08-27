import { IsOptional, IsString, MaxLength } from "class-validator"

export class CreateCommentDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  message?: string

  /** Foto (data URI / base64). Se comprime a WebP. */
  @IsOptional()
  @IsString()
  imageBase64?: string

  /** PDF / DXF / archivo (data URI o base64 plano). */
  @IsOptional()
  @IsString()
  fileBase64?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fileMime?: string

  @IsOptional()
  @IsString()
  parentId?: string
}
