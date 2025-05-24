/**
 * 代理商管理相关路由
 * 处理代理商的CRUD操作和关联
 */

import { Hono } from "hono";
import { zValidator } from '@hono/zod-validator';
import { z } from "zod";
import { authMiddleware, permissionMiddleware, hashPassword } from "../utils/auth";
import { Agent, UserRole, UserStatus } from "../../shared/types";

const agentRouter = new Hono();

// 所有路由都需要认证
agentRouter.use('*', authMiddleware);

// 获取所有代理商
agentRouter.get('/', async (c) => {
  try {
    const currentUser = c.get('user');
    const collection = db.collection('4d2a803d_agents');
    let query = {};
    
    // 如果是原厂销售，只能看到与自己关联的代理商
    if (currentUser.role === UserRole.FACTORY_SALES) {
      query = { relatedSalesId: currentUser.id };
    }
    
    const agents = await collection.find(query)
      .project({ password: 0 })
      .toArray();
    
    // 关联查询销售人员信息 - 不再限制为仅超级管理员
    if (agents.length > 0) {
      const userIds = agents
        .filter(agent => agent.relatedSalesId)
        .map(agent => new mongo.ObjectId(agent.relatedSalesId));
      
      if (userIds.length > 0) {
        const usersCollection = db.collection('4d2a803d_users');
        const salesUsers = await usersCollection
          .find({ _id: { $in: userIds } })
          .project({ _id: 1, username: 1 })
          .toArray();
        
        const salesMap = salesUsers.reduce((map, user) => {
          map[user._id.toString()] = user.username;
          return map;
        }, {} as Record<string, string>);
        
        // 添加销售名称到代理商数据
        agents.forEach(agent => {
          if (agent.relatedSalesId && salesMap[agent.relatedSalesId]) {
            agent.relatedSalesName = salesMap[agent.relatedSalesId];
          }
        });
      }
    }
    
    return c.json({ agents });
  } catch (error) {
    console.error("获取代理商列表出错:", error.message);
    return c.json({ error: "获取代理商列表失败" }, 500);
  }
});

// 创建代理商 (仅超级管理员)
const createAgentSchema = z.object({
  companyName: z.string().min(2, "公司名至少2个字符"),
  password: z.string().min(6, "密码至少6个字符"),
  contactPerson: z.string().min(2, "联系人名至少2个字符"),
  phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号"),
  relatedSalesId: z.string().optional()
});

agentRouter.post('/', 
  permissionMiddleware('agents', 'create'),
  zValidator('json', createAgentSchema),
  async (c) => {
    const agentData = await c.req.json();
    const currentUser = c.get('user');
    
    try {
      const collection = db.collection('4d2a803d_agents');
      
      // 检查公司名称是否重复
      const existingAgent = await collection.findOne({ 
        companyName: agentData.companyName 
      });
      
      if (existingAgent) {
        return c.json({ error: "公司名称已存在" }, 400);
      }
      
      // 根据用户角色设置代理商状态
      if (currentUser.role === UserRole.FACTORY_SALES) {
        // 原厂销售创建时，关联销售ID设为自己，状态为待审批
        agentData.relatedSalesId = currentUser.id;
        agentData.status = UserStatus.PENDING; // 设为待审批状态
      } else if (currentUser.role === UserRole.SUPER_ADMIN) {
        // 超级管理员创建的代理商直接审核通过
        agentData.status = UserStatus.APPROVED;
      }
      
      // 对密码进行加密
      agentData.password = await hashPassword(agentData.password);
      
      // 设置创建时间
      agentData.createdAt = new Date();
      
      const result = await collection.insertOne(agentData);
      
      const message = currentUser.role === UserRole.FACTORY_SALES
        ? "代理商创建成功，请等待管理员审批"
        : "代理商创建成功";
      
      return c.json({
        message,
        agent: {
          ...agentData,
          _id: result.insertedId,
          password: undefined
        }
      }, 201);
    } catch (error) {
      console.error("创建代理商出错:", error.message);
      return c.json({ error: "创建代理商失败" }, 500);
    }
  }
);

