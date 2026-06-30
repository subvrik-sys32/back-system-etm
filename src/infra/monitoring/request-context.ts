import {
  AsyncLocalStorage,
} from "node:async_hooks"

export interface RequestContext{

  id:string

  method:string

  path:string

  startedAt:number

}

export const requestContext=

  new AsyncLocalStorage<RequestContext>()