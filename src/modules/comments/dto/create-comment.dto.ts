import { IsOptional, IsString, MaxLength } from "class-validator"

export class CreateCommentDto{

  // Opcional ahora: un comentario puede ser solo una foto, sin
  // texto — la validación de "al menos uno de los dos" (mensaje o
  // foto) vive en el service, no acá.
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  message?:string

  @IsOptional()
  @IsString()
  imageBase64?:string

}