/**
 * 日志工具函数
 * 提供统一的日志记录和错误跟踪
 */

// 日志级别
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// 格式化日志消息
function formatLogMessage(level: LogLevel, message: string, meta?: any): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? `\n${JSON.stringify(meta, null, 2)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

// 记录普通日志
export function log(level: LogLevel, message: string, meta?: any) {
  const formattedMessage = formatLogMessage(level, message, meta);
  
  switch (level) {
    case 'debug':
      console.debug(formattedMessage);
      break;
    case 'info':
      console.info(formattedMessage);
      break;
    case 'warn':
      console.warn(formattedMessage);
      break;
    case 'error':
      console.error(formattedMessage);
      break;
  }
}

// 记录API请求日志
export function logApiRequest(method: string, url: string, params?: any, body?: any, headers?: any) {
  // 过滤掉敏感的Authorization头信息
  const safeHeaders = headers ? { ...headers } : {};
  if (safeHeaders.authorization) {
    safeHeaders.authorization = safeHeaders.authorization.substring(0, 15) + '...';
  }
  
  log('info', `API请求: ${method} ${url}`, { 
    params, 
    body: body ? JSON.stringify(body).substring(0, 500) : undefined,
    headers: safeHeaders
  });
}

// 记录API响应日志
export function logApiResponse(method: string, url: string, statusCode: number, responseTime: number, responseBody?: any) {
  const responseInfo = {
    method,
    url,
    statusCode,
    responseTime: `${responseTime}ms`,
    timestamp: new Date().toISOString()
  };
  
  if (responseBody) {
    // 当响应体不是太大时，记录完整内容
    const responseStr = typeof responseBody === 'string' 
      ? responseBody 
      : JSON.stringify(responseBody);
      
    if (responseStr.length < 1000) {
      responseInfo['body'] = responseBody;
    } else {
      // 只记录部分内容
      responseInfo['body'] = responseStr.substring(0, 1000) + '...';
      responseInfo['bodySize'] = responseStr.length;
    }
  }
  
  if (statusCode >= 400) {
    log('error', `API错误响应: ${method} ${url} - ${statusCode}`, responseInfo);
  } else {
    log('info', `API响应: ${method} ${url} - ${statusCode} (${responseTime}ms)`, responseInfo);
  }
}

// 记录错误日志
export function logError(error: any, context?: any) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  const errorName = error instanceof Error ? error.name : 'Unknown';
  const errorCode = (error as any).code;
  
  // 标记可能导致数据不一致的错误
  const isPotentialInconsistency = 
    errorName === 'MongoNetworkError' ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('network') ||
    (errorCode && errorCode === 11000);
  
  log('error', `错误: ${errorMessage}${isPotentialInconsistency ? ' [可能导致数据不一致]' : ''}`, {
    name: errorName,
    code: errorCode,
    stack: errorStack,
    context,
    isPotentialInconsistency
  });
  
  // 检查是否为MongoDB特定错误
  if (errorName === 'MongoError' || (errorCode && typeof errorCode === 'number')) {
    log('error', `MongoDB错误: ${errorMessage}`, {
      code: errorCode,
      context
    });
  }
}

// 记录数据库操作日志
export function logDbOperation(operation: string, collection: string, query?: any, result?: any) {
  log('debug', `数据库操作: ${operation} - ${collection}`, { 
    query, 
    result: typeof result === 'object' ? '结果对象' : result 
  });
}

// 新增：记录数据库操作结果不一致的情况
export function logInconsistency(operation: string, path: string, expected: any, actual: any) {
  const isInventoryOperation = operation.includes('库存') || 
                              path.includes('/inventory') || 
                              path.includes('/products');
  
  const severityLevel = isInventoryOperation ? 'error' : 'warn';
  
  log(severityLevel, `数据一致性问题: ${operation} - ${path}`, {
    expected,
    actual,
    isInventoryOperation,
    timestamp: new Date().toISOString()
  });
  
  // 对库存操作特别提醒
  if (isInventoryOperation) {
    console.error(`
    ================================
    警告: 库存操作可能导致数据不一致!
    路径: ${path}
    操作: ${operation}
    时间: ${new Date().toISOString()}
    ================================
    `);
  }
}

// 新增：记录库存操作日志
export function logInventoryOperation(operation: string, productId: string, quantity: number, success: boolean) {
  const status = success ? '成功' : '状态不确定';
  log('info', `库存操作: ${operation}`, {
    productId,
    quantity,
    status,
    timestamp: new Date().toISOString()
  });
}