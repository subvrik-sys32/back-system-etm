import {
  IsArray,
  IsInt,
  IsString,
  ValidateNested,
} from "class-validator"

import {
  Type,
} from "class-transformer"

export class ReorderProjectItemDto{

  @IsString()
  id!:string

  @IsInt()
  position!:number

}

export class ReorderProjectDto{

  @IsArray()
  @ValidateNested({
    each:true,
  })
  @Type(()=>ReorderProjectItemDto)
  items!:ReorderProjectItemDto[]

}