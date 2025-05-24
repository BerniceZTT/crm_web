/**
 * 客户变更相关路由
 * 处理客户分配和变更的专用API
 */

import { Hono } from "hono";
import { zValidator } from '@hono/zod-validator';
import { z } from "zod";
import { authMiddleware, permissionMiddleware } from "../utils/auth";
import { 
  UserRole, 
  CustomerProgress,
  CustomerAssignRequest 
} from "../../shared/types";
import { addAssignmentHistory } from "./customerAssignments";

const changeCustomerRouter = new Hono();

// 所有路由都需要认证
changeCustomerRouter.use('*', authMiddleware);

// 定义客户分配请求的schema
const assignSchema = z.object({
  salesId: z.string().min(1, "销售ID不能为空"),
  agentId: z.string().optional() // 可选的代理商ID
});

// 处理客户分配请求
changeCustomerRouter.post('/:id/assign', zValidator('json', assignSchema), async (c) => {
  const customerId = c.req.param('id');
  const currentUser = c.get('user');
  const { salesId, agentId } = await c.req.json();
  
  try {
    // 这里原来的权限验证代码已被移除
    
    const collection = db.collection('4d2a803d_customers');
    const usersCollection = db.collection('4d2a803d_users');
    const agentsCollection = db.collection('4d2a803d_agents');
    
    // 查询客户
    const customer = await collection.findOne({ 
      _id: new mongo.ObjectId(customerId)
    });
    
    if (!customer) {
      return c.json({ error: "客户不存在" }, 404);
    }
    
    // 这里删除权限验证代码块
    
    // 查询销售信息
    const salesUser = await usersCollection.findOne({ 
      _id: new mongo.ObjectId(salesId)
    });
    
    if (!salesUser) {
      return c.json({ error: "指定的销售人员不存在" }, 404);
    }
    
    // 准备更新数据
    const updateData: any = {
      relatedSalesId: salesId,
      relatedSalesName: salesUser.username,
      lastUpdateTime: new Date(),
      updatedAt: new Date()
    };
    
    // 如果客户在公海，则移出公海
    if (customer.isInPublicPool) {
      updateData.isInPublicPool = false;
      updateData.progress = CustomerProgress.SAMPLE_EVALUATION;
    }
    
    // 处理代理商信息
    let agentInfo = null;
    if (agentId) {
      const agent = await agentsCollection.findOne({ 
        _id: new mongo.ObjectId(agentId)
      });
      
      if (!agent) {
        return c.json({ error: "指定的代理商不存在" }, 404);
      }
      
      updateData.relatedAgentId = agentId;
      updateData.relatedAgentName = agent.companyName;
      agentInfo = {
        id: agentId,
        name: agent.companyName
      };
    } else if (agentId === '' || agentId === null) {
      // 清空代理商关联
      updateData.relatedAgentId = null;
      updateData.relatedAgentName = null;
    }
    
    // 更新客户数据
    const result = await collection.updateOne(
      { _id: new mongo.ObjectId(customerId) },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return c.json({ error: "客户不存在或已被修改" }, 404);
    }
    
    // 优化：合并销售和代理商变更为一条历史记录
    const salesChanged = customer.relatedSalesId !== salesId;
    const agentChanged = 
      (agentId && customer.relatedAgentId !== agentId) ||
      (!agentId && agentId !== undefined && customer.relatedAgentId);
  
    // 只要有变化就记录一条历史
    if (salesChanged || agentChanged) {
      let operationType = '分配';
      
      // 确定操作类型
      if (!salesId && !agentId) {
        operationType = '移入公海池';
      } else if (customer.isInPublicPool) {
        operationType = '认领';
      } else {
        // 判断是否为分配或认领：如果当前用户是被分配的销售或代理商，则为"认领"，否则为"分配"
        if ((currentUser.role === UserRole.FACTORY_SALES && currentUser.id === salesId) ||
            (currentUser.role === UserRole.AGENT && currentUser.id === agentId)) {
          operationType = '认领';
        }
      }
      
      // 记录一条完整的历史记录
      await addAssignmentHistory({
        customerId,
        customerName: customer.name,
        // 销售信息
        fromRelatedSalesId: customer.relatedSalesId || null,
        fromRelatedSalesName: customer.relatedSalesName || null,
        toRelatedSalesId: salesId || null,
        toRelatedSalesName: salesUser ? salesUser.username : null,
        // 代理商信息
        fromRelatedAgentId: customer.relatedAgentId || null,
        fromRelatedAgentName: customer.relatedAgentName || null,
        toRelatedAgentId: agentId || null,
        toRelatedAgentName: agentInfo ? agentInfo.name : null,
        // 操作者信息
        operatorId: currentUser.id,
        operatorName: currentUser.username || currentUser.companyName,
        operationType: operationType // 使用判断后的操作类型
      });
    }
    
    return c.json({
      message: "客户分配成功",
      data: {
        salesId,
        salesName: salesUser.username,
        agentId: agentId || null,
        agentName: agentInfo ? agentInfo.name : null
      }
    });
    
  } catch (error) {
    console.error("分配客户出错:", error.message);
    return c.json({ error: "分配客户失败: " + error.message }, 500);
  }
});

export default changeCustomerRouter;