/**
 * API工具函数
 * 封装HTTP请求和统一错误处理
 */

import { message } from 'antd';

interface ApiOptions {
  showSuccessMessage?: boolean;
  showErrorMessage?: boolean;
  ignoreAuthError?: boolean; // 忽略认证错误（用于登录页面）
}

// 可配置默认选项
const DEFAULT_API_OPTIONS: ApiOptions = {
  showSuccessMessage: false,
  showErrorMessage: true,
  ignoreAuthError: false
};

// 安全地检查一个值是否是有效的字符串
function isValidString(value: any): value is string {
  return typeof value === 'string' && value.length > 0;
}

// 检查当前是否在登录页面
function isOnLoginPage() {
  return window.location.hash.includes('/login') || 
         window.location.pathname.includes('/login');
}

// 处理重定向到登录页
function redirectToLogin(message?: string) {
  // 不在登录页才执行重定向
  if (!isOnLoginPage()) {
    // 记录当前URL，便于登录后返回
    const currentPath = window.location.pathname + window.location.hash + window.location.search;
    localStorage.setItem('loginRedirectUrl', currentPath);
    
    // 显示消息
    if (message) {
      // 使用sessionStorage临时保存消息，登录页面加载时显示
      sessionStorage.setItem('loginMessage', message);
    }
    
    console.log('重定向到登录页...');
    
    // 使用相对路径进行导航
    const baseUrl = window.location.origin;
    window.location.href = `${baseUrl}/#/login`;
  }
}

