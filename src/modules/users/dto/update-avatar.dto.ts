import {
  IsNotEmpty,
  IsString,
} from "class-validator"

export class UpdateAvatarDto {

  @IsNotEmpty()
  @IsString()
  imageBase64!: string

}