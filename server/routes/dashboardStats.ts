/**
 * 数据看板统计路由
 * 提供真实数据的统计接口，取代模拟数据
 */

import { Hono } from "hono";
import { authMiddleware } from "../utils/auth";
import { 
  CustomerNature, 
  CustomerImportance, 
  CustomerProgress,
  UserRole,
  DashboardDataResponse
} from "../../shared/types";
import { successResponse, errorResponse } from "../utils/apiResponse";
import { logApiRequest, logError } from "../utils/logger";

const dashboardStatsRouter = new Hono();

// 所有路由都需要认证
dashboardStatsRouter.use('*', authMiddleware);

// 获取数据看板统计信息
dashboardStatsRouter.get('/', async (c) => {
  const currentUser = c.get('user');
  const query = c.req.query();
  const timeRange = query.timeRange || 'month';
  const startDateParam = query.startDate;
  const endDateParam = query.endDate;
  
  logApiRequest('GET', '/api/dashboard-stats', { timeRange, startDate: startDateParam, endDate: endDateParam }, null);
  console.log(`获取数据看板统计信息 - 用户: ${currentUser.username}, 时间范围: ${timeRange}`);
  
  try {
    // 基于用户角色构建查询条件
    let customerQuery: any = {};
    
    if (currentUser.role === UserRole.FACTORY_SALES) {
      // 销售只能看到关联销售为自己的客户
      customerQuery.relatedSalesId = currentUser.id;
    } else if (currentUser.role === UserRole.AGENT) {
      // 代理商只能看到关联代理商为自己的客户
      customerQuery.relatedAgentId = currentUser.id;
    }
    
    // 根据时间范围参数设置日期筛选
    let dateFilter: any = {};
    const today = new Date();
    
    if (timeRange === 'custom' && startDateParam && endDateParam) {
      // 自定义日期范围
      const startDate = new Date(startDateParam);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(endDateParam);
      endDate.setHours(23, 59, 59, 999);
      
      dateFilter = {
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      };
    } else if (timeRange === 'week') {
      // 近7天
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      dateFilter = {
        createdAt: {
          $gte: sevenDaysAgo
        }
      };
    } else if (timeRange === 'current_week') {
      // 本周（从周一到今天）
      const currentDay = today.getDay(); // 0 是周日, 1-6 是周一到周六
      const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1; // 计算从周一到今天的天数
      
      const thisWeekMonday = new Date(today);
      thisWeekMonday.setDate(today.getDate() - daysSinceMonday);
      thisWeekMonday.setHours(0, 0, 0, 0);
      
      dateFilter = {
        createdAt: {
          $gte: thisWeekMonday
        }
      };
    } else if (timeRange === 'month') {
      // 近30天
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      dateFilter = {
        createdAt: {
          $gte: thirtyDaysAgo
        }
      };
    } else if (timeRange === 'quarter') {
      // 近3个月
      const threeMonthsAgo = new Date(today);
      threeMonthsAgo.setMonth(today.getMonth() - 3);
      dateFilter = {
        createdAt: {
          $gte: threeMonthsAgo
        }
      };
    } else if (timeRange === 'year') {
      // 近1年
      const oneYearAgo = new Date(today);
      oneYearAgo.setFullYear(today.getFullYear() - 1);
      dateFilter = {
        createdAt: {
          $gte: oneYearAgo
        }
      };
    }
    
    // 合并日期筛选条件到客户查询
    customerQuery = { ...customerQuery, ...dateFilter };
    
    // 收集统计数据
    const customersCollection = db.collection('4d2a803d_customers');
    const agentsCollection = db.collection('4d2a803d_agents');
    const productsCollection = db.collection('4d2a803d_products');
    
    // 计算客户总数
    const customerCount = await customersCollection.countDocuments(customerQuery);
    
    // 产品总数
    const productCount = await productsCollection.countDocuments({});
    
    // 代理商数量
    let agentCount;
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      // 超级管理员可以看到所有代理商
      agentCount = await agentsCollection.countDocuments({ 
        status: "approved",
        ...dateFilter  // 应用相同的时间筛选
      });
    } else if (currentUser.role === UserRole.FACTORY_SALES) {
      // 销售只能看到关联销售为自己的代理商
      agentCount = await agentsCollection.countDocuments({ 
        relatedSalesId: currentUser.id,
        status: "approved",
        ...dateFilter  // 应用相同的时间筛选
      });
    } else {
      agentCount = 0;
    }
    
    // 客户重要程度分布
    const importanceDistribution = await customersCollection.aggregate([
      { $match: customerQuery },
      { $group: { _id: "$importance", count: { $sum: 1 } } }
    ]).toArray();
    
    // 客户进展状态分布
    const progressDistribution = await customersCollection.aggregate([
      { $match: customerQuery },
      { $group: { _id: "$progress", count: { $sum: 1 } } }
    ]).toArray();
    
    // 客户性质分布
    const natureDistribution = await customersCollection.aggregate([
      { $match: customerQuery },
      { $group: { _id: "$nature", count: { $sum: 1 } } }
    ]).toArray();
    
    // 格式化数据为前端图表需要的格式
    const formatDistribution = (data: any[]) => {
      return data.map(item => ({
        name: item._id,
        value: item.count
      }));
    };
    
    // 新增：产品包装类型分布
    const packageTypeDistribution = await productsCollection.aggregate([
      { $group: { _id: "$packageType", count: { $sum: 1 } } }
    ]).toArray();
    
    // 新增：产品库存等级分布
    const stockLevels = [
      { level: "库存不足", min: 0, max: 100 },
      { level: "库存适中", min: 101, max: 500 },
      { level: "库存充足", min: 501, max: Infinity }
    ];
    
    const stockLevelDistribution = [];
    
    for (const level of stockLevels) {
      const count = await productsCollection.countDocuments({
        stock: { $gte: level.min, $lte: level.max }
      });
      
      if (count > 0) {
        stockLevelDistribution.push({
          _id: level.level,
          count
        });
      }
    }
    
    // 新增：获取产品客户关联数量分布
    async function getProductCustomerRelation(customerQuery: any) {
      const customersCollection = db.collection('4d2a803d_customers');
      const productsCollection = db.collection('4d2a803d_products');
      
      // 获取所有产品
      const products = await productsCollection.find({})
        .project({ _id: 1, modelName: 1, packageType: 1 })
        .toArray();
      
      // 计算每个产品关联的客户数量
      const productRelationData = [];
      
      for (const product of products) {
        // 查询需要这个产品的客户数量
        const query = {
          ...customerQuery,
          productNeeds: { $elemMatch: { $regex: product._id.toString() } }
        };
        
        const customerCount = await customersCollection.countDocuments(query);
        
        if (customerCount > 0) {
          const productName = `${product.modelName}/${product.packageType}`;
          productRelationData.push({
            name: productName,
            value: customerCount
          });
        }
      }
      
      // 按客户数量排序并取前10名
      return productRelationData
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
    }
    
    // 新增：获取产品按客户进展阶段分布
    async function getProductProgressDistribution(customerQuery: any) {
      const customersCollection = db.collection('4d2a803d_customers');
      const productsCollection = db.collection('4d2a803d_products');
      
      // 获取前5个常用产品
      const topProducts = await productsCollection.find({})
        .project({ _id: 1, modelName: 1, packageType: 1 })
        .limit(5)
        .toArray();
      
      const result = [];
      
      for (const product of topProducts) {
        const productName = `${product.modelName}/${product.packageType}`;
        const productId = product._id.toString();
        
        // 对于每个进展阶段，计算关联了该产品的客户数量
        const sampleCount = await customersCollection.countDocuments({
          ...customerQuery,
          productNeeds: { $elemMatch: { $regex: productId } },
          progress: CustomerProgress.SAMPLE_EVALUATION
        });
        
        const testingCount = await customersCollection.countDocuments({
          ...customerQuery,
          productNeeds: { $elemMatch: { $regex: productId } },
          progress: CustomerProgress.TESTING
        });
        
        const smallBatchCount = await customersCollection.countDocuments({
          ...customerQuery,
          productNeeds: { $elemMatch: { $regex: productId } },
          progress: CustomerProgress.SMALL_BATCH
        });
        
        const massProductionCount = await customersCollection.countDocuments({
          ...customerQuery,
          productNeeds: { $elemMatch: { $regex: productId } },
          progress: CustomerProgress.MASS_PRODUCTION
        });
        
        result.push({
          productName,
          sample: sampleCount,
          testing: testingCount,
          smallBatch: smallBatchCount,
          massProduction: massProductionCount
        });
      }
      
      return result;
    }
    
    // 构建响应数据
    const responseData: DashboardDataResponse = {
      customerCount,
      productCount,
      agentCount,
      customerImportance: formatDistribution(importanceDistribution),
      customerProgress: formatDistribution(progressDistribution),
      customerNature: formatDistribution(natureDistribution),
      // 产品维度的统计数据
      productPackageType: formatDistribution(packageTypeDistribution),
      productStockLevel: formatDistribution(stockLevelDistribution),
      // 新增：产品与客户关系统计
      productCustomerRelation: await getProductCustomerRelation(customerQuery),
      productProgressDistribution: await getProductProgressDistribution(customerQuery)
    };
    
    return successResponse(c, responseData);
  } catch (error) {
    logError(error, {
      endpoint: '/api/dashboard-stats',
      timeRange,
      startDate: startDateParam,
      endDate: endDateParam,
      userId: currentUser.id,
      userRole: currentUser.role
    });
    return errorResponse(c, `获取数据看板统计信息失败: ${error.message}`, 500);
  }
});

export default dashboardStatsRouter;