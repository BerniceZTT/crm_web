/**
 * 库存管理相关路由
 * 处理库存操作记录的查询
 */

import { Hono } from "hono";
import { zValidator } from '@hono/zod-validator';
import { z } from "zod";
import { authMiddleware } from "../utils/auth";
import { UserRole } from "../../shared/types";

const inventoryRouter = new Hono();

// 所有路由都需要认证
inventoryRouter.use('*', authMiddleware);

// 创建库存操作记录集合结构
/**
 * 库存操作记录表
 * 记录产品库存的所有入库和出库操作
 */
interface InventoryRecord {
  productId: string;
  modelName: string;
  packageType: string;
  operationType: 'in' | 'out';
  quantity: number;
  reason?: string;
  operator: string;
  operatorId: string;
  operationTime: Date;
}

// 获取库存操作记录
inventoryRouter.get('/records', async (c) => {
  const currentUser = c.get('user');
  
  // 验证权限
  if (currentUser.role !== UserRole.SUPER_ADMIN && 
      currentUser.role !== UserRole.INVENTORY_MANAGER) {
    return c.json({ error: "无权查看库存记录" }, 403);
  }
  
  const query = c.req.query();
  const page = parseInt(query.page || '1');
  const limit = parseInt(query.limit || '20');
  const skip = (page - 1) * limit;
  
  // 筛选条件
  const searchQuery: any = {};
  
  if (query.productId) {
    searchQuery.productId = query.productId;
  }
  
  // 新增: 按产品型号搜索
  if (query.modelName) {
    searchQuery.modelName = { $regex: query.modelName, $options: 'i' };
  }
  
  // 修改: 按操作类型筛选
  if (query.operationType && query.operationType !== 'all') {
    searchQuery.operationType = query.operationType;
  }
  
  // 时间范围筛选 - 支持自定义日期
  if (query.startDate && query.endDate) {
    // 转换为日期对象
    const startDate = new Date(query.startDate);
    // 结束日期设置为当天的23:59:59
    const endDate = new Date(query.endDate);
    endDate.setHours(23, 59, 59, 999);
    
    searchQuery.operationTime = { $gte: startDate, $lte: endDate };
    console.log(`使用自定义日期范围: ${startDate.toISOString()} 至 ${endDate.toISOString()}`);
  } else {
    // 使用天数
    const days = parseInt(query.days || '30');
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    searchQuery.operationTime = { $gte: fromDate };
    console.log(`使用最近${days}天筛选`);
  }
  
  try {
    console.log('库存记录查询条件:', JSON.stringify(searchQuery));
    
    const collection = db.collection('4d2a803d_inventory_records');
    
    // 获取总数
    const totalCount = await collection.countDocuments(searchQuery);
    
    // 查询数据
    const records = await collection.find(searchQuery)
      .sort({ operationTime: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    
    console.log(`查询到 ${records.length} 条库存记录，总记录数: ${totalCount}`);
    
    return c.json({
      records,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error("获取库存记录出错:", error.message);
    return c.json({ error: "获取库存记录失败: " + error.message }, 500);
  }
});

// 获取库存统计信息
inventoryRouter.get('/stats', async (c) => {
  const currentUser = c.get('user');
  
  // 验证权限
  if (currentUser.role !== UserRole.SUPER_ADMIN && 
      currentUser.role !== UserRole.INVENTORY_MANAGER) {
    return c.json({ error: "无权查看库存统计" }, 403);
  }
  
  try {
    const productsCollection = db.collection('4d2a803d_products');
    
    // 获取总产品数
    const totalProducts = await productsCollection.countDocuments();
    
    // 获取低库存产品数
    const lowStockProducts = await productsCollection.countDocuments({ stock: { $lt: 50 } });
    
    // 获取总库存量
    const stockResult = await productsCollection.aggregate([
      { $group: { _id: null, totalStock: { $sum: "$stock" } } }
    ]).toArray();
    
    const totalStock = stockResult.length > 0 ? stockResult[0].totalStock : 0;
    
    // 获取最近30天的库存变动
    const recordsCollection = db.collection('4d2a803d_inventory_records');
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);
    
    const inOperations = await recordsCollection.aggregate([
      { $match: { operationType: 'in', operationTime: { $gte: fromDate } } },
      { $group: { _id: null, total: { $sum: "$quantity" } } }
    ]).toArray();
    
    const outOperations = await recordsCollection.aggregate([
      { $match: { operationType: 'out', operationTime: { $gte: fromDate } } },
      { $group: { _id: null, total: { $sum: "$quantity" } } }
    ]).toArray();
    
    const totalIn = inOperations.length > 0 ? inOperations[0].total : 0;
    const totalOut = outOperations.length > 0 ? outOperations[0].total : 0;
    
    return c.json({
      totalProducts,
      lowStockProducts,
      totalStock,
      recentChanges: {
        in: totalIn,
        out: totalOut,
        net: totalIn - totalOut
      }
    });
  } catch (error) {
    console.error("获取库存统计出错:", error.message);
    return c.json({ error: "获取库存统计失败" }, 500);
  }
});

export default inventoryRouter;