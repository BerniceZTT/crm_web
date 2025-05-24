/**
 * 客户公海相关路由
 * 包含公海客户查询和分配功能，支持更丰富的筛选条件
 */

import { Hono } from "hono";
import { zValidator } from '@hono/zod-validator';
import { z } from "zod";
import { authMiddleware } from "../utils/auth";
import { CustomerProgress, UserRole, CustomerImportance } from "../../shared/types";
import { addAssignmentHistory } from "./customerAssignments"; // 引入统一的历史记录方法
import { canAssignPublicPoolCustomer } from "../../shared/auth";

const publicPoolRouter = new Hono();

// 所有路由都需要认证
publicPoolRouter.use('*', authMiddleware);

// 获取公海客户列表
publicPoolRouter.get('/', async (c) => {
  const query = c.req.query();
  const keyword = query.keyword || '';
  const nature = query.nature || '';
  const importance = query.importance || '';
  const progress = query.progress || '';
  const applicationField = query.applicationField || '';
  
  try {
    console.log('公海客户查询条件:', { keyword, nature, importance, progress, applicationField });
    
    const collection = db.collection('4d2a803d_customers');
    
    // 构建查询
    const filter: any = { 
      isInPublicPool: true
    };
    
    // 始终包含进入公海状态的客户
    filter.progress = CustomerProgress.PUBLIC_POOL;
    
    // 关键词搜索 - 仅搜索客户名称
    if (keyword && keyword.trim() !== '') {
      filter.name = { $regex: keyword.trim(), $options: 'i' };
      console.log('设置客户名称搜索条件:', keyword);
    }
    
    // 客户性质筛选
    if (nature) {
      filter.nature = nature;
      console.log('设置客户性质筛选条件:', nature);
    }
    
    // 客户重要性筛选
    if (importance) {
      filter.importance = importance;
      console.log('设置客户重要性筛选条件:', importance);
    }
    
    // 应用领域筛选
    if (applicationField) {
      filter.applicationField = { $regex: applicationField, $options: 'i' };
      console.log('设置应用领域筛选条件:', applicationField);
    }
    
    console.log('最终查询条件:', JSON.stringify(filter));
    
    // 查询所有公海客户
    const publicCustomers = await collection.find(filter).toArray();
    console.log(`查询到符合条件的公海客户数量: ${publicCustomers.length}`);
    
    // 返回完整的客户信息
    const filteredCustomers = publicCustomers.map(customer => ({
      _id: customer._id,
      name: customer.name,
      nature: customer.nature,
      importance: customer.importance,  // 添加客户重要性
      applicationField: customer.applicationField,
      progress: customer.progress,      // 添加客户进展
      address: customer.address,
      productNeeds: customer.productNeeds || [], // 添加产品需求
      enterPoolTime: customer.lastUpdateTime || customer.updatedAt,
      previousOwnerName: customer.previousOwnerName,
      previousOwnerType: customer.previousOwnerType,
      previousRelatedSalesName: customer.previousRelatedSalesName,
      previousRelatedAgentName: customer.previousRelatedAgentName,
      // 添加创建人信息
      creatorId: customer.ownerId,
      creatorName: customer.ownerName,
      creatorType: customer.ownerType,
      createdAt: customer.createdAt
    }));
    
    return c.json({ publicCustomers: filteredCustomers });
  } catch (error) {
    console.error("获取公海客户列表出错:", error.message);
    return c.json({ error: "获取公海客户列表失败" }, 500);
  }
});

// 获取可分配的销售人员列表
publicPoolRouter.get('/assignable-users', 
  async (c, next) => {
    const user = c.get('user');
    if (!canAssignPublicPoolCustomer(user.role)) {
      return c.json({ error: "无权获取可分配用户列表" }, 403);
    }
    await next();
  }, 
  async (c) => {
    try {
      // 获取销售人员列表
      const salesCollection = db.collection('4d2a803d_users');
      const salesUsers = await salesCollection.find({ 
        role: UserRole.FACTORY_SALES,
        status: 'approved'
      }).project({
        _id: 1,
        username: 1,
        role: 1
      }).toArray();
      
      // 获取代理商列表，现在包含关联销售ID
      const agentsCollection = db.collection('4d2a803d_agents');
      const agents = await agentsCollection.find({ 
        status: 'approved' 
      }).project({
        _id: 1,
        companyName: 1,
        contactPerson: 1,
        relatedSalesId: 1,        // 新增：返回关联销售ID
        relatedSalesName: 1       // 新增：返回关联销售名称
      }).toArray();
      
      return c.json({
        salesUsers,
        agents
      });
    } catch (error) {
      console.error("获取可分配用户列表出错:", error.message);
      return c.json({ error: "获取可分配用户列表失败" }, 500);
    }
  }
);

// 添加缺失的schema定义
const assignPublicPoolSchema = z.object({
  targetId: z.string().min(1, "目标ID不能为空"),
  targetType: z.enum([UserRole.FACTORY_SALES, UserRole.AGENT], {
    errorMap: () => ({ message: "目标类型必须是销售或代理商" })
  })
});

// 从公海分配客户
publicPoolRouter.post('/:id/assign', zValidator('json', assignPublicPoolSchema), async (c) => {
  const customerId = c.req.param('id');
  const currentUser = c.get('user');
  const { targetId, targetType } = await c.req.json();
  
  try {
    // ... 保留现有代码 ...
  } catch (error) {
    // ... 保留现有代码 ...
  }
});

export default publicPoolRouter;