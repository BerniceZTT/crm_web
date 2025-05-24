/**
 * 用户管理相关路由
 * 处理用户的CRUD操作和审批
 */

import { Hono } from "hono";
import { zValidator } from '@hono/zod-validator';
import { z } from "zod";
import { authMiddleware, permissionMiddleware } from "../utils/auth";
import { User, UserRole, UserStatus } from "../../shared/types";
import { successResponse, errorResponse } from "../utils/apiResponse";
import { ApiError, createNotFoundError, createBadRequestError } from "../utils/errorHandler";
import { executeDbOperation, logCollectionStats } from "../utils/database";
import { log, logError, logDbOperation } from "../utils/logger";

const userRouter = new Hono();

// 所有路由都需要认证
userRouter.use('*', authMiddleware);

// 获取所有用户 (仅超级管理员)
userRouter.get('/', permissionMiddleware('users', 'read'), async (c) => {
  log('info', '处理获取用户列表请求...');
  try {
    // 检查数据库和集合状态
    await logCollectionStats('4d2a803d_users');
    
    // 列出所有集合，验证集合名称是否正确
    const collections = await db.listCollections().toArray();
    log('info', `数据库中的所有集合:`, 
      collections.map(col => col.name));
    
    // 检查用户集合是否存在
    const userCollectionExists = collections.some(col => col.name === '4d2a803d_users');
    if (!userCollectionExists) {
      log('error', '用户集合不存在!', { expectedCollection: '4d2a803d_users' });
      // 尝试查找可能的用户集合
      const possibleUserCollections = collections.filter(col => 
        col.name.includes('user') || col.name.includes('User'));
      
      if (possibleUserCollections.length > 0) {
        log('info', '找到可能的用户集合:', 
          possibleUserCollections.map(col => col.name));
      }
    }
    
    const collection = db.collection('4d2a803d_users');
    
    // 检查集合中的总记录数
    const totalCount = await collection.countDocuments();
    log('info', `集合 4d2a803d_users 中共有 ${totalCount} 条记录`);
    
    if (totalCount === 0) {
      log('warn', '用户集合中没有任何记录!');
      return successResponse(c, { users: [] });
    }
    
    // 直接使用无过滤条件的查询获取所有用户
    logDbOperation('find', '4d2a803d_users', 'getAllUsers', { projection: { password: 0 } });
    const users = await executeDbOperation(async () => {
      // 1. 尝试不使用任何投影
      const allUsers = await collection.find().toArray();
      
      // 记录原始查询结果（移除密码后）
      log('info', `原始查询返回 ${allUsers.length} 条用户记录`);
      log('debug', `用户ID列表:`, allUsers.map(u => u._id.toString()));
      
      // 手动处理投影，移除密码字段
      return allUsers.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
    });
    
    // 详细日志记录
    log('info', `成功查询到 ${users.length} 条用户记录`);
    
    if (users.length > 0) {
      log('debug', '返回的第一个用户数据示例:', JSON.stringify(users[0], null, 2));
    }
    
    // 检查查询结果
    if (users.length !== totalCount) {
      log('warn', `警告: 查询结果数量(${users.length})与集合总记录数(${totalCount})不一致`);
    }
    
    log('info', `获取用户列表成功: 返回 ${users.length} 个用户`);
    return successResponse(c, { users });
  } catch (error) {
    logError(error, { operation: 'getUsersList' });
    
    // 详细记录错误信息
    log('error', "获取用户列表出错:", {
      message: error.message || "未知错误",
      stack: error.stack || "无堆栈信息",
      name: error.name || "未知错误类型"
    });
    
    // 使用完整的错误消息
    const errorMessage = error.message || "未知错误";
    return errorResponse(c, `获取用户列表失败: ${errorMessage}`, 500);
  }
});

