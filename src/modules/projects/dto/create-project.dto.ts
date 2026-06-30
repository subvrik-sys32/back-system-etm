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
    /^\d{2}-\d{3}-[A-Z]$/,
    {
      message:"Invalid project code format",
    },
  )
  projectCode!:string

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