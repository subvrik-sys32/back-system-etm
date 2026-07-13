import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator"

export class CreateProjectDto {

  @IsString()
  @Matches(
    /^\d{2}-\d{3}-(?:M|E|EM)$/,
    {
      message: "Project code must have the format 26-001-M, 26-001-E or 26-001-EM",
    },
  )
  projectCode!: string

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name!:string

  @IsString()
  clientId!:string

  @IsString()
  pmId!:string

  @IsString()
  stageId!:string

  @IsString()
  statusId!:string

  @IsOptional()
  @IsDateString()
  deliveryDate?:string

}