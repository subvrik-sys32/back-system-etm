import { Controller, Get, UseGuards } from "@nestjs/common"
import { SidebarService } from "./sidebar.service"
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard"

@UseGuards(JwtAuthGuard)
@Controller("sidebar")
export class SidebarController {

  constructor(private readonly sidebarService: SidebarService) {}

  @Get("counts")
  getCounts() {
    return this.sidebarService.getCounts()
  }

}