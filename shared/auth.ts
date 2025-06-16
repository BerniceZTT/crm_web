/**
 * 共享认证工具
 * 提供权限检查等跨前后端使用的功能
 */

import { UserRole } from './types';

// 定义资源操作权限
const permissions: Record<UserRole, Record<string, string[]>> = {
  [UserRole.SUPER_ADMIN]: {
    users: ['create', 'read', 'update', 'delete', 'approve'],
    customers: ['create', 'read', 'update', 'delete', 'approve', 'assign'],
    agents: ['create', 'read', 'update', 'delete', 'approve'],
    products: ['create', 'read', 'update', 'delete'],
    publicPool: ['read', 'assign'], 
    dashboard: ['read'],
    'system-configs':['read'],
  },
  [UserRole.FACTORY_SALES]: {
    customers: ['create', 'read', 'update', 'delete'],
    agents: ['read', 'create'], 
    users: ['read'], 
    products: ['read'], 
    publicPool: ['read', 'assign'], // 增加 assign 权限
    dashboard: []
  },
  [UserRole.AGENT]: {
    customers: ['create', 'read', 'update', 'delete'],
    products: ['read'],
    publicPool: ['read', 'assign'], // 增加 assign 权限
    dashboard: []
  },
  [UserRole.INVENTORY_MANAGER]: {
    products: ['create', 'read', 'update', 'delete'],
    inventory: ['create', 'read'],
    dashboard: []
  }
};

/**
 * 检查用户是否有权限执行特定资源的特定操作
 * @param role 用户角色
 * @param resource 资源名称
 * @param action 操作名称
 * @returns 是否有权限
 */
export function hasPermission(role: UserRole, resource: string, action: string): boolean {
  // 检查该角色是否有此资源的权限配置
  if (!permissions[role] || !permissions[role][resource]) {
    return false;
  }
  
  // 检查该角色对此资源是否有此操作的权限
  return permissions[role][resource].includes(action);
}

/**
 * 检查用户是否可以分配公海客户
 * 超级管理员、销售和代理商都可以分配公海客户
 */
export function canAssignPublicPoolCustomer(role: UserRole): boolean {
  return role === UserRole.SUPER_ADMIN || 
         role === UserRole.FACTORY_SALES || 
         role === UserRole.AGENT;
}

// 导出公海客户权限检查函数集合
export const publicPoolPermissions = {
  canAssign: canAssignPublicPoolCustomer
};
