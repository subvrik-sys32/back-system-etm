import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator"

export class UpdateProjectDto {

  @IsOptional()
  @IsString()
  @Matches(
    /^\d{2}-\d{3}-[A-Z]$/,
    {
      message:"Invalid project code format",
    },
  )
  projectCode?:string

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name?:string

  @IsOptional()
  @IsString()
  clientId?:string

  @IsOptional()
  @IsString()
  pmId?:string

  @IsOptional()
  @IsString()
  stageId?:string

  @IsOptional()
  @IsString()
  statusId?:string

  @IsOptional()
  @IsDateString()
  deliveryDate?:string

}