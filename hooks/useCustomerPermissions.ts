/**
 * 客户权限检查钩子
 * 集中管理客户操作的权限逻辑
 */
import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Customer, UserRole } from '../shared/types';

export const useCustomerPermissions = () => {
  const { user } = useAuth();

  return useMemo(() => ({
    // 判断是否可以查看客户详情
    canViewCustomer: (customer: Customer): boolean => {
      if (!user) return false;
      // 所有角色都可以查看客户详情
      return true;
    },

    // 判断是否可以编辑客户
    canEditCustomer: (customer: Customer): boolean => {
      if (!user) return false;
      // 管理员可以编辑所有客户
      if (user.role === UserRole.SUPER_ADMIN) return true;
      // 代理商只能编辑关联到自己的客户
      if (user.role === UserRole.AGENT && customer.relatedAgentId === user._id) return true;
      // 销售只能编辑关联到自己的客户
      if (user.role === UserRole.FACTORY_SALES && customer.relatedSalesId === user._id) return true;
      return false;
    },

    // 判断是否可以分配客户
    canAssignCustomer: (customer: Customer): boolean => {
      if (!user) return false;
      // 管理员可以分配所有客户
      if (user.role === UserRole.SUPER_ADMIN) return true;
      // 代理商不能分配客户
      if (user.role === UserRole.AGENT) return false;
      // 销售只能分配关联到自己的客户
      if (user.role === UserRole.FACTORY_SALES && customer.relatedSalesId === user._id) return true;
      return false;
    },

    // 判断是否可以移入公海
    canMoveToPublicPool: (customer: Customer): boolean => {
      if (!user) return false;
      // 已经在公海的客户不能再移入公海
      if (customer.isInPublicPool) return false;
      // 管理员可以移入公海
      if (user.role === UserRole.SUPER_ADMIN) return true;
      // 代理商不能移入公海
      if (user.role === UserRole.AGENT) return false;
      // 销售只能移入关联到自己的客户
      if (user.role === UserRole.FACTORY_SALES && customer.relatedSalesId === user._id) return true;
      return false;
    },

    // 判断是否可以删除客户
    canDeleteCustomer: (customer: Customer): boolean => {
      if (!user) return false;
      // 只有管理员可以删除客户
      return user.role === UserRole.SUPER_ADMIN;
    }
  }), [user]);
};