// 改进的API工具函数，增强错误处理
export async function fetchApi(
  endpoint: string,
  method: string = 'GET',
  data?: any,
  options: ApiOptions = {}
) {
  // 合并默认选项
  const mergedOptions = { ...DEFAULT_API_OPTIONS, ...options };
  let showErrorMessaged = false
  try {    
    // 构建请求头
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // 获取并添加认证token
    const token = getAuthToken();
    if ((endpoint.includes('dashboard-stats')) && token == null) {
      return
    }
    if (token) {
      // 验证token格式 - 优化token验证逻辑，避免过度严格的验证
      if (typeof token === 'string' && token.length > 0) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {        
        if (!endpoint.includes('/api/auth/login') && !mergedOptions.ignoreAuthError) {
          redirectToLogin('登录状态无效，请重新登录');
          throw new Error('无效的token格式');
        }
      }
    } else {
    }
    headers['Authorization'] = `Bearer ${token}`;
    // 构建请求配置
    const config: RequestInit = {
      method,
      headers,
      credentials: 'include', // 包含cookies
    };
    
    // 添加请求体 (仅对非GET请求)
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.body = JSON.stringify(data);
    }
    
    // 构建完整URL
    // 使用Vite代理时，可以直接使用相对路径，无需添加域名
    // 只有在有AIPA_API_DOMAIN环境变量且非空时才添加
    const baseUrl = process.env.AIPA_API_DOMAIN ? `${process.env.AIPA_API_DOMAIN}` : '';
    const url = `${baseUrl}${endpoint}`;
    
    // 执行请求
    console.log(`[API] 发送请求: ${method} ${url}`, data ? `数据: ${JSON.stringify(data)}` : '');
    const response = await fetch(url, config);
    
    // 处理未授权错误 (401)
    if (response.status === 401 && !mergedOptions.ignoreAuthError) {
      console.warn('[API] 收到未授权响应 (401)');
      
      // 添加详细日志帮助调试
      console.log('[API] 401错误详情:', { 
        endpoint, 
        hasToken: !!token, 
        tokenLength: token ? token.length : 0,
        headers: response.headers
      });
      
      try {
        // 尝试读取响应内容以更好地理解错误原因
        const errorText = await response.text();
        console.error('[API] 401错误响应内容:', errorText);
        
        // 尝试解析为JSON
        try {
          const errorJson = JSON.parse(errorText);
          console.error('[API] 401错误响应JSON:', errorJson);
        } catch(e) {
          // 不是JSON，忽略
        }
      } catch(e) {
        console.error('[API] 无法读取401错误响应内容');
      }
      
      localStorage.removeItem('token');
      
      // 避免在登录相关API中重定向
      if (!endpoint.includes('/api/auth/login') && !endpoint.includes('/api/auth/validate')) {
        redirectToLogin('登录已过期，请重新登录');
        throw new Error('登录过期，请重新登录');
      }
    }
    // 保存原始响应文本，以便在错误时显示
    let responseText;
    try {
      responseText = await response.clone().text();
    } catch(e) {
      console.warn('[API] 无法读取原始响应文本:', e);
    }
    
    // 解析响应体
    let responseBody;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        responseBody = await response.json();
      } catch(e) {
        // JSON解析失败，使用文本作为备用
        console.error('[API] JSON解析失败:', e);
        responseBody = { text: responseText, success: response.ok };
      }
    } else {
      // 非JSON响应
      console.log(`[API] 非JSON响应 (${contentType}): ${responseText?.substring(0, 100)}${responseText?.length > 100 ? '...' : ''}`);
      
      try {
        // 尝试将文本解析为JSON
        responseBody = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        // 如果不是JSON，使用文本作为响应
        responseBody = { text: responseText, success: response.ok };
      }
    }
    
    // 处理错误响应
    if (!response.ok) {
      const errorMessage = responseBody.error || responseBody.message || '请求失败';
      console.error(`[API] 请求失败 (${response.status}): ${errorMessage}`);
      console.error('[API] 失败响应完整内容:', {
        status: response.status,
        headers: Object.fromEntries([...response.headers.entries()]),
        body: responseBody
      });
      
      // 处理验证错误 (Zod错误) - 保留完整的错误信息
      if (responseBody.error && responseBody.error.issues) {
        if (mergedOptions.showErrorMessage) {
          // 提取并显示第一个验证错误
          const firstIssue = responseBody.error.issues[0];
          if (firstIssue) {
            const fieldName = firstIssue.path.length > 0 ? firstIssue.path[0] : '';
            const errorMsg = `${fieldName ? fieldName + ': ' : ''}${firstIssue.message}`;
            message.error(errorMsg);
            showErrorMessaged = true;
          } else {
            message.error(errorMessage);
            showErrorMessaged = true;
          }
        }
        
        throw { 
          status: response.status, 
          error: errorMessage,
          data: responseBody,
          responseText
        };
      }
      
      if (mergedOptions.showErrorMessage && showErrorMessaged ==false) {
        message.error(errorMessage);
        showErrorMessaged = true
      }
      
      throw { 
        status: response.status, 
        error: errorMessage,
        data: responseBody,
        responseText
      };
    }
    
    // 处理成功响应
    if (mergedOptions.showSuccessMessage && responseBody.message) {
      message.success(responseBody.message);
    }
    
    // 针对登录接口的特殊处理
    if (endpoint.includes('/api/auth/login')) {
      // 确保响应中的token是一个有效字符串
      if (responseBody.data && responseBody.data.token) {
        if (typeof responseBody.data.token !== 'string') {
          console.error('[API] 登录接口返回的token不是字符串:', responseBody.data.token);
          throw {
            status: 500,
            error: '登录失败: 服务器返回的token格式无效'
          };
        } else if (responseBody.data.token.length < 5) { // 降低token长度验证要求
          console.error('[API] 登录接口返回的token长度不足:', responseBody.data.token);
          throw {
            status: 500,
            error: '登录失败: 服务器返回的token长度不足'
          };
        }
      }
      
      // 对于登录API，返回原始响应，让AuthContext自行处理
      return responseBody;
    }
    
    // 规范化响应数据处理
    let result;
    
    // 处理标准API封装格式 { success: true, data: ... }
    if (responseBody.success === true && responseBody.data !== undefined) {
      result = responseBody.data;
    } 
    // 处理产品API的特殊返回格式 { products: ... }
    else if (responseBody.products !== undefined) {
      result = { products: responseBody.products };
    }
    // 处理库存记录API的特殊返回格式 { records: ... }
    else if (responseBody.records !== undefined) {
      result = { records: responseBody.records };
    }
    else {
      // 返回完整响应，由业务代码处理
      result = responseBody;
    }
    
    return result;
  } catch (error: any) {
    console.error('[API] 请求异常:', error);
    
    // 增强错误日志，确保打印完整的请求和响应信息
    console.error('[API] 请求失败详情:', {
      endpoint,
      fullUrl: `${process.env.AIPA_API_DOMAIN || ''}${endpoint}`,
      method,
      requestData: data,
      errorObject: {
        message: error.message,
        status: error.status,
        stack: error.stack,
        responseData: error.data,
        responseText: error.responseText
      }
    });
    
    // 显示错误消息
    if (mergedOptions.showErrorMessage && error.error && showErrorMessaged ==false) {
      message.error(error.error);
    }
    
    // 上报服务器错误 (5xx)
    if (error.status && error.status >= 500) {
      if (process.env.NODE_ENV === 'development' && typeof aipaDevRuntime !== 'undefined') {
        const requestInfo = {
          url: endpoint,
          method: method,
          body: data,
        };
        const errorMessage = error.error || 'Unknown server error';
        aipaDevRuntime.reportApiError(requestInfo, errorMessage);
      }
    }
    
    throw error;
  }
}

