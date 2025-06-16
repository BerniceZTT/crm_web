/**
 * 共享类型定义
 * 包含整个应用程序中使用的数据类型和枚举
 */

import dayjs from "dayjs";

// 用户角色枚举
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN', // 超级管理员
  FACTORY_SALES = 'FACTORY_SALES', // 原厂销售
  AGENT = 'AGENT', // 代理商
  INVENTORY_MANAGER = 'INVENTORY_MANAGER' // 库存管理员
}

// 用户状态枚举
export enum UserStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

// 用户类型
export interface User {
  _id?: string;
  companyName?: string;
  username: string;
  password?: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  createdAt?: Date;
  updatedAt?: Date;
  rejectionReason?: string; // 拒绝原因
  relatedSalesId?: string; // 关联销售ID
  relatedSalesName?: string; // 关联销售名称
}

// 代理商类型
export interface Agent {
  _id?: string;
  companyName: string;
  password?: string;
  contactPerson: string;
  phone: string;
  relatedSalesId?: string;
  relatedSalesName?: string;
  status: UserStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

// 客户性质枚举
export enum CustomerNature {
  LISTED = '民营上市公司',
  SME = '民营中小企业',
  RESEARCH = '科研院所',
  STATE_OWNED = '国央企'
}

// 客户重要程度枚举
export enum CustomerImportance {
  A = 'A类客户（近三个月能生产）', // 6个月内能产生销售
  B = 'B类客户（近半年能生产）', // 1年内能产生销售
  C = 'C类客户（近一年能生产）'  // 1年以上能产生销售
}

// 客户进展枚举
export enum CustomerProgress {
  InitialContact = '初步接触',
  NORMAL = '正常推进',
  PUBLIC_POOL = '进入公海',
  Disabled = '禁用'
}

// 客户进展历史记录接口
export interface CustomerProgressHistory {
  _id?: string;
  customerId: string;
  customerName: string;
  fromProgress: string;
  toProgress: string;
  operatorId: string;
  operatorName: string;
  remark: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// 客户类型
export interface Customer {
  _id?: string;
  name: string;
  nature: CustomerNature;
  importance: CustomerImportance;
  applicationField: string;
  productNeeds: string[]; // 产品需求现在存储产品ID
  contactPerson: string;
  contactPhone: string;
  address: string;
  progress: CustomerProgress;
  annualDemand: number;
  
  // 创建人信息 - 表示客户的创建者且永远不会改变
  ownerId: string;
  ownerName?: string;
  ownerType: string; // UserRole类型
  
  // 关联销售信息 - 新增
  relatedSalesId?: string;
  relatedSalesName?: string;
  
  // 关联代理商信息 - 新增
  relatedAgentId?: string;
  relatedAgentName?: string;
  
  isInPublicPool: boolean;
  lastUpdateTime?: string;
  createdAt?: string;
  updatedAt?: string;
  previousOwnerId?: string; // 上一个所有者ID
  previousOwnerName?: string; // 上一个所有者名称
  previousOwnerType?: string; // 上一个所有者类型
}

// 产品类型
export interface Product {
  _id?: string;
  modelName: string;
  packageType: string;
  stock: number;
  pricing: PricingTier[];
  createdAt?: Date;
  updatedAt?: Date;
}

// 产品价格阶梯
export interface PricingTier {
  quantity: number;
  price: number;
}

// 权限类型
export interface Permissions {
  [key: string]: string[];
}

// 跟进记录类型
export interface FollowUpRecord {
  _id?: string;
  customerId: string;
  title: string;
  content: string;
  creatorId: string;
  creatorName: string;
  creatorType: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AssignableUsers {
  agents: AgentBrief[];
  salesUsers: UserBrief[];
}


// 用户简要信息类型(用于选择列表)
export interface UserBrief {
  _id: string;
  username: string;
  role: UserRole;
}

// 代理商简要信息类型(用于选择列表) 
export interface AgentBrief {
  _id: string;
  companyName: string;
  contactPerson: string;
  relatedSalesId?: string;
  relatedSalesName?:string;
}

// 审批请求参数类型
export interface ApprovalRequest {
  id: string;
  type: 'user' | 'agent';
  approved: boolean;
  reason?: string;
}

// 用户创建请求类型
export interface CreateUserRequest {
  username: string;
  password: string;
  phone: string;
  role: UserRole;
}

// 用户更新请求类型
export interface UpdateUserRequest {
  username?: string;
  password?: string;
  phone?: string;
  role?: UserRole;
}

// 客户分配历史记录
export interface CustomerAssignmentHistory {
  _id?: string;
  customerId: string;
  customerName: string;
  
