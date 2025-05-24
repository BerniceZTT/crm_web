/**
 * 错误处理工具函数
 * 提供统一的错误处理机制和日志记录
 */

import { Context } from "hono";
import { logError, logInconsistency } from "./logger";

// 自定义API错误类
export class ApiError extends Error {
  statusCode: number;
  errorCode?: string;

  constructor(message: string, statusCode: number = 500, errorCode?: string) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.name = 'ApiError';
  }
}

// 处理错误的工具函数
export function handleError(c: Context, error: unknown) {
  // 记录错误
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`API错误: ${errorMessage}`);
  
  // 详细记录错误信息
  logError(error, {
    path: c.req.path,
    method: c.req.method,
    headers: Object.fromEntries(c.req.raw.headers)
  });
  
  // 处理已知类型的错误
  if (error instanceof ApiError) {
    return c.json({ 
      error: error.message,
      ...(error.errorCode ? { code: error.errorCode } : {})
    }, error.statusCode);
  }
  
  // 处理状态不确定的库存操作
  if (error && (error as any).statusUncertain && (error as any).inventoryOperation) {
    logInconsistency('库存操作', c.req.path, { expected: 'success' }, { actual: 'unknown' });
    return c.json({ 
      success: false,
      warning: "库存操作可能已成功，请刷新页面查看最新库存状态",
      error: "库存操作状态不确定，请刷新页面"
    }, 202);
  }
  
  // 处理状态不确定的操作
  if (error && (error as any).statusUncertain) {
    return c.json({ 
      success: false,
      warning: "操作可能已成功，请刷新页面查看最新状态",
      error: errorMessage
    }, 202);
  }
  
  // MongoDB错误处理
  if (error instanceof Error && 
      (error.name === 'MongoError' || error.name === 'MongoServerError')) {
    // 处理重复键错误
    if ((error as any).code === 11000) {
      logInconsistency('数据库操作', c.req.path, { expected: 'new record' }, { actual: 'duplicate key' });
      return c.json({ 
        success: true,
        warning: "操作可能已成功完成，请刷新页面查看最新状态",
        error: "数据已存在，请检查是否有重复" 
      }, 200);
    }
  }
  
  // 库存相关错误特殊处理
  if (c.req.path.includes('/inventory') || c.req.path.includes('/products') && 
      c.req.method !== 'GET') {
    logInconsistency('库存操作', c.req.path, { expected: 'success' }, { actual: 'error' });
    return c.json({ 
      success: false,
      warning: "库存操作状态不确定，请刷新页面查看最新状态",
      error: errorMessage
    }, 202);
  }
  
  // 网络相关错误可能是操作已完成但连接断开
  if (error instanceof Error && 
      (error.name === 'NetworkError' || 
       error.message.includes('network') || 
       error.message.includes('timeout'))) {
    logInconsistency('网络错误', c.req.path, { expected: 'success' }, { actual: 'network error' });
    return c.json({ 
      success: false,
      warning: "操作状态不确定，请刷新页面检查最新状态",
      error: errorMessage
    }, 202);
  }
  
  // 其他未预期的错误
  return c.json({ 
    error: errorMessage,
    success: false
  }, 500);
}

// 错误处理中间件
export async function errorMiddleware(c: Context, next: Function) {
  try {
    await next();
  } catch (error) {
    return handleError(c, error);
  }
}

// 常用的错误创建函数
export function createNotFoundError(resource: string) {
  return new ApiError(`${resource}不存在`, 404, 'RESOURCE_NOT_FOUND');
}

export function createUnauthorizedError() {
  return new ApiError('未授权访问', 401, 'UNAUTHORIZED');
}

export function createForbiddenError() {
  return new ApiError('权限不足', 403, 'FORBIDDEN');
}

export function createBadRequestError(message: string) {
  return new ApiError(message, 400, 'BAD_REQUEST');
}

// 新增：创建操作结果不确定的错误
export function createUncertainOperationError() {
  return new ApiError(
    '操作状态不确定，请刷新页面查看最新状态', 
    500, 
    'UNCERTAIN_OPERATION'
  );
}