// 更新代理商
const updateAgentSchema = z.object({
  companyName: z.string().min(2, "公司名至少2个字符").optional(),
  contactPerson: z.string().min(2, "联系人名至少2个字符").optional(),
  phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号").optional(),
  relatedSalesId: z.string().optional().nullable(),
  password: z.string().min(6, "密码至少6个字符").optional()
});

agentRouter.put('/:id', 
  zValidator('json', updateAgentSchema),
  async (c) => {
    const id = c.req.param('id');
    const updateData = await c.req.json();
    const currentUser = c.get('user');
    
    try {
      const collection = db.collection('4d2a803d_agents');
      
      // 查找要更新的代理商
      const existingAgent = await collection.findOne({
        _id: new mongo.ObjectId(id)
      });
      
      if (!existingAgent) {
        return c.json({ error: "代理商不存在" }, 404);
      }
      
      // 检查权限 - 移除关于原厂销售不能修改关联销售的限制
      if (currentUser.role === UserRole.FACTORY_SALES) {
        // 原厂销售只能修改自己创建的代理商
        if (existingAgent.relatedSalesId !== currentUser.id && existingAgent.status !== UserStatus.PENDING) {
          return c.json({ error: "无权修改此代理商" }, 403);
        }
        
        // 原厂销售可以修改关联销售，但只能是自己
        if (updateData.relatedSalesId && updateData.relatedSalesId !== currentUser.id) {
          updateData.relatedSalesId = currentUser.id; // 强制设置为自己
        }
      }
      
      // 处理密码更新
      if (updateData.password) {
        updateData.password = await hashPassword(updateData.password);
      } else {
        delete updateData.password;
      }
      
      // 检查公司名称是否重复
      if (updateData.companyName && updateData.companyName !== existingAgent.companyName) {
        const nameExists = await collection.findOne({
          companyName: updateData.companyName,
          _id: { $ne: new mongo.ObjectId(id) }
        });
        
        if (nameExists) {
          return c.json({ error: "公司名称已存在" }, 400);
        }
      }
      
      // 更新数据
      const result = await collection.updateOne(
        { _id: new mongo.ObjectId(id) },
        { $set: updateData }
      );
      
      if (result.matchedCount === 0) {
        return c.json({ error: "代理商不存在" }, 404);
      }
      
      return c.json({ 
        message: "代理商更新成功",
        modifiedCount: result.modifiedCount
      });
    } catch (error) {
      console.error("更新代理商出错:", error.message);
      return c.json({ error: "更新代理商失败" }, 500);
    }
  }
);