  // 新的销售关联字段
  fromRelatedSalesId?: string;
  fromRelatedSalesName?: string;
  toRelatedSalesId?: string;
  toRelatedSalesName?: string;
  
  // 新的代理商关联字段
  fromRelatedAgentId?: string;
  fromRelatedAgentName?: string;
  toRelatedAgentId?: string;
  toRelatedAgentName?: string;
  
  operatorId: string;
  operatorName: string;
  operationType: '移入公海池' | '跟进' | '分配' | '新建跟进' | '新建分配' | '认领'; // 更新了可能的操作类型
  createdAt?: string;
  updatedAt?: string;
  remark?: string;
}

// 公海客户响应类型
export interface PublicPoolCustomer {
  _id: string;
  name: string;
  nature: CustomerNature;
  applicationField: string;
  address: string;
  enterPoolTime: Date;
  previousOwnerName?: string;
  previousOwnerType?: string;
  // 添加创建人信息
  creatorId?: string;
  creatorName?: string;
  creatorType?: string;
  createdAt?: Date;
}

// 客户分配请求类型 - 更新以支持同时分配销售和代理商
export interface CustomerAssignRequest {
  salesId: string; // 必填
  agentId?: string; // 可选
}

// 公海客户分配请求类型
export interface PublicPoolAssignRequest {
  targetId: string;
  targetType: UserRole.FACTORY_SALES | UserRole.AGENT;
}

// 登录请求参数类型
export interface LoginRequest {
  username: string;  // 可以是用户名或代理商公司名称
  password: string;
}

// 登录响应类型
export interface LoginResponse {
  token: string;
  user: User | Agent;
}

// 数据看板时间范围类型
export type DashboardTimeRange = 'week' | 'current_week' | 'month' | 'quarter' | 'year' | 'custom';

// 数据看板请求参数类型
export interface DashboardStatsRequest {
  timeRange: DashboardTimeRange;
  startDate?: string;
  endDate?: string;
}

// 数据看板响应类型
export interface DashboardDataResponse {
  customerCount: number;
  productCount: number;
  agentCount: number;
  projectCount: number; // 新增：项目总数
  
  // 客户维度统计（去掉客户进展状态）
  customerImportance: ChartDataItem[];
  customerNature: ChartDataItem[];
  
  // 产品维度统计（去掉产品与客户进展阶段关系）
  productPackageType: ChartDataItem[];
  productStockLevel: ChartDataItem[];
  productCustomerRelation: ChartDataItem[];
  productProjectRelation: ChartDataItem[]; // 新增：产品项目关联数量Top10
  
