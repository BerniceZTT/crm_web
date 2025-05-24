/**
 * 客户进展历史记录路由处理文件
 * 提供查询客户进展历史、添加进展历史记录等功能
 */

import { Hono } from 'hono';
import { CustomerProgressHistory } from '../../shared/types';

const router = new Hono();
const COLLECTION_NAME = '4d2a803d_customerProgressHistory';

/**
 * 获取指定客户的进展历史记录
 * GET /api/customer-progress/:customerId
 */
router.get('/:customerId', async (c) => {
  const customerId = c.req.param('customerId');
  console.log(`获取客户 ${customerId} 的进展历史记录`);
  
  try {
    const collection = db.collection(COLLECTION_NAME);
    const progressHistory = await collection.find({ customerId }).sort({ createdAt: -1 }).toArray();
    
    console.log(`成功获取到 ${progressHistory.length} 条进展历史记录`);
    return c.json(progressHistory);
  } catch (error) {
    console.error('获取客户进展历史记录失败:', error.message);
    return c.json({ error: '获取客户进展历史记录失败' }, 500);
  }
});

/**
 * 通用方法：添加客户进展历史记录
 * 可以被其他服务直接调用，不需要通过HTTP请求
 * @param data 进展历史记录数据
 * @returns 插入后的历史记录对象（带_id）
 */
export async function addCustomerProgressHistory(data: Omit<CustomerProgressHistory, '_id' | 'createdAt' | 'updatedAt'>) {
  console.log('添加客户进展历史记录:', data);
  
  // 验证必要字段
  if (!data.customerId || !data.customerName || !data.fromProgress || !data.toProgress || !data.operatorId || !data.operatorName) {
    throw new Error('缺少必要字段');
  }
  
  const collection = db.collection(COLLECTION_NAME);
  const now = new Date();
  const progressHistoryDoc = {
    ...data,
    createdAt: now,
    updatedAt: now
  };
  
  const result = await collection.insertOne(progressHistoryDoc);
  console.log(`成功添加客户进展历史记录，ID: ${result.insertedId}`);
  
  return {
    ...progressHistoryDoc,
    _id: result.insertedId
  };
}

/**
 * 添加客户进展历史记录
 * POST /api/customer-progress
 */
router.post('/', async (c) => {
  try {
    const data = await c.req.json() as Omit<CustomerProgressHistory, '_id' | 'createdAt' | 'updatedAt'>;
    
    // 使用通用方法添加历史记录
    const result = await addCustomerProgressHistory(data);
    
    return c.json(result, 201);
  } catch (error) {
    console.error('添加客户进展历史记录失败:', error.message);
    return c.json({ error: '添加客户进展历史记录失败: ' + error.message }, 500);
  }
});

/**
 * 获取所有客户进展历史记录（可按条件筛选）
 * GET /api/customer-progress
 */
router.get('/', async (c) => {
  try {
    const { startDate, endDate, progress } = c.req.query();
    console.log(`获取客户进展历史记录，筛选条件:`, { startDate, endDate, progress });
    
    const filter: any = {};
    
    // 应用日期过滤
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }
    
    // 应用进展状态过滤
    if (progress) {
      filter.$or = [
        { fromProgress: progress },
        { toProgress: progress }
      ];
    }
    
    const collection = db.collection(COLLECTION_NAME);
    const progressHistory = await collection.find(filter).sort({ createdAt: -1 }).toArray();
    
    console.log(`成功获取到 ${progressHistory.length} 条进展历史记录`);
    return c.json(progressHistory);
  } catch (error) {
    console.error('获取客户进展历史记录失败:', error.message);
    return c.json({ error: '获取客户进展历史记录失败' }, 500);
  }
});

export default router;