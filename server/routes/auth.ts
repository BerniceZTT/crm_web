/**
 * 认证相关路由
 * 处理用户登录、注册和认证验证
 */

import { Hono } from "hono";
import { zValidator } from '@hono/zod-validator';
import { z } from "zod";
import { generateToken, hashPassword, verifyPassword } from "../utils/auth";
import { User, UserRole, UserStatus } from "../../shared/types";
import { successResponse, errorResponse } from "../utils/apiResponse";
import { authMiddleware } from "../utils/auth";
import { executeDbOperation, logCollectionStats } from "../utils/database";
import { logApiRequest, logError } from "../utils/logger";

// 创建认证路由实例
const authRouter = new Hono();

// 用户登录 - 更新Schema，添加代理商登录选项
const loginSchema = z.object({
  username: z.string().min(1, "用户名不能为空"),
  password: z.string().min(1, "密码不能为空"),
  isAgent: z.boolean().optional().default(false)
});

authRouter.post('/login', zValidator('json', loginSchema), async (c) => {
  const { username, password, isAgent } = await c.req.json();
  
  try {
    logApiRequest('POST', '/api/auth/login', {}, { username, password: '******', isAgent });
    console.log(`登录尝试: ${username}, 类型: ${isAgent ? '代理商' : '用户'}`);
    
    let user = null;
    let agent = null;
    
    // 根据登录类型选择查询顺序
    if (isAgent) {
      // 先查询代理商表
      const agentsCollection = db.collection('4d2a803d_agents');
      agent = await agentsCollection.findOne({ companyName: username });
      
      // 如果没找到，也尝试查询用户表
      if (!agent) {
        const usersCollection = db.collection('4d2a803d_users');
        user = await usersCollection.findOne({ username });
      }
    } else {
      // 先查询用户表
      const usersCollection = db.collection('4d2a803d_users');
      user = await usersCollection.findOne({ username });
      
      // 如果没找到，也尝试查询代理商表
      if (!user) {
        const agentsCollection = db.collection('4d2a803d_agents');
        agent = await agentsCollection.findOne({ companyName: username });
      }
    }
    
    // 处理未找到用户或代理商的情况
    if (!user && !agent) {
      console.log(`登录失败: 用户名不存在 (${username})`);
      return errorResponse(c, "用户名不存在，请检查用户名或注册新账号", 401);
    }
    
    // 处理代理商登录
    if (agent) {
      // 检查代理商状态
      if (agent.status === UserStatus.PENDING) {
        console.log(`代理商登录失败: 账户待审核 (${username})`);
        return errorResponse(c, "账户正在审核中，请等待审核通过", 403);
      } else if (agent.status === UserStatus.REJECTED) {
        console.log(`代理商登录失败: 账户已被拒绝 (${username})`);
        return errorResponse(c, "账户已被拒绝", 403);
      } else if (agent.status !== UserStatus.APPROVED) {
        return errorResponse(c, "账户状态异常", 403);
      }
      
      // 验证密码
      if (!verifyPassword(password, agent.password)) {
        console.log(`代理商登录失败: 密码错误 (${username})`);
        return errorResponse(c, "用户名或密码错误", 401);
      }
      
      // 为代理商创建用户对象(用于前端统一处理)
      const agentUser = {
        _id: agent._id,
        username: agent.companyName,
        role: UserRole.AGENT,
        contactPerson: agent.contactPerson,
        phone: agent.phone,
        relatedSalesId: agent.relatedSalesId, // 添加关联销售ID
        relatedSalesName: agent.relatedSalesName // 添加关联销售名称
      };
      
      console.log(`代理商密码验证成功，准备生成token，数据:`, { 
        _id: agent._id, 
        companyName: agent.companyName,
        relatedSalesId: agent.relatedSalesId // 记录日志
      });
      
      // 生成JWT令牌
      try {
        const token = generateToken(agentUser);
        
        // 额外的token验证确保它是有效的字符串
        if (!token || typeof token !== 'string') {
          throw new Error('生成的token不是有效的字符串类型');
        }
        
        if (token.length < 20) {
          throw new Error(`生成的token长度不足: ${token.length}`);
        }
        
        if (token.split('.').length !== 3) {
          throw new Error('生成的token不是有效的JWT格式 (需要三段式结构)');
        }
        
        // 去除敏感信息
        const agentWithoutPassword = { ...agent };
        delete agentWithoutPassword.password;
        
        console.log(`代理商 ${username} 登录成功, token长度: ${token.length}, 格式有效`);
        
        return successResponse(c, { 
          token, 
          user: {
            ...agentWithoutPassword,
            role: UserRole.AGENT,
            username: agent.companyName,
            relatedSalesId: agent.relatedSalesId, // 确保关联销售ID包含在响应中
            relatedSalesName: agent.relatedSalesName // 确保关联销售名称包含在响应中
          }
        });
      } catch (tokenError) {
        console.error('生成代理商token失败:', tokenError.message, tokenError.stack);
        logError(tokenError, { endpoint: '/api/auth/login', username });
        return errorResponse(c, "生成登录令牌失败，请重试", 500);
      }
    }
    
    // 处理用户登录
    if (user) {
      // 检查用户状态
      if (user.status === UserStatus.PENDING) {
        console.log(`登录失败: 用户账户待审核 (${username})`);
        return errorResponse(c, "账户正在审核中，请等待审核通过", 403);
      } else if (user.status === UserStatus.REJECTED) {
        console.log(`登录失败: 用户账户已被拒绝 (${username})`);
        return errorResponse(c, "账户已被拒绝，原因: " + (user.rejectionReason || "未提供"), 403);
      } else if (user.status !== UserStatus.APPROVED) {
        return errorResponse(c, "账户状态异常", 403);
      }
      
      // 验证密码
      if (!verifyPassword(password, user.password)) {
        console.log(`登录失败: 密码错误 (${username})`);
        return errorResponse(c, "用户名或密码错误", 401);
      }
      
      // 去除敏感信息
      const userWithoutPassword = { ...user };
      delete userWithoutPassword.password;
      
      console.log(`密码验证成功，准备生成token，用户数据:`, { 
        _id: user._id, 
        username: user.username, 
        role: user.role 
      });
      
      // 生成JWT令牌
      try {
        const token = generateToken(user);
        
        // 额外的token验证确保它是有效的字符串
        if (!token || typeof token !== 'string') {
          throw new Error('生成的token不是有效的字符串类型');
        }
        
        if (token.length < 20) {
          throw new Error(`生成的token长度不足: ${token.length}`);
        }
        
        if (token.split('.').length !== 3) {
          throw new Error('生成的token不是有效的JWT格式 (需要三段式结构)');
        }
        
        console.log(`用户 ${username} 登录成功, token长度: ${token.length}, 格式有效`);
        
        return successResponse(c, { 
          token, 
          user: userWithoutPassword 
        });
      } catch (tokenError) {
        console.error('生成token失败:', tokenError.message, tokenError.stack);
        logError(tokenError, { endpoint: '/api/auth/login', user: username });
        return errorResponse(c, "生成登录令牌失败，请重试", 500);
      }
    }
    
    // 如果执行到这里，说明有逻辑漏洞
    console.error(`登录处理逻辑异常: 用户/代理商检查完毕后无法确定身份 (${username})`);
    return errorResponse(c, "登录处理失败，请重试", 500);
  } catch (error) {
    console.error("登录过程中发生错误:", error.message, error.stack);
    logError(error, { endpoint: '/api/auth/login', username });
    return errorResponse(c, `登录失败: ${error.message}`, 500);
  }
});

