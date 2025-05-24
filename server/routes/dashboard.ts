/**
 * 数据看板相关路由
 * 处理统计数据和图表数据的生成
 */

import { Hono } from "hono";
import { authMiddleware } from "../utils/auth";
import { 
  CustomerNature, 
  CustomerImportance, 
  CustomerProgress,
  UserRole 
} from "../../shared/types";
import { successResponse, errorResponse } from "../utils/apiResponse";
import { logApiRequest, logError } from "../utils/logger";

const dashboardRouter = new Hono();

// 所有路由都需要认证
dashboardRouter.use('*', authMiddleware);

// 获取总览数据
dashboardRouter.get('/', async (c) => {
  const currentUser = c.get('user');
  const query = c.req.query();
  const timeRange = query.timeRange || 'month';
  
  logApiRequest('GET', '/api/dashboard', { timeRange }, null);
  console.log(`获取数据看板信息 - 用户: ${currentUser.username}, 时间范围: ${timeRange}`);
  
  try {
    // 基于用户角色构建查询条件
    let customerQuery: any = {};
    
    if (currentUser.role === UserRole.FACTORY_SALES) {
      // 销售可以看到自己的和关联代理商的客户
      const agentsCollection = db.collection('4d2a803d_agents');
      const relatedAgents = await agentsCollection
        .find({ relatedSalesId: currentUser.id })
        .project({ _id: 1 })
        .toArray();
      
      const agentIds = relatedAgents.map(agent => agent._id.toString());
      
      customerQuery.$or = [
        { ownerId: currentUser.id, ownerType: UserRole.FACTORY_SALES },
        { ownerId: { $in: agentIds }, ownerType: UserRole.AGENT }
      ];
    } else if (currentUser.role === UserRole.AGENT) {
      // 代理商只能看到自己的客户
      customerQuery.ownerId = currentUser.id;
      customerQuery.ownerType = UserRole.AGENT;
    }
    
    // 收集统计数据
    const customersCollection = db.collection('4d2a803d_customers');
    const agentsCollection = db.collection('4d2a803d_agents');
    const productsCollection = db.collection('4d2a803d_products');
    const usersCollection = db.collection('4d2a803d_users');
    
    // 计算客户总数
    const totalCustomers = await customersCollection.countDocuments(customerQuery);
    
    // 客户公海数量
    const publicPoolCount = await customersCollection.countDocuments({ 
      isInPublicPool: true 
    });
    
    // 产品总数
    const totalProducts = await productsCollection.countDocuments({});
    
    // 用户总数（根据角色）
    let userCounts = {};
    
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      // 超级管理员可以看到所有用户统计
      const usersRoleCounts = await usersCollection.aggregate([
        { $match: { status: "approved" } },
        { $group: { _id: "$role", count: { $sum: 1 } } }
      ]).toArray();
      
      userCounts = usersRoleCounts.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {});
      
      // 获取代理商数量
      const agentCount = await agentsCollection.countDocuments({ status: "approved" });
      userCounts[UserRole.AGENT] = agentCount;
    } else if (currentUser.role === UserRole.FACTORY_SALES) {
      // 销售只能看到关联代理商数量
      const agentCount = await agentsCollection.countDocuments({ 
        relatedSalesId: currentUser.id,
        status: "approved" 
      });
      userCounts[UserRole.AGENT] = agentCount;
    }
    
    // 统计库存预警产品数量
    const lowStockThreshold = 100; // 假设低于100为库存预警
    const lowStockCount = await productsCollection.countDocuments({
      stock: { $lt: lowStockThreshold }
    });
    
    // 客户类型分布
    let customerDistribution = null;
    if (currentUser.role !== UserRole.INVENTORY_MANAGER) {
      customerDistribution = await customersCollection.aggregate([
        { $match: customerQuery },
        { $group: { _id: "$nature", count: { $sum: 1 } } }
      ]).toArray();
    }
    
    // 构建统计数据响应
    const statistics = {
      customers: {
        total: totalCustomers,
        publicPool: publicPoolCount,
        distribution: customerDistribution ? customerDistribution.map(item => ({
          type: item._id,
          count: item.count
        })) : []
      },
      products: {
        total: totalProducts,
        lowStock: lowStockCount
      },
      users: userCounts
    };
    
    return successResponse(c, { statistics });
  } catch (error) {
    logError(error, {
      endpoint: '/api/dashboard',
      timeRange,
      userId: currentUser.id,
      userRole: currentUser.role
    });
    return errorResponse(c, `获取总览数据失败: ${error.message}`, 500);
  }
});

