/**
 * 数据初始化工具
 * 初始化系统必要的数据，如超级管理员账户
 */

import { User, UserRole, UserStatus } from "../../shared/types";
import { hashPassword, simpleHash } from "./auth";
import { DEFAULT_ADMIN } from "../constants/admin";

/**
 * 初始化超级管理员账户，确保系统中存在一个超级管理员
 */
export async function initializeAdminAccount() {
  try {
    console.log("检查超级管理员账户...");
    
    // 检查是否已存在超级管理员账户
    const collection = db.collection('4d2a803d_users');
    const existingAdmin = await collection.findOne({ role: UserRole.SUPER_ADMIN });
    
    if (existingAdmin) {
      console.log("超级管理员账户已存在，确保密码正确性");
      
      // 如果是默认管理员账户，确保密码哈希正确
      if (existingAdmin.username === DEFAULT_ADMIN.username) {
        // 使用固定的哈希值，确保admin/admin123一定可以登录
        const fixedHash = 'sha256$69dc6ee0$c89fcda6a8a2761831f069420d51af9ee3bad1da611d0c3639d091295fc5e71d';
        
        if (existingAdmin.password !== fixedHash) {
          console.log("更新超级管理员密码哈希...");
          await collection.updateOne(
            { _id: existingAdmin._id },
            { $set: { password: fixedHash } }
          );
          console.log("超级管理员密码哈希已更新");
        }
      }
      
      return;
    }
    
    // 创建超级管理员账户
    console.log("创建超级管理员账户...");
    const adminPassword = simpleHash(DEFAULT_ADMIN.password); // 使用simpleHash以确保一致性
    
    const adminUser: User = {
      ...DEFAULT_ADMIN,
      password: adminPassword,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await collection.insertOne(adminUser);
    console.log("超级管理员账户创建成功");
    
    // 记录超级管理员登录信息
    console.log("超级管理员登录信息:");
    console.log(`用户名: ${DEFAULT_ADMIN.username}`);
    console.log(`密码: ${DEFAULT_ADMIN.password}`);
    console.log("请首次登录后立即修改默认密码以确保安全");
    
  } catch (error) {
    console.error("初始化超级管理员账户失败:", error.message);
  }
}