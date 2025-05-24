/**
 * 客户管理相关路由
 * 处理客户的CRUD操作、导入导出和公海管理
 */

import { Hono } from "hono";
import { zValidator } from '@hono/zod-validator';
import { z } from "zod";
import { authMiddleware } from "../utils/auth";
import { 
  Customer, 
  CustomerImportance,
  CustomerNature, 
  CustomerProgress,
  UserRole,
  CustomerAssignRequest
} from "../../shared/types";
import { addAssignmentHistory } from "./customerAssignments"; // 引入统一的历史记录方法
import { addCustomerProgressHistory } from "./customerProgressHistory"; // 引入进展历史记录方法

const customerRouter = new Hono();

// 所有路由都需要认证
customerRouter.use('*', authMiddleware);

// 获取客户列表
customerRouter.get('/', async (c) => {
  const currentUser = c.get('user');
  const query = c.req.query();
  
  // 分页参数
  const page = parseInt(query.page || '1');
  const limit = parseInt(query.limit || '10');
  const skip = (page - 1) * limit;
  
  // 过滤条件
  const filterQuery: any = {};
  
  // 关键词搜索
  if (query.keyword) {
    const keyword = query.keyword;
    filterQuery.$or = [
      { name: { $regex: keyword, $options: 'i' } },
      { contactPerson: { $regex: keyword, $options: 'i' } },
      { applicationField: { $regex: keyword, $options: 'i' } }
    ];
  }
  
  // 客户性质过滤
  if (query.nature) {
    filterQuery.nature = query.nature;
  }
  
  // 客户重要程度过滤
  if (query.importance) {
    filterQuery.importance = query.importance;
  }
  
  // 客户进展过滤
  if (query.progress) {
    filterQuery.progress = query.progress;
  }
  
  // 公海状态过滤
  if (query.isInPublicPool) {
    filterQuery.isInPublicPool = query.isInPublicPool === 'true';
  }
  
  // 根据角色限制查询范围
  if (currentUser.role === UserRole.SUPER_ADMIN) {
    // 超级管理员可以查看所有客户
  } else if (currentUser.role === UserRole.FACTORY_SALES) {
    // 销售只能查看关联销售等于当前登录用户的客户
    if (!filterQuery.isInPublicPool) {
      filterQuery.relatedSalesId = currentUser.id;
    }
  } else if (currentUser.role === UserRole.AGENT) {
    // 代理商只能查看关联代理商等于当前登录用户的客户
    if (!filterQuery.isInPublicPool) {
      filterQuery.relatedAgentId = currentUser.id;
    }
  } else {
    // 库存管理员不能查看客户
    return c.json({ error: "无权访问客户数据" }, 403);
  }
  
  try {
    const collection = db.collection('4d2a803d_customers');
    
    // 获取总数
    const totalCount = await collection.countDocuments(filterQuery);
    
    // 查询数据
    const customers = await collection.find(filterQuery)
      .sort({ lastUpdateTime: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    
    // 收集需要查询的用户ID
    if (customers.length > 0 && !query.isInPublicPool) {
      // 分组收集所有者ID和关联人员ID
      const salesIds = new Set<string>();
      const agentIds = new Set<string>();
      
      customers.forEach(customer => {
        // 所有者
        if (customer.ownerType === UserRole.FACTORY_SALES) {
          salesIds.add(customer.ownerId);
        } else if (customer.ownerType === UserRole.AGENT) {
          agentIds.add(customer.ownerId);
        }
        
        // 关联销售
        if (customer.relatedSalesId) {
          salesIds.add(customer.relatedSalesId);
        }
        
        // 关联代理商
        if (customer.relatedAgentId) {
          agentIds.add(customer.relatedAgentId);
        }
      });
      
      // 查询销售信息
      const salesMap: Record<string, string> = {};
      
      if (salesIds.size > 0) {
        const usersCollection = db.collection('4d2a803d_users');
        const salesUsers = await usersCollection
          .find({ _id: { $in: Array.from(salesIds).map(id => new mongo.ObjectId(id)) } })
          .project({ _id: 1, username: 1 })
          .toArray();
        
        salesUsers.forEach(user => {
          salesMap[user._id.toString()] = user.username;
        });
      }
      
      // 查询代理商信息
      const agentMap: Record<string, string> = {};
      
      if (agentIds.size > 0) {
        const agentsCollection = db.collection('4d2a803d_agents');
        const agentUsers = await agentsCollection
          .find({ _id: { $in: Array.from(agentIds).map(id => new mongo.ObjectId(id)) } })
          .project({ _id: 1, companyName: 1 })
          .toArray();
        
        agentUsers.forEach(agent => {
          agentMap[agent._id.toString()] = agent.companyName;
        });
      }
      
      // 添加所有者和关联人员信息
      customers.forEach(customer => {
        // 所有者信息
        if (customer.ownerId) {
          if (customer.ownerType === UserRole.FACTORY_SALES) {
            customer.ownerName = salesMap[customer.ownerId] || '未知';
            customer.ownerTypeDisplay = '原厂销售';
          } else if (customer.ownerType === UserRole.AGENT) {
            customer.ownerName = agentMap[customer.ownerId] || '未知';
            customer.ownerTypeDisplay = '代理商';
          }
        }
        
        // 关联销售信息
        if (customer.relatedSalesId) {
          customer.relatedSalesName = salesMap[customer.relatedSalesId] || '未知';
        }
        
        // 关联代理商信息
        if (customer.relatedAgentId) {
          customer.relatedAgentName = agentMap[customer.relatedAgentId] || '未知';
        }
      });
    }
    
    // 公海客户只展示有限信息
    if (query.isInPublicPool === 'true') {
      customers.forEach(customer => {
        // 保留客户名称和地址，其他信息清空
        const filteredCustomer = {
          _id: customer._id,
          name: customer.name,
          address: customer.address,
          isInPublicPool: true,
          createdAt: customer.createdAt
        };
        
        Object.keys(customer).forEach(key => {
          if (!Object.keys(filteredCustomer).includes(key)) {
            delete customer[key];
          }
        });
      });
    }
    
    return c.json({
      customers,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error("获取客户列表出错:", error.message);
    return c.json({ error: "获取客户列表失败" }, 500);
  }
});

// 查重检查客户
customerRouter.get('/check-duplicate', async (c) => {
  const name = c.req.query('name');
  
  if (!name) {
    return c.json({ error: "客户名称不能为空" }, 400);
  }
  
  try {
    const collection = db.collection('4d2a803d_customers');
    
    // 模糊查询
    const existingCustomers = await collection
      .find({ name: { $regex: name, $options: 'i' } })
      .project({ 
        _id: 1, 
        name: 1, 
        contactPerson: 1, 
        address: 1,
        ownerType: 1,
        ownerId: 1
      })
      .toArray();
    
    if (existingCustomers.length === 0) {
      return c.json({ exists: false });
    }
    
    // 获取所有者信息
    const salesIds = new Set<string>();
    const agentIds = new Set<string>();
    
    existingCustomers.forEach(customer => {
      if (customer.ownerType === UserRole.FACTORY_SALES) {
        salesIds.add(customer.ownerId);
      } else if (customer.ownerType === UserRole.AGENT) {
        agentIds.add(customer.ownerId);
      }
    });
    
    // 查询所有者详情
    const ownerMap: Record<string, string> = {};
    
    if (salesIds.size > 0) {
      const usersCollection = db.collection('4d2a803d_users');
      const salesUsers = await usersCollection
        .find({ _id: { $in: Array.from(salesIds).map(id => new mongo.ObjectId(id)) } })
        .project({ _id: 1, username: 1 })
        .toArray();
      
      salesUsers.forEach(user => {
        ownerMap[user._id.toString()] = user.username;
      });
    }
    
    if (agentIds.size > 0) {
      const agentsCollection = db.collection('4d2a803d_agents');
      const agentUsers = await agentsCollection
        .find({ _id: { $in: Array.from(agentIds).map(id => new mongo.ObjectId(id)) } })
        .project({ _id: 1, companyName: 1 })
        .toArray();
      
      agentUsers.forEach(agent => {
        ownerMap[agent._id.toString()] = agent.companyName;
      });
    }
    
    // 添加所有者信息
    existingCustomers.forEach(customer => {
      customer.ownerName = ownerMap[customer.ownerId] || '未知';
    });
    
    return c.json({ 
      exists: true,
      customers: existingCustomers
    });
  } catch (error) {
    console.error("查重客户出错:", error.message);
    return c.json({ error: "查重客户失败" }, 500);
  }
});

// 创建客户
const createCustomerSchema = z.object({
  name: z.string().min(2, "客户名称至少2个字符"),
  nature: z.nativeEnum(CustomerNature),
  importance: z.nativeEnum(CustomerImportance),
  applicationField: z.string(),
  productNeeds: z.array(z.string()),
  contactPerson: z.string(),
  contactPhone: z.string(),
  address: z.string(),
  progress: z.nativeEnum(CustomerProgress),
  annualDemand: z.number(),
  relatedSalesId: z.string(), // 必填的关联销售
  relatedAgentId: z.string().nullable().optional() // 可选的关联代理商，允许null值
});

customerRouter.post('/', zValidator('json', createCustomerSchema), async (c) => {
  const currentUser = c.get('user');
  const requestData = await c.req.json();
  
  try {
    const collection = db.collection('4d2a803d_customers');
    const usersCollection = db.collection('4d2a803d_users');
    const agentsCollection = db.collection('4d2a803d_agents');
    
    // 检查名称是否重复
    const existingCustomer = await collection.findOne({ 
      name: requestData.name
    });
    
    if (existingCustomer) {
      return c.json({ error: "客户名称已存在" }, 400);
    }
    
    // 查询关联销售信息
    let salesUser = null;
    if (requestData.relatedSalesId) {
      salesUser = await usersCollection.findOne({ 
        _id: new mongo.ObjectId(requestData.relatedSalesId)
      });
      if (!salesUser) {
        return c.json({ error: "找不到关联销售" }, 400);
      }
    }
    
    // 查询关联代理商信息
    let agentInfo = null;
    if (requestData.relatedAgentId) {
      agentInfo = await agentsCollection.findOne({ 
        _id: new mongo.ObjectId(requestData.relatedAgentId)
      });
      if (!agentInfo) {
        return c.json({ error: "找不到关联代理商" }, 400);
      }
    }
    
    // 设置所有者信息（创建人）和关联人员
    // 确保所有者是当前用户，即使创建者是管理员
    const newCustomer: Customer = {
      ...requestData,
      ownerId: currentUser.id, // 所有者始终是创建人（包括admin）
      ownerType: currentUser.role,
      ownerName: currentUser.username || currentUser.companyName,
      relatedSalesName: salesUser ? salesUser.username : '',
      relatedAgentName: agentInfo ? agentInfo.companyName : '',
      isInPublicPool: false,
      lastUpdateTime: new Date(),
      createdAt: new Date()  // 添加创建时间字段
    };
    
    const result = await collection.insertOne(newCustomer);
    const insertedId = result.insertedId.toString();
    
    // 确定操作类型
    let operationType = '新建分配';
    if ((currentUser.role === UserRole.FACTORY_SALES && currentUser.id === requestData.relatedSalesId) ||
        (currentUser.role === UserRole.AGENT && currentUser.id === requestData.relatedAgentId)) {
      operationType = '新建认领';
    }

    // 使用统一的方法记录分配历史
    if (requestData.relatedSalesId || requestData.relatedAgentId) {
      await addAssignmentHistory({
        customerId: insertedId,
        customerName: requestData.name,
        // 销售信息
        fromRelatedSalesId: null,
        fromRelatedSalesName: null,
        toRelatedSalesId: requestData.relatedSalesId || null,
        toRelatedSalesName: salesUser ? salesUser.username : null,
        // 代理商信息
        fromRelatedAgentId: null,
        fromRelatedAgentName: null,
        toRelatedAgentId: requestData.relatedAgentId || null,
        toRelatedAgentName: agentInfo ? agentInfo.companyName : null,
        // 操作者信息
        operatorId: currentUser.id,
        operatorName: currentUser.username || currentUser.companyName,
        operationType: operationType
      });
    }

    // 添加客户进展历史记录 - 从"无"到初始进展
    await addCustomerProgressHistory({
      customerId: insertedId,
      customerName: requestData.name,
      fromProgress: '无', // 初始状态为"无"
      toProgress: requestData.progress,
      operatorId: currentUser.id,
      operatorName: currentUser.username || currentUser.companyName,
      remark: '客户创建'
    });

    return c.json({
      message: "创建客户成功",
      customer: {
        ...newCustomer,
        _id: result.insertedId
      }
    }, 201);
  } catch (error) {
    console.error("创建客户出错:", error.message);
    return c.json({ error: "创建客户失败: " + error.message }, 500);
  }
});

// 批量导入客户
const bulkImportSchema = z.object({
  customers: z.array(
    z.object({
      name: z.string().min(2, "客户名称至少2个字符"),
      nature: z.nativeEnum(CustomerNature),
      importance: z.nativeEnum(CustomerImportance),
      applicationField: z.string(),
      productNeeds: z.array(z.string()),
      contactPerson: z.string(),
      contactPhone: z.string(),
      address: z.string(),
      progress: z.nativeEnum(CustomerProgress),
      annualDemand: z.number(),
      relatedSalesId: z.string(), // 必填的关联销售
      relatedAgentId: z.string().optional() // 可选的关联代理商
    })
  )
});

customerRouter.post('/bulk-import', zValidator('json', bulkImportSchema), async (c) => {
  const currentUser = c.get('user');
  const { customers, relatedSalesId, relatedAgentId } = await c.req.json();
  
  try {
    const collection = db.collection('4d2a803d_customers');
    const usersCollection = db.collection('4d2a803d_users');
    const agentsCollection = db.collection('4d2a803d_agents');
    
    // 检查名称是否重复
    const customerNames = customers.map(c => c.name);
    const existingCustomers = await collection
      .find({ name: { $in: customerNames } })
      .project({ name: 1 })
      .toArray();
    
    if (existingCustomers.length > 0) {
      return c.json({ 
        error: "以下客户名称已存在", 
        duplicateNames: existingCustomers.map(c => c.name)
      }, 400);
    }
    
    // 收集所有销售和代理商ID
    const salesIds = new Set<string>();
    const agentIds = new Set<string>();
    
    customers.forEach(customer => {
      if (customer.relatedSalesId) {
        salesIds.add(customer.relatedSalesId);
      }
      if (customer.relatedAgentId) {
        agentIds.add(customer.relatedAgentId);
      }
    });
    
    // 查询销售信息
    const salesMap: Record<string, string> = {};
    
    if (salesIds.size > 0) {
      const salesUsers = await usersCollection
        .find({ _id: { $in: Array.from(salesIds).map(id => new mongo.ObjectId(id)) } })
        .project({ _id: 1, username: 1 })
        .toArray();
      
      salesUsers.forEach(user => {
        salesMap[user._id.toString()] = user.username;
      });
    }
    
    // 查询代理商信息
    const agentMap: Record<string, string> = {};
    
    if (agentIds.size > 0) {
      const agents = await agentsCollection
        .find({ _id: { $in: Array.from(agentIds).map(id => new mongo.ObjectId(id)) } })
        .project({ _id: 1, companyName: 1 })
        .toArray();
      
      agents.forEach(agent => {
        agentMap[agent._id.toString()] = agent.companyName;
      });
    }
    
    // 准备要插入的客户数据
    const customersToInsert = customers.map(customer => ({
      ...customer,
      ownerId: currentUser.id,
      ownerType: currentUser.role,
      ownerName: currentUser.username || currentUser.companyName,
      relatedSalesName: customer.relatedSalesId ? salesMap[customer.relatedSalesId] || '未知' : '',
      relatedAgentName: customer.relatedAgentId ? agentMap[customer.relatedAgentId] || '未知' : '',
      isInPublicPool: false,
      lastUpdateTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    
    // 插入客户数据
    const result = await collection.insertMany(customersToInsert);
    
    // 获取插入后的客户完整数据
    const insertedCustomers = await collection
      .find({ _id: { $in: Object.values(result.insertedIds).map(id => id) } })
      .toArray();
    
    // 确定操作类型
    let operationType = '新建分配';
    if ((currentUser.role === UserRole.FACTORY_SALES && currentUser.id === relatedSalesId) ||
        (currentUser.role === UserRole.AGENT && currentUser.id === relatedAgentId)) {
      operationType = '新建认领';
    }

    // 为每个新客户记录分配历史
    if (relatedSalesId || relatedAgentId) {
      for (const customer of insertedCustomers) {
        await addAssignmentHistory({
          customerId: customer._id.toString(),
          customerName: customer.name,
          // 销售信息
          fromRelatedSalesId: null,
          fromRelatedSalesName: null,
          toRelatedSalesId: relatedSalesId || null,
          toRelatedSalesName: salesUser ? salesUser.username : null,
          // 代理商信息
          fromRelatedAgentId: null,
          fromRelatedAgentName: null,
          toRelatedAgentId: relatedAgentId || null,
          toRelatedAgentName: agentInfo ? agentInfo.companyName : null,
          // 操作者信息
          operatorId: currentUser.id,
          operatorName: currentUser.username || currentUser.companyName,
          operationType: operationType
        });
        
        // 添加客户进展历史记录 - 从"无"到初始进展
        await addCustomerProgressHistory({
          customerId: customer._id.toString(),
          customerName: customer.name,
          fromProgress: '无', // 初始状态为"无"
          toProgress: customer.progress,
          operatorId: currentUser.id,
          operatorName: currentUser.username || currentUser.companyName,
          remark: '批量导入客户'
        });
      }
    }

    return c.json({
      message: `成功导入 ${result.insertedCount} 个客户`,
      insertedCount: result.insertedCount
    }, 201);
  } catch (error) {
    console.error("批量导入客户出错:", error.message);
    return c.json({ error: "批量导入客户失败" }, 500);
  }
});

// 获取单个客户详情
customerRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const currentUser = c.get('user');
  
  try {
    const collection = db.collection('4d2a803d_customers');
    
    // 查询客户
    const customer = await collection.findOne({ _id: new mongo.ObjectId(id) });
    
    if (!customer) {
      return c.json({ error: "客户不存在" }, 404);
    }
    
    // 验证权限
    if (currentUser.role !== UserRole.SUPER_ADMIN && 
        customer.isInPublicPool !== true) {
      
      // 检查是否是自己的客户或关联的客户
      const canAccess = 
        (currentUser.role === UserRole.FACTORY_SALES && 
          (customer.ownerId === currentUser.id || customer.relatedSalesId === currentUser.id)) ||
        (currentUser.role === UserRole.AGENT && 
          (customer.ownerId === currentUser.id || customer.relatedAgentId === currentUser.id));
      
      if (!canAccess) {
        return c.json({ error: "无权查看该客户" }, 403);
      }
    }
    
    return c.json({ customer });
  } catch (error) {
    console.error("获取客户详情出错:", error.message);
    return c.json({ error: "获取客户详情失败" }, 500);
  }
});

// 更新客户
customerRouter.put('/:id', async (c) => {
  const id = c.req.param('id');
  const updateData = await c.req.json();
  const currentUser = c.get('user');
  
  try {
    const collection = db.collection('4d2a803d_customers');
    
    // 查询客户
    const customer = await collection.findOne({ _id: new mongo.ObjectId(id) });
    
    if (!customer) {
      return c.json({ error: "客户不存在" }, 404);
    }
    
    // 验证权限
    if (currentUser.role !== UserRole.SUPER_ADMIN && 
        customer.isInPublicPool !== true) {
      
      // 检查是否是自己的客户或关联的客户
      const canAccess = 
        (currentUser.role === UserRole.FACTORY_SALES && 
          (customer.ownerId === currentUser.id || customer.relatedSalesId === currentUser.id)) ||
        (currentUser.role === UserRole.AGENT && 
          (customer.ownerId === currentUser.id || customer.relatedAgentId === currentUser.id));
      
      if (!canAccess) {
        return c.json({ error: "无权更新该客户" }, 403);
      }
    }
    
    // 检查销售和代理商关联是否变化
    const relatedSalesChanged = updateData.relatedSalesId && 
                              updateData.relatedSalesId !== customer.relatedSalesId;
    const relatedAgentChanged = 'relatedAgentId' in updateData && 
                              updateData.relatedAgentId !== customer.relatedAgentId;
    
    // 查询关联销售名称
    if (relatedSalesChanged) {
      const usersCollection = db.collection('4d2a803d_users');
      const salesUser = await usersCollection.findOne({ 
        _id: new mongo.ObjectId(updateData.relatedSalesId)
      });
      
      if (salesUser) {
        updateData.relatedSalesName = salesUser.username;
      } else {
        return c.json({ error: "找不到关联销售" }, 400);
      }
    }
    
    // 查询关联代理商名称
    if (relatedAgentChanged && updateData.relatedAgentId) {
      const agentsCollection = db.collection('4d2a803d_agents');
      const agent = await agentsCollection.findOne({ 
        _id: new mongo.ObjectId(updateData.relatedAgentId)
      });
      
      if (agent) {
        updateData.relatedAgentName = agent.companyName;
      } else {
        return c.json({ error: "找不到关联代理商" }, 400);
      }
    } else if (relatedAgentChanged && !updateData.relatedAgentId) {
      // 清空代理商关联
      updateData.relatedAgentName = '';
    }
    
    // 检查进展是否变化
    const progressChanged = updateData.progress && updateData.progress !== customer.progress;
    
    // 更新客户数据
    updateData.lastUpdateTime = new Date();
    updateData.updatedAt = new Date();
    
    const result = await collection.updateOne(
      { _id: new mongo.ObjectId(id) },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return c.json({ error: "客户不存在" }, 404);
    }
    
    // 记录关联变更历史
    if (relatedSalesChanged || relatedAgentChanged) {
      // 使用统一的 addAssignmentHistory 方法记录变更历史
      await addAssignmentHistory({
        customerId: id,
        customerName: customer.name,
        // 销售信息
        fromRelatedSalesId: customer.relatedSalesId || null,
        fromRelatedSalesName: customer.relatedSalesName || null,
        toRelatedSalesId: updateData.relatedSalesId || null,
        toRelatedSalesName: updateData.relatedSalesName || null,
        // 代理商信息
        fromRelatedAgentId: customer.relatedAgentId || null,
        fromRelatedAgentName: customer.relatedAgentName || null,
        toRelatedAgentId: relatedAgentChanged ? (updateData.relatedAgentId || null) : customer.relatedAgentId,
        toRelatedAgentName: relatedAgentChanged ? (updateData.relatedAgentName || null) : customer.relatedAgentName,
        // 操作者信息
        operatorId: currentUser.id,
        operatorName: currentUser.username || currentUser.companyName,
        // 确定操作类型
        operationType: '分配'
      });
    }
    
    // 记录客户进展变更历史
    if (progressChanged) {
      await addCustomerProgressHistory({
        customerId: id,
        customerName: customer.name,
        fromProgress: customer.progress,
        toProgress: updateData.progress,
        operatorId: currentUser.id,
        operatorName: currentUser.username || currentUser.companyName,
        remark: '更新客户进展'
      });
    }
    
    return c.json({ 
      message: "客户更新成功",
      updateCount: result.modifiedCount
    });
  } catch (error) {
    console.error("更新客户出错:", error.message);
    return c.json({ error: "更新客户失败" }, 500);
  }
});

// 删除客户
customerRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const currentUser = c.get('user');
  
  try {
    const collection = db.collection('4d2a803d_customers');
    
    // 查询客户
    const customer = await collection.findOne({ _id: new mongo.ObjectId(id) });
    
    if (!customer) {
      return c.json({ error: "客户不存在" }, 404);
    }
    
    // 验证权限
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      // 检查是否是自己的客户或关联的客户
      const canDelete = 
        (currentUser.role === UserRole.FACTORY_SALES && 
          (customer.ownerId === currentUser.id || customer.relatedSalesId === currentUser.id)) ||
        (currentUser.role === UserRole.AGENT && 
          (customer.ownerId === currentUser.id || customer.relatedAgentId === currentUser.id));
      
      if (!canDelete || customer.isInPublicPool) {
        return c.json({ error: "无权删除该客户" }, 403);
      }
    }
    
    // 删除客户相关的跟进记录
    const followUpCollection = db.collection('4d2a803d_followUpRecords');
    await followUpCollection.deleteMany({ customerId: id });
    
    // 删除客户
    const result = await collection.deleteOne({ _id: new mongo.ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return c.json({ error: "客户不存在或已被删除" }, 404);
    }
    
    return c.json({ message: "客户删除成功" });
  } catch (error) {
    console.error("删除客户出错:", error.message);
    return c.json({ error: "删除客户失败" }, 500);
  }
});

// 将客户移入公海池
customerRouter.post('/:id/move-to-public', async (c) => {
  const id = c.req.param('id');
  const currentUser = c.get('user');
  
  try {
    const collection = db.collection('4d2a803d_customers');
    
    // 查询客户
    const customer = await collection.findOne({ _id: new mongo.ObjectId(id) });
    
    if (!customer) {
      return c.json({ error: "客户不存在" }, 404);
    }
    
    // 验证权限
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      // 检查是否是自己的客户或关联的客户
      const canMove = 
        (currentUser.role === UserRole.FACTORY_SALES && 
          (customer.ownerId === currentUser.id || customer.relatedSalesId === currentUser.id)) ||
        (currentUser.role === UserRole.AGENT && 
          (customer.ownerId === currentUser.id || customer.relatedAgentId === currentUser.id));
      
      if (!canMove || customer.isInPublicPool) {
        return c.json({ error: "无权将该客户移入公海" }, 403);
      }
    }
    
    // 保存之前的关联信息 - 不保存所有者信息，因为所有者不会改变
    const previousInfo = {
      previousRelatedSalesId: customer.relatedSalesId,
      previousRelatedSalesName: customer.relatedSalesName,
      previousRelatedAgentId: customer.relatedAgentId,
      previousRelatedAgentName: customer.relatedAgentName
    };

    // 更新客户状态为公海
    const updateResult = await collection.updateOne(
      { _id: new mongo.ObjectId(id) },
      { 
        $set: {
          isInPublicPool: true,
          progress: CustomerProgress.PUBLIC_POOL,
          relatedSalesId: null,
          relatedSalesName: null,
          relatedAgentId: null,
          relatedAgentName: null,
          ...previousInfo,
          lastUpdateTime: new Date(),
          updatedAt: new Date()
        }
      }
    );

    if (updateResult.matchedCount === 0) {
      return c.json({ error: "客户不存在或已被修改" }, 404);
    }

    // 使用统一的方法记录分配历史
    await addAssignmentHistory({
      customerId: id,
      customerName: customer.name,
      // 销售信息
      fromRelatedSalesId: customer.relatedSalesId || null,
      fromRelatedSalesName: customer.relatedSalesName || null,
      toRelatedSalesId: null,
      toRelatedSalesName: null,
      // 代理商信息
      fromRelatedAgentId: customer.relatedAgentId || null,
      fromRelatedAgentName: customer.relatedAgentName || null,
      toRelatedAgentId: null,
      toRelatedAgentName: null,
      // 操作者信息
      operatorId: currentUser.id,
      operatorName: currentUser.username || currentUser.companyName,
      operationType: '移入公海池'
    });

    return c.json({ message: "客户已成功移入公海" });
  } catch (error) {
    console.error("移入公海出错:", error.message);
    return c.json({ error: "移入公海失败: " + error.message }, 500);
  }
});

// ... 保留路由器导出代码 ...

export default customerRouter;