// 代理商登录 - 保留原有接口，用于兼容现有客户端
const agentLoginSchema = z.object({
  companyName: z.string().min(1, "公司名称不能为空"),
  password: z.string().min(1, "密码不能为空")
});

authRouter.post('/agent/login', zValidator('json', agentLoginSchema), async (c) => {
  const { companyName, password } = await c.req.json();
  
  // 直接调用统一登录接口，但标记为代理商登录
  try {
    logApiRequest('POST', '/api/auth/agent/login', {}, { companyName, password: '******' });
    console.log(`代理商登录接口调用，重定向至统一登录: ${companyName}`);
    
    // 重定向到新的登录实现
    const loginPayload = { username: companyName, password, isAgent: true };
    const response = await c.req.clone().json();
    
    const request = new Request(c.req.url.replace('/agent/login', '/login'), {
      method: 'POST',
      headers: c.req.headers,
      body: JSON.stringify(loginPayload)
    });
    
    // 创建新的上下文用于处理重定向的请求
    const loginCtx = c.req.raw ? 
      c.clone({ req: { raw: request } }) : 
      c.clone({ req: request });
    
    // 调用统一登录接口
    await authRouter.fetch(request);
    
    // 获取请求结果
    const result = await request.json();
    return c.json(result);
  } catch (error) {
    console.error("代理商登录重定向失败:", error.message, error.stack);
    logError(error, { endpoint: '/api/auth/agent/login', companyName });
    return errorResponse(c, `登录失败: ${error.message}`, 500);
  }
});