// 获取所有销售人员 (原厂销售和超级管理员)
userRouter.get('/sales', async (c) => {
  log('info', '处理获取销售人员列表请求...');
  try {
    const collection = db.collection('4d2a803d_users');
    
    // 查询所有角色为FACTORY_SALES且状态为approved的用户
    logDbOperation('find', '4d2a803d_users', 
      { role: UserRole.FACTORY_SALES, status: UserStatus.APPROVED }, 
      { projection: { password: 0 } }
    );
    
    const users = await executeDbOperation(async () => {
      return await collection.find({
        role: UserRole.FACTORY_SALES,
        status: UserStatus.APPROVED
      })
      .project({ password: 0 })
      .toArray();
    });
    
    log('info', `成功查询到 ${users.length} 条销售人员记录`);
    
    if (users.length > 0) {
      log('debug', '返回的第一个销售人员数据示例:', JSON.stringify(users[0], null, 2));
    }
    
    // 修改返回格式，确保与前端期望的数据结构一致
    return successResponse(c, { users });
  } catch (error) {
    logError(error, { operation: 'getSalesUsersList' });
    
    // 详细记录错误信息
    log('error', "获取销售人员列表出错:", {
      message: error.message || "未知错误",
      stack: error.stack || "无堆栈信息",
      name: error.name || "未知错误类型"
    });
    
    // 使用完整的错误消息
    const errorMessage = error.message || "未知错误";
    return errorResponse(c, `获取销售人员列表失败: ${errorMessage}`, 500);
  }
});

// 获取待审批用户 (仅超级管理员)
userRouter.get('/pending/approval', permissionMiddleware('users', 'read'), async (c) => {
  console.log('处理获取待审批用户请求...');
  try {
    const usersCollection = db.collection('4d2a803d_users');
    
    console.log("正在获取待审批用户列表...");
    console.log(`查询集合: 4d2a803d_users`);
    console.log(`查询条件: { status: 'pending' }`);
    
    // 获取待审批的普通用户
    const pendingUsers = await usersCollection
      .find({ status: UserStatus.PENDING })
      .project({ password: 0 })
      .toArray();
    
    console.log(`找到 ${pendingUsers.length} 个待审批用户`);
    
    // 不再获取和合并代理商数据
    
    return successResponse(c, { pendingAccounts: pendingUsers });
  } catch (error) {
    console.error("获取待审批用户出错:", error);
    console.error("错误详情:", JSON.stringify({
      message: error.message || "未知错误",
      stack: error.stack || "无堆栈信息",
      name: error.name || "未知错误类型"
    }, null, 2));
    
    // 使用完整的错误消息
    const errorMessage = error.message || "未知错误";
    return errorResponse(c, `获取待审批用户失败: ${errorMessage}`, 500);
  }
});

// 审批用户 (仅超级管理员)
const approvalSchema = z.object({
  id: z.string(),
  type: z.enum(['user', 'agent']),
  approved: z.boolean(),
  reason: z.string().optional()
});

userRouter.post('/approve', 
  permissionMiddleware('users', 'update'),
  zValidator('json', approvalSchema),
  async (c) => {
    const { id, type, approved, reason } = await c.req.json();
    
    try {
      const collectionName = type === 'user' ? '4d2a803d_users' : '4d2a803d_agents';
      const collection = db.collection(collectionName);
      
      // 检查账户是否存在
      const account = await collection.findOne({ _id: new mongo.ObjectId(id) });
      if (!account) {
        throw createNotFoundError('账户');
      }
      
      // 检查是否已经被审批
      if (account.status !== UserStatus.PENDING) {
        throw createBadRequestError('该账户已经被审批过');
      }
      
      // 更新用户状态
      const newStatus = approved ? UserStatus.APPROVED : UserStatus.REJECTED;
      const updateData: any = { status: newStatus };
      
      // 如果拒绝，添加拒绝原因
      if (!approved && reason) {
        updateData.rejectionReason = reason;
      }
      
      const result = await collection.updateOne(
        { _id: new mongo.ObjectId(id) },
        { $set: updateData }
      );
      
      if (result.modifiedCount === 0) {
        throw createBadRequestError('账户状态更新失败');
      }
      
      return successResponse(c, null, approved ? "已批准账户" : "已拒绝账户");
    } catch (error) {
      console.error("审批账户出错:", error.message);
      if (error instanceof ApiError) {
        return errorResponse(c, error.message, error.statusCode);
      }
      return errorResponse(c, "审批账户失败", 500);
    }
  }
);

