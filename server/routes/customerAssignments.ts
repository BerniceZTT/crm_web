import { Hono } from "hono";
import { ObjectId } from "mongodb";
import { log } from "../utils/logger";
import { CustomerAssignmentHistory } from "../../shared/types";

const customerAssignmentRouter = new Hono();

// 获取客户分配历史记录
customerAssignmentRouter.get("/:customerId", async (c) => {
  try {
    const customerId = c.req.param('customerId');
    
    // 查询客户分配历史记录 - 已更新表名
    const history = await db
      .collection("4d2a803d_customerAssignmentHistory") // 修改表名
      .find({ customerId })
      .sort({ createdAt: -1 })
      .toArray();
    
    // 返回历史记录
    return c.json({ 
      history: history 
    });
    
  } catch (error) {
    log('error', "Error fetching customer assignment history:", error);
    return c.json({ 
      success: false, 
      message: "Failed to fetch customer assignment history" 
    }, 500);
  }
});

/**
 * 添加客户分配历史记录
 * @param {Partial<CustomerAssignmentHistory>} historyData - 历史记录数据
 * @returns {Promise<object>} - 插入结果
 */
export async function addAssignmentHistory(historyData: Partial<CustomerAssignmentHistory>) {
  try {
    // 确保有创建时间字段
    const recordToInsert = {
      ...historyData,
      createdAt: historyData.createdAt || new Date(),
      _id: new ObjectId()
    };
    
    // 插入历史记录 - 已更新表名
    const result = await db
      .collection("4d2a803d_customerAssignmentHistory") // 修改表名
      .insertOne(recordToInsert);
    
    log('info', `Added assignment history record: ${result.insertedId}`);
    return result;
  } catch (error) {
    log('error', "Error adding assignment history:", error);
    throw error;
  }
}

export default customerAssignmentRouter;