// 用户注册
const registerSchema = z.object({
  username: z.string().min(2, "用户名至少2个字符"),
  password: z.string().min(6, "密码至少6个字符"),
  phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号"),
  role: z.enum([UserRole.FACTORY_SALES, UserRole.INVENTORY_MANAGER])
});

authRouter.post('/register', zValidator('json', registerSchema), async (c) => {
  const userData = await c.req.json();
  
  logApiRequest('POST', '/api/auth/register', {}, userData);
  console.log('用户注册请求数据:', JSON.stringify({...userData, password: '******'}));
  
  try {
    const collection = db.collection('4d2a803d_users');
    
    // 检查用户名是否已存在
    const existingUser = await executeDbOperation(async () => {
      return await collection.findOne({ username: userData.username });
    });
    
    if (existingUser) {
      // 确保只返回一次错误消息，保持简洁清晰
      return errorResponse(c, "用户名已存在", 409);
    }
    
    // 哈希密码
    const hashedPassword = hashPassword(userData.password);
    
    // 创建新用户(待审批状态)
    const newUser: User = {
      username: userData.username,
      password: hashedPassword,
      phone: userData.phone,
      role: userData.role,
      status: UserStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log('准备创建新用户:', JSON.stringify({...newUser, password: '******'}));
    
    // 使用executeDbOperation包装数据库操作，提供重试机制
    try {
      const result = await executeDbOperation(async () => {
        return await collection.insertOne(newUser);
      });
      
      console.log('用户创建结果详情:', JSON.stringify({
        acknowledged: result.acknowledged,
        insertedId: result.insertedId ? result.insertedId.toString() : undefined,
        hasInsertedId: !!result.insertedId,
        resultType: typeof result,
        resultKeys: Object.keys(result)
      }));
      
      // 更宽松的验证逻辑：只要结果是对象就行，不一定要求acknowledged为true
      if (!result || typeof result !== 'object') {
        throw new Error(`插入结果类型异常: ${typeof result}`);
      }
      
      // 放宽验证条件：不再严格要求acknowledged为true
      if (result._verified) {
        console.log('用户创建成功 (通过验证机制确认)');
      } else if (result.insertedId) {
        console.log('用户创建成功 (检测到有效的insertedId)');
      } else {
        // 即使没有上述明确标志，也尝试进行验证
        console.warn('未检测到明确的成功标志，尝试验证用户是否已插入...');
      }
      
      // 额外验证：检查用户是否真的被插入
      const verifyUser = await collection.findOne({ 
        username: userData.username 
      });
      
      if (verifyUser) {
        console.log('验证成功: 用户已成功插入数据库，ID:', verifyUser._id);
        return successResponse(c, null, "注册申请已提交，请等待管理员审批", 201);
      } else {
        throw new Error('用户创建验证失败，无法在数据库中找到新创建的用户');
      }
    } catch (dbError) {
      // 详细记录数据库操作错误
      console.error('数据库插入操作失败:', dbError);
      console.error('错误详情:', {
        message: dbError.message,
        name: dbError.name,
        code: dbError.code,
        stack: dbError.stack
      });
      
      // 再次进行最终验证 - 有可能即使报错了，用户仍然被创建
      try {
        const finalCheck = await collection.findOne({ username: userData.username });
        if (finalCheck) {
          console.warn('虽然操作报错，但用户已成功创建！返回成功响应');
          return successResponse(c, null, "注册申请已提交，请等待管理员审批", 201);
        }
      } catch (finalCheckError) {
        console.error('最终验证失败:', finalCheckError.message);
      }
      
      // 如果是重复键错误(code 11000)，可能是用户名检查无法捕获的重复情况
      if (dbError.code === 11000) {
        return errorResponse(c, "用户名或其他唯一字段已存在", 409);
      }
      
      throw dbError; // 重新抛出以便外层捕获
    }
  } catch (error) {
    console.error("注册失败:", error.message);
    console.error("详细错误信息:", {
      stack: error.stack,
      code: error.code,
      name: error.name
    });
    logError(error, { endpoint: '/api/auth/register', userData: {...userData, password: '******'} });
    
    // 最后一次验证尝试 - 不管报什么错，再检查一次用户是否已创建
    try {
      const collection = db.collection('4d2a803d_users');
      const lastCheck = await collection.findOne({ username: userData.username });
      if (lastCheck) {
        console.warn('最终确认: 虽然过程中出错，但用户已成功创建！');
        return successResponse(c, null, "注册申请已提交，请等待管理员审批", 201);
      }
    } catch (e) {
      console.error('最终验证异常:', e.message);
    }
    
    // 改进错误消息，提供更多信息帮助排查
    let errorMessage = `注册失败: ${error.message}`;
    if (error.code) {
      errorMessage += ` (错误码: ${error.code})`;
    }
    
    return errorResponse(c, errorMessage, 500);
  }
});

// 代理商注册
const agentRegisterSchema = z.object({
  companyName: z.string().min(2, "公司名称至少2个字符"),
  contactPerson: z.string().min(2, "联系人至少2个字符"),
  password: z.string().min(6, "密码至少6个字符"),
  phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号")
});

authRouter.post('/agent/register', zValidator('json', agentRegisterSchema), async (c) => {
  const agentData = await c.req.json();
  
  logApiRequest('POST', '/api/auth/agent/register', {}, {...agentData, password: '******'});
  console.log('代理商注册请求数据:', JSON.stringify({...agentData, password: '******'}));
  
  try {
    const collection = db.collection('4d2a803d_agents');
    
    // 检查公司名是否已存在
    const existingAgent = await executeDbOperation(async () => {
      return await collection.findOne({ companyName: agentData.companyName });
    });
    
    if (existingAgent) {
      return errorResponse(c, "代理商公司名已存在", 409);
    }
    
    // 哈希密码
    const hashedPassword = hashPassword(agentData.password);
    
    // 创建新代理商(待审批状态)
    const newAgent = {
      companyName: agentData.companyName,
      contactPerson: agentData.contactPerson,
      password: hashedPassword,
      phone: agentData.phone,
      status: UserStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log('准备创建新代理商:', JSON.stringify({...newAgent, password: '******'}));
    
    // 使用executeDbOperation包装数据库操作，提供重试机制
    const result = await executeDbOperation(async () => {
      return await collection.insertOne(newAgent);
    });
    
    console.log('代理商创建结果:', result.acknowledged ? '成功' : '失败', 
                'insertedId:', result.insertedId);
    
    // 验证是否成功插入
    if (!result.acknowledged || !result.insertedId) {
      throw new Error('代理商创建失败，未能获得插入ID');
    }
    
    // 记录代理商集合统计信息
    await logCollectionStats('4d2a803d_agents');
    
    return successResponse(c, null, "代理商注册申请已提交，请等待审批", 201);
  } catch (error) {
    console.error("代理商注册失败:", error.message);
    logError(error, { endpoint: '/api/auth/agent/register', agentData: {...agentData, password: '******'} });
    return errorResponse(c, `注册失败: ${error.message}`, 500);
  }
});

// 添加token验证接口
authRouter.get('/validate', authMiddleware, async (c) => {
  try {
    logApiRequest('GET', '/api/auth/validate', {});
    
    // 由于经过了authMiddleware，此时用户信息已在context中
    const user = c.get('user');
    
    if (!user) {
      console.log('Token验证失败: 未找到用户信息');
      return errorResponse(c, "无效的token", 401);
    }
    
    // 检查是否有必要的字段
    if (!user.id || !user.username || !user.role) {
      console.log('Token验证失败: 用户信息不完整', user);
      return errorResponse(c, "无效的token: 用户信息不完整", 401);
    }
    
    console.log(`Token验证成功: 用户 ${user.username}, 角色 ${user.role}`);
    
    // 去除敏感信息
    if (user.password) {
      delete user.password;
    }
    
    return successResponse(c, { user });
  } catch (error) {
    console.error("Token验证失败:", error.message);
    return errorResponse(c, "无效的token: " + error.message, 401);
  }
});

// 添加默认导出语句
export default authRouter;