// 创建用户 (仅超级管理员)
const createUserSchema = z.object({
  username: z.string().min(2, "用户名至少2个字符"),
  password: z.string().min(6, "密码至少6个字符"),
  phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号"),
  role: z.enum([
    UserRole.SUPER_ADMIN, 
    UserRole.FACTORY_SALES, 
    UserRole.INVENTORY_MANAGER
  ])
});

userRouter.post('/', 
  permissionMiddleware('users', 'create'),
  zValidator('json', createUserSchema),
  async (c) => {
    const userData = await c.req.json();
    
    try {
      const collection = db.collection('4d2a803d_users');
      
      // 检查用户名是否已存在
      const existingUser = await executeDbOperation(async () => {
        return await collection.findOne({ username: userData.username });
      });
      
      if (existingUser) {
        throw createBadRequestError("用户名已存在");
      }
      
      // 检查是否有超级管理员角色
      if (userData.role === UserRole.SUPER_ADMIN) {
        const existingAdmin = await executeDbOperation(async () => {
          return await collection.findOne({ role: UserRole.SUPER_ADMIN });
        });
        
        if (existingAdmin) {
          throw createBadRequestError("已存在超级管理员");
        }
      }
      
      // 创建新用户(直接批准)
      const newUser: User = {
        username: userData.username,
        password: userData.password,
        phone: userData.phone,
        role: userData.role,
        status: UserStatus.APPROVED,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      log('info', '准备插入新用户数据', { 
        username: newUser.username, 
        role: newUser.role, 
        status: newUser.status 
      });
      
      // 包装数据库插入操作，提供重试机制
      const result = await executeDbOperation(async () => {
        try {
          const insertResult = await collection.insertOne(newUser);
          log('info', '用户数据插入成功', { insertedId: insertResult.insertedId });
          return insertResult;
        } catch (dbError) {
          logError(dbError, { 
            operation: 'insertOne', 
            collection: '4d2a803d_users',
            user: { username: newUser.username, role: newUser.role }
          });
          throw dbError;
        }
      });
      
      if (!result || !result.insertedId) {
        throw new Error('数据库插入失败，未返回insertedId');
      }
      
      // 验证插入是否成功
      const insertedUser = await executeDbOperation(async () => {
        return await collection.findOne({ _id: result.insertedId });
      });
      
      if (!insertedUser) {
        log('error', '用户创建后无法查询到，可能数据库写入失败', { insertedId: result.insertedId });
        throw new Error('用户创建后无法查询到，可能数据库写入失败');
      }
      
      log('info', '用户创建成功', { 
        _id: result.insertedId, 
        username: newUser.username 
      });
      
      // 返回用户信息（不包含密码）
      const { password, ...userWithoutPassword } = newUser;
      
      return successResponse(c, {
        user: {
          ...userWithoutPassword,
          _id: result.insertedId
        }
      }, "创建用户成功", 201);
    } catch (error) {
      // 详细记录错误信息
      console.error("创建用户出错:", error);
      console.error("错误详情:", JSON.stringify({
        message: error.message || "未知错误",
        stack: error.stack || "无堆栈信息",
        name: error.name || "未知错误类型",
        userData: { 
          username: userData.username,
          role: userData.role,
          phone: userData.phone
        }
      }, null, 2));
      
      logError(error, { 
        operation: '创建用户', 
        userData: { 
          username: userData.username, 
          role: userData.role 
        } 
      });
      
      if (error instanceof ApiError) {
        return errorResponse(c, error.message, error.statusCode);
      }
      return errorResponse(c, `创建用户失败: ${error.message || "未知错误"}`, 500);
    }
  }
);

// 更新用户 (仅超级管理员)
const updateUserSchema = z.object({
  username: z.string().min(2, "用户名至少2个字符").optional(),
  phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号").optional(),
  role: z.enum([
    UserRole.SUPER_ADMIN, 
    UserRole.FACTORY_SALES, 
    UserRole.INVENTORY_MANAGER
  ]).optional(),
  password: z.string().min(6, "密码至少6个字符").optional()
});

userRouter.put('/:id', 
  permissionMiddleware('users', 'update'),
  zValidator('json', updateUserSchema),
  async (c) => {
    const id = c.req.param('id');
    const updateData = await c.req.json();
    const currentUser = c.get('user');
    
    try {
      const collection = db.collection('4d2a803d_users');
      
      // 检查用户是否存在
      const user = await collection.findOne({ _id: new mongo.ObjectId(id) });
      if (!user) {
        throw createNotFoundError('用户');
      }
      
      // 检查是否是超级管理员修改自己
      const isSelfUpdate = currentUser.id === id;
      
      // 如果是修改自己，不能修改自己的角色
      if (isSelfUpdate && updateData.role && updateData.role !== user.role) {
        throw createBadRequestError("不能修改自己的角色");
      }
      
      // 如果更改为超级管理员，检查是否已存在
      if (updateData.role === UserRole.SUPER_ADMIN && user.role !== UserRole.SUPER_ADMIN) {
        const existingAdmin = await collection.findOne({ 
          role: UserRole.SUPER_ADMIN,
          _id: { $ne: new mongo.ObjectId(id) }
        });
        
        if (existingAdmin) {
          throw createBadRequestError("已存在超级管理员");
        }
      }
      
      // 如果修改了用户名，检查是否已存在
      if (updateData.username && updateData.username !== user.username) {
        const existingUsername = await collection.findOne({
          username: updateData.username,
          _id: { $ne: new mongo.ObjectId(id) }
        });
        
        if (existingUsername) {
          throw createBadRequestError("用户名已存在");
        }
      }
      
      // 添加更新时间
      updateData.updatedAt = new Date();
      
      // 更新用户
      const result = await collection.updateOne(
        { _id: new mongo.ObjectId(id) },
        { $set: updateData }
      );
      
      if (result.modifiedCount === 0) {
        return successResponse(c, null, "用户数据未变更");
      }
      
      return successResponse(c, null, "更新用户成功");
    } catch (error) {
      console.error("更新用户出错:", error.message);
      if (error instanceof ApiError) {
        return errorResponse(c, error.message, error.statusCode);
      }
      return errorResponse(c, "更新用户失败", 500);
    }
  }
);

// 删除用户 (仅超级管理员)
userRouter.delete('/:id', permissionMiddleware('users', 'delete'), async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  
  try {
    // 检查是否在删除自己
    if (user.id === id) {
      throw createBadRequestError("不能删除当前登录账户");
    }
    
    const collection = db.collection('4d2a803d_users');
    
    // 检查用户是否存在
    const userToDelete = await collection.findOne({ _id: new mongo.ObjectId(id) });
    if (!userToDelete) {
      throw createNotFoundError('用户');
    }
    
    // 检查是否删除的是超级管理员
    if (userToDelete.role === UserRole.SUPER_ADMIN) {
      throw createBadRequestError("不能删除超级管理员账户");
    }
    
    const result = await collection.deleteOne({ _id: new mongo.ObjectId(id) });
    
    if (result.deletedCount === 0) {
      throw createNotFoundError('用户');
    }
    
    return successResponse(c, null, "删除用户成功");
  } catch (error) {
    console.error("删除用户出错:", error.message);
    if (error instanceof ApiError) {
      return errorResponse(c, error.message, error.statusCode);
    }
    return errorResponse(c, "删除用户失败", 500);
  }
});

// 新增：验证MongoDB ObjectId格式的工具函数
function isValidObjectId(id: string): boolean {
  try {
    return mongo.ObjectId.isValid(id);
  } catch (error) {
    return false;
  }
}

export default userRouter;