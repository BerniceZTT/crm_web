/**
 * 客户跟进记录相关路由
 * 处理跟进记录的CRUD操作
 */

import { Hono } from "hono";
import { zValidator } from '@hono/zod-validator';
import { z } from "zod";
import { authMiddleware } from "../utils/auth";
import { FollowUpRecord } from "../../shared/types";

const followUpRecordRouter = new Hono();

// 所有路由都需要认证
followUpRecordRouter.use('*', authMiddleware);

// 获取某个客户的跟进记录列表
followUpRecordRouter.get('/:customerId', async (c) => {
  const customerId = c.req.param('customerId');
  const currentUser = c.get('user');
  
  // 验证客户ID
  if (!customerId) {
    return c.json({ error: "客户ID不能为空" }, 400);
  }
  
  try {
    // 先验证用户是否有权限查看该客户
    const customersCollection = db.collection('4d2a803d_customers');
    const customer = await customersCollection.findOne({ _id: new mongo.ObjectId(customerId) });
    
    if (!customer) {
      return c.json({ error: "客户不存在" }, 404);
    }
    
    // 查询跟进记录
    const collection = db.collection('4d2a803d_followUpRecords');
    const records = await collection.find({ 
      customerId: customerId 
    })
    .sort({ createdAt: -1 })
    .toArray();
    
    return c.json({ records });
  } catch (error) {
    console.error("获取跟进记录出错:", error.message);
    return c.json({ error: "获取跟进记录失败" }, 500);
  }
});

// 创建跟进记录
const createRecordSchema = z.object({
  customerId: z.string(),
  title: z.string().min(1, "标题不能为空"),
  content: z.string().min(1, "内容不能为空")
});

followUpRecordRouter.post('/', zValidator('json', createRecordSchema), async (c) => {
  const recordData = await c.req.json();
  const currentUser = c.get('user');
  
  try {
    // 验证客户是否存在
    const customersCollection = db.collection('4d2a803d_customers');
    const customer = await customersCollection.findOne({ 
      _id: new mongo.ObjectId(recordData.customerId) 
    });
    
    if (!customer) {
      return c.json({ error: "客户不存在" }, 404);
    }
    
    // 创建跟进记录
    const collection = db.collection('4d2a803d_followUpRecords');
    
    const newRecord: FollowUpRecord = {
      customerId: recordData.customerId,
      title: recordData.title,
      content: recordData.content,
      creatorId: currentUser.id,
      creatorName: currentUser.username || currentUser.companyName,
      creatorType: currentUser.role,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await collection.insertOne(newRecord);
    
    // 更新客户最后更新时间
    await customersCollection.updateOne(
      { _id: new mongo.ObjectId(recordData.customerId) },
      { $set: { lastUpdateTime: new Date() } }
    );
    
    return c.json({
      message: "创建跟进记录成功",
      record: {
        ...newRecord,
        _id: result.insertedId
      }
    }, 201);
  } catch (error) {
    console.error("创建跟进记录出错:", error.message);
    return c.json({ error: "创建跟进记录失败" }, 500);
  }
});

// 删除跟进记录
followUpRecordRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const currentUser = c.get('user');
  
  try {
    const collection = db.collection('4d2a803d_followUpRecords');
    
    // 查找记录
    const record = await collection.findOne({ _id: new mongo.ObjectId(id) });
    
    if (!record) {
      return c.json({ error: "跟进记录不存在" }, 404);
    }
    
    // 检查权限：只有创建者和超级管理员可以删除
    if (record.creatorId !== currentUser.id && currentUser.role !== 'SUPER_ADMIN') {
      return c.json({ error: "无权删除该跟进记录" }, 403);
    }
    
    // 删除记录
    const result = await collection.deleteOne({ _id: new mongo.ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return c.json({ error: "跟进记录不存在或已被删除" }, 404);
    }
    
    return c.json({ message: "删除跟进记录成功" });
  } catch (error) {
    console.error("删除跟进记录出错:", error.message);
    return c.json({ error: "删除跟进记录失败" }, 500);
  }
});

export default followUpRecordRouter;
