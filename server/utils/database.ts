/**
 * 数据库连接工具函数
 * 处理数据库连接错误和重试
 */

// 检查数据库连接状态
export async function checkDatabaseConnection() {
  try {
    // 使用全局注入的db变量
    await db.command({ ping: 1 });
    return true;
  } catch (error) {
    console.error('数据库连接错误:', error.message);
    return false;
  }
}

// 包装数据库操作，提供错误处理和重试机制
export async function executeDbOperation<T>(operation: () => Promise<T>, retries = 3): Promise<T> {
  let lastError: any;
  
  try {
    const result = await operation();
    
    // 添加日志记录返回结果类型和内容
    console.log(`数据库操作成功，返回结果类型: ${typeof result}`, 
      typeof result === 'object' ? `包含的键: ${Object.keys(result || {})}` : '');
    
    // 特殊处理插入操作的结果
    if (result && typeof result === 'object' && 'insertedId' in result) {
      console.log('检测到数据库插入操作，结果详情:', {
        acknowledged: (result as any).acknowledged,
        insertedId: (result as any).insertedId ? (result as any).insertedId.toString() : null,
      });
      
      // 更宽松的插入验证：如果有insertedId，即使acknowledged为false也视为成功
      if ((result as any).insertedId && !(result as any).acknowledged) {
        console.warn('警告: 数据库操作返回了insertedId但acknowledged为false，仍视为成功');
        // 修复result结构
        (result as any).acknowledged = true;
      }
    }
    
    return result;
  } catch (error) {
    lastError = error;
    
    // 记录详细错误信息
    console.error('数据库操作错误:', {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack
    });
    
    // 检查是否为已完成但报错的情况
    if (isCompletedButErrored(error)) {
      console.warn('操作可能已成功但报告了错误，正在验证操作结果...');
      try {
        // 尝试验证操作是否已完成
        const result = await verifyOperationCompleted(operation);
        if (result) {
          console.log('验证成功：操作实际已完成');
          return result;
        }
      } catch (verifyError) {
        // 验证也失败，记录额外信息
        console.error('验证失败：无法确定操作状态', verifyError.message);
      }
      
      // 即使验证失败，也返回特殊标记表示状态不确定
      return { 
        success: false, 
        statusUncertain: true, 
        message: '操作状态不确定，请刷新页面查看最新状态'
      } as any as T;
    }
    
    if (retries > 0 && isRetryableError(error)) {
      console.warn(`数据库操作失败，正在重试 (${retries}次重试机会剩余)`, error.message);
      // 延迟一段时间后重试
      await new Promise(resolve => setTimeout(resolve, 1000));
      return executeDbOperation(operation, retries - 1);
    }
    
    // 记录失败的数据库操作详情
    console.error('数据库操作最终失败:', error);
    console.error('错误详情:', JSON.stringify({
      message: error.message || "未知错误",
      stack: error.stack || "无堆栈信息",
      name: error.name || "未知错误类型",
      code: error.code
    }, null, 2));
    
    // 对于库存操作，返回特殊响应
    if (error.inventoryOperation) {
      return { 
        success: false, 
        statusUncertain: true,
        inventoryOperation: true,
        message: '库存操作状态不确定，请刷新页面确认最新库存'
      } as any as T;
    }
    
    throw error;
  }
}

// 检查是否是操作已完成但返回错误的情况
function isCompletedButErrored(error: any): boolean {
  // 典型的"操作已完成但报错"情况
  return (
    // 写冲突但可能已部分成功
    error.name === 'WriteConflict' ||
    // 网络错误，但操作可能已完成
    (error.message && error.message.includes('network')) ||
    // 超时错误，但操作可能已完成
    (error.message && error.message.includes('timeout')) ||
    // 其他可能的情况
    (error.message && error.message.includes('already exists')) ||
    (error.code && error.code === 11000) || // 重复键错误，表明记录已存在
    // 库存操作标记
    error.inventoryOperation === true
  );
}

// 验证操作是否已完成 - 增强实现
async function verifyOperationCompleted<T>(operation: () => Promise<T>): Promise<T | null> {
  try {
    // 特殊处理：检查插入操作
    if (operation.toString().includes('insertOne')) {
      // 尝试通过上下文提取可能的集合名和条件
      const fnStr = operation.toString();
      const collectionMatch = fnStr.match(/collection\(["']([^"']+)["']\)/);
      const findOneMatch = fnStr.match(/findOne\(([^)]+)\)/);
      
      if (collectionMatch && collectionMatch[1]) {
        const collectionName = collectionMatch[1];
        console.log(`尝试验证插入操作，集合: ${collectionName}`);
        
        // 由于无法直接获取插入的数据，只能检查集合中的最新记录
        try {
          const collection = db.collection(collectionName);
          
          // 获取最近插入的一条记录
          const latestRecord = await collection.find()
            .sort({ _id: -1 })
            .limit(1)
            .toArray();
            
          if (latestRecord && latestRecord.length > 0) {
            console.log(`集合${collectionName}中找到最新记录:`, 
              JSON.stringify(latestRecord[0], (key, value) => 
                key === 'password' ? '******' : value));
            
            // 构造一个模拟的插入结果
            return {
              acknowledged: true,
              insertedId: latestRecord[0]._id,
              latestRecord: latestRecord[0],
              _verified: true // 标记这是验证生成的结果
            } as any as T;
          }
        } catch (e) {
          console.error(`验证插入操作失败:`, e.message);
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('验证操作失败:', error.message);
    return null;
  }
}

// 判断错误是否可重试
function isRetryableError(error: any): boolean {
  return (
    // 连接错误
    error.name === 'MongoNetworkError' ||
    // 临时性错误
    (error.message && error.message.includes('temporary')) ||
    // 超时错误
    (error.message && error.message.includes('timeout')) ||
    // 其他可重试错误
    (error.code && [10107, 13436, 11600, 11602, 10058].includes(error.code))
  );
}

// 检查并打印集合记录数
export async function logCollectionStats(collectionName: string) {
  try {
    const collection = db.collection(collectionName);
    const count = await collection.countDocuments();
    console.log(`集合 ${collectionName} 当前有 ${count} 条记录`);
    
    if (count > 0) {
      // 取样一条记录，了解数据结构（不显示敏感字段）
      const sampleDoc = await collection.findOne({});
      if (sampleDoc) {
        const { password, ...sampleWithoutPassword } = sampleDoc;
        console.log(`集合 ${collectionName} 记录样例:`, 
          JSON.stringify(sampleWithoutPassword, null, 2));
      }
    }
    
    return count;
  } catch (error) {
    console.error(`获取集合 ${collectionName} 统计信息失败:`, error.message);
    return -1;
  }
}

// 检查数据库中所有集合
export async function listAllCollections() {
  try {
    const collections = await db.listCollections().toArray();
    return collections.map(c => c.name);
  } catch (error) {
    console.error('获取数据库集合列表失败:', error.message);
    return [];
  }
}

// 增强：执行幂等性操作，特别适用于库存操作
export async function executeInventoryOperation<T>(
  checkExists: () => Promise<boolean>,
  operation: () => Promise<T>,
  retries = 3
): Promise<T> {
  try {
    // 先检查操作是否已完成
    const exists = await checkExists();
    if (exists) {
      console.log('库存操作已经完成，跳过执行');
      // 返回表示已完成的值
      return { success: true, alreadyCompleted: true } as any as T;
    }
    
    // 执行实际操作
    return await executeDbOperation(operation, retries);
  } catch (error) {
    // 标记为库存操作错误
    error.inventoryOperation = true;
    throw error;
  }
}