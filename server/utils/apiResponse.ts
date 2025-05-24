/**
 * API响应工具函数
 * 提供统一的API响应格式和状态码
 */

import { Context } from 'hono';
import { logApiResponse, logInconsistency } from './logger';

// 成功响应
export async function successResponse(c: Context, data?: any, message = '操作成功', status = 200) {
  return c.json({
    success: true,
    message,
    data
  }, status);
}

// 错误响应
export async function errorResponse(c: Context, message: string, status = 400, errorCode?: string) {
  const requestStartTime = c.get('requestStartTime') || Date.now();
  const responseTime = Date.now() - requestStartTime;
  
  // 记录详细的错误信息到日志
  console.error(`服务器错误(${status}): ${message}`);
  console.error(`请求路径: ${c.req.path}`);
  console.error(`请求方法: ${c.req.method}`);
  console.error(`响应时间: ${responseTime}ms`);
  
  // 增加请求详细信息记录
  try {
    const headers = {};
    for (const [key, value] of Object.entries(c.req.header())) {
      // 敏感信息处理
      if (key.toLowerCase() === 'authorization' && typeof value === 'string') {
        headers[key] = value.substring(0, 15) + '...';
      } else {
        headers[key] = value;
      }
    }
    
    console.error('请求详情:', {
      url: c.req.url,
      path: c.req.path,
      method: c.req.method,
      headers,
      query: c.req.query(),
      body: c.req.json ? await c.req.json().catch(() => null) : null
    });
  } catch (e) {
    console.error('无法读取完整请求信息:', e);
  }
  
  // 对于特定错误，可能表示操作已完成但响应出错
  if (message.includes('duplicate key') || 
      message.includes('already exists') ||
      errorCode === 'DUPLICATE_ENTRY') {
    
    return c.json({
      success: true,
      warning: "操作可能已完成，但返回了警告",
      message: "记录可能已存在，请刷新页面查看最新状态"
    }, 200);
  }
  
  const response: any = {
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  };
  
  if (errorCode) {
    response.errorCode = errorCode;
  }
  
  // 记录API响应
  logApiResponse(c.req.method, c.req.path, status, responseTime, response);
  
  return c.json(response, status);
}

// 分页响应
export function paginatedResponse(
  c: Context, 
  data: any[], 
  total: number, 
  page: number, 
  limit: number
) {
  return c.json({
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  });
}

// 不确定状态响应
export function uncertainResponse(c: Context, message: string, isInventoryOperation = false) {
  // 记录不确定状态
  logInconsistency(
    isInventoryOperation ? '库存操作' : '数据操作', 
    c.req.path, 
    { expected: 'certain status' }, 
    { actual: 'uncertain status' }
  );
  
  return c.json({
    success: false,
    warning: isInventoryOperation 
      ? "库存操作状态不确定，请刷新页面查看最新库存" 
      : "操作状态不确定，请刷新页面查看最新状态",
    error: message
  }, 202); // 使用202 Accepted表示请求已接受但处理状态不确定
}

// 库存操作响应 - 确保正确导出此函数
export function inventoryOperationResponse(c: Context, data: any, success = true) {
  // 记录请求路径和方法，帮助排查问题
  console.log(`库存操作: ${c.req.method} ${c.req.path}`);
  
  // 响应状态码
  const status = success ? 200 : 202;
  
  // 如果操作成功
  if (success) {
    return c.json({
      success: true,
      message: '库存操作成功',
      data
    }, status);
  }
  
  // 如果操作状态不确定
  return c.json({
    success: false,
    warning: "库存操作状态不确定，请刷新页面查看最新库存",
    error: data.error || "无法确认库存操作是否成功"
  }, status);
}