import {
  IsArray,
  IsInt,
  IsString,
  ValidateNested,
} from "class-validator"

import {
  Type,
} from "class-transformer"

export class ReorderTaskItemDto{

  @IsString()
  id!:string

  @IsInt()
  position!:number

}

export class ReorderTaskDto{

  @IsArray()
  @ValidateNested({
    each:true,
  })
  @Type(()=>ReorderTaskItemDto)
  items!:ReorderTaskItemDto[]

}