// 获取客户分布数据
dashboardRouter.get('/customer-distribution', async (c) => {
  const currentUser = c.get('user');
  
  // 库存管理员无权查看客户数据
  if (currentUser.role === UserRole.INVENTORY_MANAGER) {
    return errorResponse(c, "无权访问客户数据", 403);
  }
  
  try {
    // 基于用户角色构建查询条件
    let customerQuery: any = {};
    
    if (currentUser.role === UserRole.FACTORY_SALES) {
      // 销售可以看到自己的和关联代理商的客户
      const agentsCollection = db.collection('4d2a803d_agents');
      const relatedAgents = await agentsCollection
        .find({ relatedSalesId: currentUser.id })
        .project({ _id: 1 })
        .toArray();
      
      const agentIds = relatedAgents.map(agent => agent._id.toString());
      
      customerQuery.$or = [
        { ownerId: currentUser.id, ownerType: UserRole.FACTORY_SALES },
        { ownerId: { $in: agentIds }, ownerType: UserRole.AGENT }
      ];
    } else if (currentUser.role === UserRole.AGENT) {
      // 代理商只能看到自己的客户
      customerQuery.ownerId = currentUser.id;
      customerQuery.ownerType = UserRole.AGENT;
    }
    
    const customersCollection = db.collection('4d2a803d_customers');
    
    // 客户性质分布
    const natureDistribution = await customersCollection.aggregate([
      { $match: customerQuery },
      { $group: { _id: "$nature", count: { $sum: 1 } } }
    ]).toArray();
    
    // 客户重要程度分布
    const importanceDistribution = await customersCollection.aggregate([
      { $match: customerQuery },
      { $group: { _id: "$importance", count: { $sum: 1 } } }
    ]).toArray();
    
    // 客户进展阶段分布
    const progressDistribution = await customersCollection.aggregate([
      { $match: customerQuery },
      { $group: { _id: "$progress", count: { $sum: 1 } } }
    ]).toArray();
    
    // 应用领域分布
    const fieldDistribution = await customersCollection.aggregate([
      { $match: customerQuery },
      { $group: { _id: "$applicationField", count: { $sum: 1 } } }
    ]).toArray();
    
    // 格式化数据为前端图表需要的格式
    const formatDistribution = (data, labelMap = {}) => {
      return data.map(item => ({
        name: labelMap[item._id] || item._id,
        value: item.count
      }));
    };
    
    // 枚举值的显示名称映射
    const natureMap = {
      [CustomerNature.LISTED]: "民营上市公司",
      [CustomerNature.SME]: "民营中小企业",
      [CustomerNature.RESEARCH]: "科研院所",
      [CustomerNature.STATE_OWNED]: "国央企"
    };
    
    const importanceMap = {
      [CustomerImportance.A]: "A类客户",
      [CustomerImportance.B]: "B类客户",
      [CustomerImportance.C]: "C类客户"
    };
    
    const progressMap = {
      [CustomerProgress.SAMPLE_EVALUATION]: "样板评估",
      [CustomerProgress.TESTING]: "打样测试",
      [CustomerProgress.SMALL_BATCH]: "小批量导入",
      [CustomerProgress.MASS_PRODUCTION]: "批量出货",
      [CustomerProgress.PUBLIC_POOL]: "进入公海"
    };
    
    return successResponse(c, {
      natureDistribution: formatDistribution(natureDistribution, natureMap),
      importanceDistribution: formatDistribution(importanceDistribution, importanceMap),
      progressDistribution: formatDistribution(progressDistribution, progressMap),
      fieldDistribution: formatDistribution(fieldDistribution)
    });
  } catch (error) {
    logError(error, { 
      endpoint: '/api/dashboard/customer-distribution',
      userId: currentUser.id,
      userRole: currentUser.role
    });
    return errorResponse(c, `获取客户分布数据失败: ${error.message}`, 500);
  }
});

