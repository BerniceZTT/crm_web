/**
 * 超级管理员配置常量
 * 定义内置超级管理员的默认设置信息
 */

import { UserRole, UserStatus } from "../../shared/types";

export const DEFAULT_ADMIN = {
  username: "admin",
  password: "admin123", // 初始密码，建议首次登录后立即修改
  phone: "13800000000",
  role: UserRole.SUPER_ADMIN,
  status: UserStatus.APPROVED
};