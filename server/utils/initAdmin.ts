/**
 * 超级管理员初始化工具
 * 检查并创建默认超级管理员账户
 */

import { User, UserStatus } from "../../shared/types";
import { hashPassword } from "./auth";
import { DEFAULT_ADMIN } from "../constants/admin";

export async function initSuperAdmin() {
  try {
    console.log("检查超级管理员账户...");
    
    // 检查是否已存在超级管理员账户
    const collection = db.collection('4d2a803d_users');
    const existingAdmin = await collection.findOne({ role: DEFAULT_ADMIN.role });
    
    if (existingAdmin) {
      console.log("超级管理员账户已存在，无需创建");
      return;
    }
    
    // 创建超级管理员账户
    const adminUser: User = {
      ...DEFAULT_ADMIN,
      password: hashPassword(DEFAULT_ADMIN.password)
    };
    
    await collection.insertOne(adminUser);
    console.log("超级管理员账户创建成功");
    
    // 打印超级管理员初始登录信息
    console.log("超级管理员登录信息:");
    console.log(`用户名: ${DEFAULT_ADMIN.username}`);
    console.log(`密码: ${DEFAULT_ADMIN.password}`);
    console.log("请首次登录后立即修改默认密码以确保安全");
    
  } catch (error) {
    console.error("初始化超级管理员账户失败:", error.message);
  }
}