// 删除代理商 (仅超级管理员)
agentRouter.delete('/:id', permissionMiddleware('agents', 'delete'), async (c) => {
  const id = c.req.param('id');
  
  try {
    const agentsCollection = db.collection('4d2a803d_agents');
    const customersCollection = db.collection('4d2a803d_customers');
    
    // 首先检查代理商是否存在
    const agent = await agentsCollection.findOne({ _id: new mongo.ObjectId(id) });
    if (!agent) {
      return c.json({ error: "代理商不存在" }, 404);
    }
    
    // 查询该代理商是否有关联客户
    const customerCount = await customersCollection.countDocuments({ 
      ownerId: id,
      ownerType: UserRole.AGENT
    });
    
    if (customerCount > 0) {
      return c.json({ 
        error: "该代理商有关联客户，无法删除",
        customerCount 
      }, 400);
    }
    
    // 删除代理商
    const result = await agentsCollection.deleteOne({ _id: new mongo.ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return c.json({ error: "代理商不存在或已被删除" }, 404);
    }
    
    return c.json({ message: "删除代理商成功" });
  } catch (error) {
    console.error("删除代理商出错:", error.message);
    return c.json({ error: "删除代理商失败" }, 500);
  }
});

// 获取特定销售的代理商列表
agentRouter.get('/by-sales/:salesId', async (c) => {
  const salesId = c.req.param('salesId');
  const currentUser = c.get('user');
  
  // 权限检查
  if (currentUser.role !== UserRole.SUPER_ADMIN && 
      currentUser.role !== UserRole.FACTORY_SALES) {
    return c.json({ error: "无权查看该数据" }, 403);
  }
  
  // 销售只能查看自己关联的代理商
  if (currentUser.role === UserRole.FACTORY_SALES && 
      currentUser.id !== salesId) {
    return c.json({ error: "只能查看自己关联的代理商" }, 403);
  }
  
  try {
    const collection = db.collection('4d2a803d_agents');
    
    const agents = await collection.find({ 
      relatedSalesId: salesId,
      status: UserStatus.APPROVED
    })
    .project({ password: 0 })
    .toArray();
    
    return c.json({ agents });
  } catch (error) {
    console.error("获取销售关联代理商出错:", error.message);
    return c.json({ error: "获取代理商列表失败" }, 500);
  }
});

// 导出代理商列表为CSV (仅超级管理员)
agentRouter.get('/export/csv', permissionMiddleware('exports', 'agents'), async (c) => {
  try {
    const collection = db.collection('4d2a803d_agents');
    
    // 获取代理商数据(排除密码)
    const agents = await collection.find({})
      .project({ password: 0 })
      .toArray();
    
    // 关联销售名称
    const userIds = agents
      .filter(agent => agent.relatedSalesId)
      .map(agent => new mongo.ObjectId(agent.relatedSalesId));
    
    let salesMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const usersCollection = db.collection('4d2a803d_users');
      const salesUsers = await usersCollection
        .find({ _id: { $in: userIds } })
        .project({ _id: 1, username: 1 })
        .toArray();
      
      salesMap = salesUsers.reduce((map, user) => {
        map[user._id.toString()] = user.username;
        return map;
      }, {} as Record<string, string>);
    }
    
    // 生成CSV头
    let csv = "代理商公司名称,联系人,联系电话,关联销售,创建时间,状态\n";
    
    // 添加数据行
    agents.forEach(agent => {
      const statusMap: Record<string, string> = {
        [UserStatus.APPROVED]: "已批准",
        [UserStatus.PENDING]: "待审批",
        [UserStatus.REJECTED]: "已拒绝"
      };
      
      const row = [
        agent.companyName,
        agent.contactPerson,
        agent.phone,
        agent.relatedSalesId ? salesMap[agent.relatedSalesId] || "未知" : "无",
        new Date(agent.createdAt).toLocaleString(),
        statusMap[agent.status] || agent.status
      ];
      
      // 转义字段中的双引号和逗号
      const escapedRow = row.map(field => {
        if (field && (field.includes(',') || field.includes('"'))) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      });
      
      csv += escapedRow.join(',') + '\n';
    });
    
    // 设置响应头
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename=agents.csv');
    
    return c.body(csv);
  } catch (error) {
    console.error("导出代理商出错:", error.message);
    return c.json({ error: "导出代理商失败" }, 500);
  }
});

// 获取可分配的代理商列表
agentRouter.get('/assignable', async (c) => {
  const currentUser = c.get('user');
  
  try {
    const collection = db.collection('4d2a803d_agents');
    
    let query = { status: 'approved' };
    let agents = [];
    
    // 根据不同角色处理查询逻辑
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      // 超级管理员可以看到所有已批准的代理商
      agents = await collection
        .find(query)
        .project({
          _id: 1,
          companyName: 1,
          contactPerson: 1,
          phone: 1,
          relatedSalesId: 1,
          relatedSalesName: 1
        })
        .toArray();
    } else if (currentUser.role === UserRole.FACTORY_SALES) {
      // 销售只能看到关联的代理商
      query = {
        ...query,
        relatedSalesId: currentUser.id
      };
      
      agents = await collection
        .find(query)
        .project({
          _id: 1,
          companyName: 1,
          contactPerson: 1,
          phone: 1,
          relatedSalesId: 1,
          relatedSalesName: 1
        })
        .toArray();
    } else if (currentUser.role === UserRole.AGENT) {
      // 代理商只能看到自己
      agents = await collection
        .find({ _id: new mongo.ObjectId(currentUser.id), status: 'approved' })
        .project({
          _id: 1,
          companyName: 1,
          contactPerson: 1,
          phone: 1,
          relatedSalesId: 1,
          relatedSalesName: 1
        })
        .toArray();
    } else {
      // 其他角色无权访问
      return c.json({ error: "无权获取代理商列表" }, 403);
    }
    
    return c.json({ agents });
  } catch (error) {
    console.error("获取可分配代理商列表出错:", error.message);
    return c.json({ error: "获取可分配代理商列表失败" }, 500);
  }
});

export default agentRouter;