// 获取月度数据统计
dashboardRouter.get('/monthly-stats', async (c) => {
  const currentUser = c.get('user');
  const query = c.req.query();
  const timeRange = query.timeRange || 'month';
  
  try {
    // 获取过去12个月的日期范围
    const monthLabels = [];
    const startDates = [];
    const endDates = [];
    
    const today = new Date();
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(today);
      monthDate.setMonth(today.getMonth() - i);
      
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      
      const monthLabel = `${year}-${(month + 1).toString().padStart(2, '0')}`;
      
      monthLabels.push(monthLabel);
      startDates.push(startDate);
      endDates.push(endDate);
    }
    
    // 基于用户角色构建查询条件
    let customerQuery: any = {};
    
    if (currentUser.role === UserRole.FACTORY_SALES) {
      // 销售可以看到自己的和关联代理商的客户
      const agentsCollection = db.collection('4d2a803d_agents');
      const relatedAgents = await agentsCollection
        .find({ relatedSalesId: currentUser.id })
        .project({ _id: 1 })
        .toArray();
      
      const agentIds = relatedAgents.map(agent => agent._id.toString());
      
      customerQuery.$or = [
        { ownerId: currentUser.id, ownerType: UserRole.FACTORY_SALES },
        { ownerId: { $in: agentIds }, ownerType: UserRole.AGENT }
      ];
    } else if (currentUser.role === UserRole.AGENT) {
      // 代理商只能看到自己的客户
      customerQuery.ownerId = currentUser.id;
      customerQuery.ownerType = UserRole.AGENT;
    }
    
    const customersCollection = db.collection('4d2a803d_customers');
    
    // 统计每月新增客户数
    const newCustomerStats = [];
    
    for (let i = 0; i < 12; i++) {
      const monthQuery = {
        ...customerQuery,
        createdAt: {
          $gte: startDates[i],
          $lte: endDates[i]
        }
      };
      
      const count = await customersCollection.countDocuments(monthQuery);
      newCustomerStats.push(count);
    }
    
    // 如果是库存管理员或超级管理员，获取库存变化数据
    let stockChangeStats = null;
    
    if (currentUser.role === UserRole.INVENTORY_MANAGER || 
        currentUser.role === UserRole.SUPER_ADMIN) {
      // 实际库存变动数据
      const recordsCollection = db.collection('4d2a803d_inventory_records');
      stockChangeStats = [];
      
      // 计算每个月的净库存变化
      for (let i = 0; i < 12; i++) {
        // 入库总数
        const inResult = await recordsCollection.aggregate([
          { 
            $match: { 
              operationType: 'in',
              operationTime: { $gte: startDates[i], $lte: endDates[i] }
            } 
          },
          { $group: { _id: null, total: { $sum: '$quantity' } } }
        ]).toArray();
        
        // 出库总数
        const outResult = await recordsCollection.aggregate([
          { 
            $match: { 
              operationType: 'out',
              operationTime: { $gte: startDates[i], $lte: endDates[i] }
            } 
          },
          { $group: { _id: null, total: { $sum: '$quantity' } } }
        ]).toArray();
        
        const inTotal = inResult.length > 0 ? inResult[0].total : 0;
        const outTotal = outResult.length > 0 ? outResult[0].total : 0;
        
        // 净变化 = 入库 - 出库
        stockChangeStats.push(inTotal - outTotal);
      }
    } else {
      // 非库存相关角色给个空数组
      stockChangeStats = Array(12).fill(0);
    }
    
    // 客户进展阶段变化
    let progressChangeStats = null;
    
    if (currentUser.role !== UserRole.INVENTORY_MANAGER) {
      progressChangeStats = {
        sampleEvaluation: [],
        testing: [],
        smallBatch: [],
        massProduction: []
      };
      
      for (let i = 0; i < 12; i++) {
        // 样板评估阶段
        const sampleQuery = {
          ...customerQuery,
          progress: CustomerProgress.SAMPLE_EVALUATION,
          lastUpdateTime: {
            $gte: startDates[i],
            $lte: endDates[i]
          }
        };
        
        // 打样测试阶段
        const testingQuery = {
          ...customerQuery,
          progress: CustomerProgress.TESTING,
          lastUpdateTime: {
            $gte: startDates[i],
            $lte: endDates[i]
          }
        };
        
        // 小批量导入阶段
        const smallBatchQuery = {
          ...customerQuery,
          progress: CustomerProgress.SMALL_BATCH,
          lastUpdateTime: {
            $gte: startDates[i],
            $lte: endDates[i]
          }
        };
        
        // 批量出货阶段
        const massProductionQuery = {
          ...customerQuery,
          progress: CustomerProgress.MASS_PRODUCTION,
          lastUpdateTime: {
            $gte: startDates[i],
            $lte: endDates[i]
          }
        };
        
        progressChangeStats.sampleEvaluation.push(
          await customersCollection.countDocuments(sampleQuery)
        );
        
        progressChangeStats.testing.push(
          await customersCollection.countDocuments(testingQuery)
        );
        
        progressChangeStats.smallBatch.push(
          await customersCollection.countDocuments(smallBatchQuery)
        );
        
        progressChangeStats.massProduction.push(
          await customersCollection.countDocuments(massProductionQuery)
        );
      }
    }
    
    return successResponse(c, {
      monthLabels,
      newCustomerStats,
      stockChangeStats,
      progressChangeStats
    });
  } catch (error) {
    logError(error, {
      endpoint: '/api/dashboard/monthly-stats',
      timeRange,
      userId: currentUser.id,
      userRole: currentUser.role
    });
    return errorResponse(c, `获取月度统计数据失败: ${error.message}`, 500);
  }
});