// 导出api对象，提供标准HTTP方法
export const api = {
  // GET请求
  get: async (endpoint: string, options?: ApiOptions) => {
    return fetchApi(endpoint, 'GET', undefined, options);
  },
  
  // POST请求
  post: async <T = any>(endpoint: string, data?: any, options?: ApiOptions): Promise<T> => {
    return fetchApi(endpoint, 'POST', data, options) as Promise<T>;
  },
  
  // PUT请求
  put: async (endpoint: string, data?: any, options?: ApiOptions) => {
    return fetchApi(endpoint, 'PUT', data, options);
  },
  
  // DELETE请求
  delete: async (endpoint: string, options?: ApiOptions) => {
    return fetchApi(endpoint, 'DELETE', undefined, options);
  },
  
  // PATCH请求
  patch: async (endpoint: string, data?: any, options?: ApiOptions) => {
    return fetchApi(endpoint, 'PATCH', data, options);
  }
};


function getAuthToken() {
  // 1. 尝试从 localStorage 获取
  const localStorageToken = localStorage.getItem('token');
  if (localStorageToken) {
    console.log('从 localStorage 获取到 token');
    return localStorageToken;
  }

  // 2. 尝试从 cookie 获取
  const cookieToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('token='))
    ?.split('=')[1];
  
  if (cookieToken) {
    console.log('从 cookie 获取到 token');
    // 存入 localStorage 以备后续使用
    localStorage.setItem('token', cookieToken);
    return cookieToken;
  }

  console.warn('未找到任何形式的 token');
  return null;
}

// 检查重复客户名称
export const checkDuplicateCustomers = async (customerNames: string[]) => {
  return api.post('/api/customers/check-duplicates', { customerNames });
};

// 公司名称补充接口
export const getCompanyNameSuggestions = async (prefix: string) => {
  return api.get(`/api/customers/complete-company-names?prefix=${encodeURIComponent(prefix)}`);
}

// 项目相关API函数
export const projectApi = {
  // 获取客户的项目列表
  getCustomerProjects: async (customerId: string) => {
    return api.get(`/api/projects/customer/${customerId}`);
  },
  
  // 获取项目详情
  getProject: async (projectId: string) => {
    return api.get(`/api/projects/${projectId}`);
  },
  
  // 创建项目
  createProject: async (projectData: any) => {
    return api.post('/api/projects', projectData, { showSuccessMessage: true });
  },
  
  // 更新项目
  updateProject: async (projectId: string, projectData: any) => {
    return api.put(`/api/projects/${projectId}`, projectData, { showSuccessMessage: true });
  },
  
  // 删除项目
  deleteProject: async (projectId: string) => {
    return api.delete(`/api/projects/${projectId}`, { showSuccessMessage: true });
  }
};