  // 新增：项目维度统计
  projectProgressDistribution: ChartDataItem[]; // 项目按进展状态分布
  projectBatchTotalStats: ProjectBatchStats; // 批量总额统计
  projectSmallBatchTotalStats: ProjectBatchStats; // 小批量总额统计
  projectMonthlyStats: ProjectMonthlyStats[]; // 项目月度统计
  topProjectsByValue: ProjectValueItem[]; // 按金额排序的项目Top10
}

// 图表数据项类型
export interface ChartDataItem {
  name: string;
  value: number;
}

// 新增：项目批次统计类型
export interface ProjectBatchStats {
  totalAmount: number; // 总金额（万元）
  totalProjects: number; // 项目总数
  maxAmount: number; // 最大金额（万元）
  minAmount: number; // 最小金额（万元）
  // 删除 averageAmount 字段
}

// 新增：项目月度统计类型
export interface ProjectMonthlyStats {
  month: string; // 月份，格式：YYYY-MM
  projectCount: number; // 项目数量
  totalAmount: number; // 总金额（万元）
  batchAmount: number; // 批量总额（万元）
  smallBatchAmount: number; // 小批量总额（万元）
}

// 新增：项目价值排行类型
export interface ProjectValueItem {
  projectName: string;
  customerName: string;
  productName?: string; // 产品名称（型号/封装）
  smallBatchTotal: number; // 小批量总额（万元）
  massProductionTotal: number; // 批量总额（万元）
  totalValue: number; // 总价值（批量+小批量，万元）
  progress: string; // 项目进展
}

// 项目进展枚举 - 恢复完整的项目阶段状态
export enum ProjectProgress {
  SAMPLE_EVALUATION = '样板评估',
  TESTING = '打样测试', 
  SMALL_BATCH = '小批量导入',
  MASS_PRODUCTION = '批量出货',
  ABANDONED = '废弃'
}

// 项目类型 - 更新为支持多文件
export interface Project {
  _id?: string;
  projectName: string;
  customerId: string;
  customerName: string;
  creatorId: string;
  creatorName: string;
  updaterId?: string;
  updaterName?: string;
  productId: string;
  productName: string;
  batchNumber: string;
  projectProgress: ProjectProgress;
  startDate: Date | dayjs.Dayjs; // 项目开始时间，必填字段
  
  // 小批量相关字段 - 改为数组支持多文件
  smallBatchPrice?: number;
  smallBatchQuantity?: number;
  smallBatchTotal?: number; // 自动计算，单位万元
  smallBatchAttachments?: FileAttachment[]; // 改为数组
  
  // 批量出货相关字段 - 改为数组支持多文件
  massProductionPrice?: number;
  massProductionQuantity?: number;
  massProductionTotal?: number; // 自动计算，单位万元
  paymentTerm?: string;
  massProductionAttachments?: FileAttachment[]; // 改为数组
  
  remark?: string;
  createdAt?: Date;
  updatedAt?: Date;
}


// 文件附件类型
export interface FileAttachment {
  id: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  fileType: string;
  uploadTime: Date;
  uploadedBy: string;
  url: string;
}

// 项目跟进记录类型 - 新增
export interface ProjectFollowUpRecord {
  _id?: string;
  projectId: string;
  title: string;
  content: string;
  creatorId: string;
  creatorName: string;
  creatorType: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// 项目进展历史记录类型 - 新增
export interface ProjectProgressHistory {
  _id?: string;
  projectId: string;
  projectName: string;
  fromProgress: string;
  toProgress: string;
  operatorId: string;
  operatorName: string;
  remark?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PublicCustomer {
  _id: string;
  name: string;
  nature: string;
  importance: string;
  applicationField: string;
  progress: string;
  address: string;
  productNeeds: string[];
  enterPoolTime: string;
  creatorId: string;
  creatorName: string;
  creatorType: string;
  createdAt: string;
}

export interface PublicPoolResponse {
  publicCustomers: PublicCustomer[];
}

// 系统配置相关类型 - 新增
export interface SystemConfig {
  id?: string;
  configType: ConfigType;
  configKey: string;
  configValue: any;
  description: string;
  isEnabled: boolean;
  creatorId: string;
  creatorName: string;
  updaterId?: string;
  updaterName?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// 配置类型枚举 - 简化版本，移除系统通知和业务规则
export enum ConfigType {
  CUSTOMER_AUTO_TRANSFER = 'customer_auto_transfer' // 只保留客户自动转移配置
}

// 客户自动转移配置值类型 - 简化版本，移除进展阶段字段
export interface CustomerAutoTransferConfig {
  daysWithoutProgress: number;     // 无进展天数
  targetSalesId: string;           // 目标销售ID
  targetSalesName: string;         // 目标销售名称
}

export interface ConfigValueItem {
  Key: 'daysWithoutProgress' | 'targetSalesId' | 'targetSalesName';
  Value: any;
}


// 配置创建请求类型 - 新增
export interface CreateConfigRequest {
  configType: ConfigType;
  configKey: string;
  configValue: any;
  description: string;
  isEnabled?: boolean;
}

// 配置更新请求类型 - 新增
export interface UpdateConfigRequest {
  configValue?: any;
  description?: string;
  isEnabled?: boolean;
}