// 获取产品需求统计
dashboardRouter.get('/product-demand', async (c) => {
  const currentUser = c.get('user');
  
  try {
    const customersCollection = db.collection('4d2a803d_customers');
    const productsCollection = db.collection('4d2a803d_products');
    
    // 获取所有产品型号
    const products = await productsCollection.find({})
      .project({ modelName: 1, packageType: 1 })
      .toArray();
    
    // 基于用户角色构建查询条件
    let customerQuery: any = {};
    
    if (currentUser.role === UserRole.FACTORY_SALES) {
      // 销售可以看到自己的和关联代理商的客户
      const agentsCollection = db.collection('4d2a803d_agents');
      const relatedAgents = await agentsCollection
        .find({ relatedSalesId: currentUser.id })
        .project({ _id: 1 })
        .toArray();
      
      const agentIds = relatedAgents.map(agent => agent._id.toString());
      
      customerQuery.$or = [
        { ownerId: currentUser.id, ownerType: UserRole.FACTORY_SALES },
        { ownerId: { $in: agentIds }, ownerType: UserRole.AGENT }
      ];
    } else if (currentUser.role === UserRole.AGENT) {
      // 代理商只能看到自己的客户
      customerQuery.ownerId = currentUser.id;
      customerQuery.ownerType = UserRole.AGENT;
    }
    
    // 获取有效客户的年需求量(非公海客户)
    customerQuery.isInPublicPool = false;
    
    // 聚合产品需求数据
    const productDemandData = [];
    
    for (const product of products) {
      const productQuery = {
        ...customerQuery,
        productNeeds: { $elemMatch: { $regex: product.modelName } }
      };
      
      // 获取该产品的客户数量
      const customerCount = await customersCollection.countDocuments(productQuery);
      
      // 获取该产品的总需求量
      const demandResult = await customersCollection.aggregate([
        { $match: productQuery },
        { $group: { _id: null, totalDemand: { $sum: "$annualDemand" } } }
      ]).toArray();
      
      const totalDemand = demandResult.length > 0 ? demandResult[0].totalDemand : 0;
      
      if (customerCount > 0) {
        productDemandData.push({
          productName: `${product.modelName}/${product.packageType}`,
          customerCount,
          totalDemand
        });
      }
    }
    
    // 按需求量排序
    productDemandData.sort((a, b) => b.totalDemand - a.totalDemand);
    
    return successResponse(c, { productDemandData });
  } catch (error) {
    logError(error, {
      endpoint: '/api/dashboard/product-demand',
      userId: currentUser.id,
      userRole: currentUser.role
    });
    return errorResponse(c, `获取产品需求统计失败: ${error.message}`, 500);
  }
});

export default dashboardRouter;