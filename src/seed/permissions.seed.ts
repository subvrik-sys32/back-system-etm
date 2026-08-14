/**
 * Fuente única: PermissionCode.
 * No mantener listas a mano — cualquier código nuevo del enum
 * entra solo al seed al correr seedPermissions / seedRolePermissions.
 */
import { PermissionCode } from "@/core/enums/permission-code.enum"

/** @deprecated Usar PERMISSIONS de seed.constants (Object.values PermissionCode). */
export const permissionsSeed = Object.values(PermissionCode)
