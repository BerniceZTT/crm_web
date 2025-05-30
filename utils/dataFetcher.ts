/**
 * 数据获取工具
 * 用原生 fetch 替代 SWR，提供相似的功能
 */

import { useState, useEffect } from 'react';
import { api } from './api';

// 存储缓存数据
const cache: Record<string, {
  data: any;
  timestamp: number;
  error?: any;
}> = {};

// 缓存有效期（毫秒）
const CACHE_TTL = 30000; // 30秒

// 页面激活标记 - 用于跟踪页面是否被激活/重新访问
let pageActivated = false;

// 监听页面可见性变化
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      pageActivated = true;
      console.log('[Cache] 页面被激活，标记刷新');
    }
  });
  
  // 监听路由变化
  window.addEventListener('popstate', () => {
    pageActivated = true;
    console.log('[Cache] 检测到路由变化，标记刷新');
  });
}

// 检查缓存是否有效
const isCacheValid = (key: string) => {
  if (!cache[key]) return false;
  return Date.now() - cache[key].timestamp < CACHE_TTL;
};

// 清除特定URL的缓存
export const clearCache = (url: string) => {
  if (cache[url]) {
    delete cache[url];
    console.log(`[Cache] 已清除 ${url} 的缓存`);
  }
};

// 清除包含特定前缀的所有URL缓存
export const clearCacheByPrefix = (prefix: string) => {
  const clearedKeys: string[] = [];
  
  Object.keys(cache).forEach(key => {
    if (key.startsWith(prefix)) {
      delete cache[key];
      clearedKeys.push(key);
    }
  });
  
  if (clearedKeys.length > 0) {
    console.log(`[Cache] 已清除 ${clearedKeys.length} 个与 "${prefix}" 相关的缓存:`);
    console.log(clearedKeys);
  }
};

// 彻底重写客户数据缓存清理函数
export const clearCustomerCaches = () => {
  console.log('[Cache] 开始彻底清除所有客户相关缓存');
  
  // 1. 清除内存缓存
  Object.keys(cache).forEach(key => {
    if (key.includes('/api/customers') || key.includes('customer')) {
      delete cache[key];
      console.log(`[Cache] 已清除内存缓存: ${key}`);
    }
  });
  
  // 2. 清除localStorage中的相关缓存
  try {
    // 临时收集要删除的键
    const keysToRemove = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes('customers') || 
        key.includes('customer') || 
        key.includes('swr:')
      )) {
        keysToRemove.push(key);
      }
    }
    
    // 批量删除找到的缓存项
    console.log(`[Cache] 正在清除${keysToRemove.length}个本地存储缓存项`);
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (e) {
    console.error('[Cache] 清除localStorage缓存出错:', e);
  }
  
  // 3. 标记页面已激活，强制下次请求刷新
  pageActivated = true;
  
  console.log('[Cache] 客户缓存清理完成');
  return true; // 返回成功标志
};

// 强化获取客户数据的函数
export const fetchWithoutCache = async (url: string) => {
  // 添加时间戳和随机数，确保不使用任何缓存
  const cacheBuster = `_t=${Date.now()}_r=${Math.random()}`;
  const urlWithParams = url.includes('?') 
    ? `${url}&${cacheBuster}` 
    : `${url}?${cacheBuster}`;
  
  console.log(`[API] 绕过缓存请求: ${urlWithParams}`);
  
  try {
    const response = await api.get(urlWithParams, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-No-Cache': 'true'
      }
    });
    return response;
  } catch (error) {
    console.error(`[API] 绕过缓存请求失败:`, error);
    throw error;
  }
};

// 为客户数据获取添加强制刷新选项
export const fetchCustomersWithForceRefresh = async (url: string) => {
  try {
    // 添加时间戳确保不使用缓存
    const timestamp = new Date().getTime();
    const urlWithTimestamp = `${url}${url.includes('?') ? '&' : '?'}_t=${timestamp}`;
    
    // 使用特殊头部强制跳过缓存
    const response = await fetch(urlWithTimestamp, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`请求失败: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('强制刷新客户数据失败:', error);
    throw error;
  }
};

// 通用数据获取钩子
export function useData<T>(url: string | null, options?: {
  refreshInterval?: number;
  initialData?: T;
  dedupingInterval?: number;
  forceRefresh?: boolean; // 强制刷新选项
}) {
  const [data, setData] = useState<T | undefined>(options?.initialData);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [shouldRetry, setShouldRetry] = useState<boolean>(true); // 添加标记控制是否应该重试
  
  // 刷新数据的函数
  const refresh = async (skipCache = false) => {
    // 如果有特定错误导致不应重试，则直接返回
    if (!shouldRetry) {
      console.log(`[Cache] 跳过请求 ${url}，由于认证或其他关键错误`);
      return;
    }

    setIsLoading(true);
    
    if (!url) {
      setData(undefined);
      setIsLoading(false);
      return;
    }
    
    try {
      // 更明确的强制刷新条件
      const shouldSkipCache = skipCache || options?.forceRefresh || pageActivated;
      
      // 强制刷新时额外打印日志
      if (skipCache) {
        console.log(`[Cache] 明确要求跳过缓存: ${url}`);
      }
      
      // 使用缓存数据的条件更严格
      if (!shouldSkipCache && isCacheValid(url)) {
        console.log(`[Cache] 使用有效缓存: ${url}`);
        const cachedData = cache[url];
        setData(cachedData.data);
        if (cachedData.error) setError(cachedData.error);
        setIsLoading(false);
        return;
      }
      
      // 获取新数据
      console.log(`[Cache] 获取新数据: ${url}, 强制刷新: ${shouldSkipCache}`);
      const response = await api.get(url);
      
      // 更新状态和缓存
      setData(response);
      setError(null);
      
      // 更新缓存
      cache[url] = {
        data: response,
        timestamp: Date.now()
      };
      
      // 重置重试标记 - 成功获取数据
      setShouldRetry(true);
      
      // 额外检查数据是否确实发生了变化
    } catch (err) {
      console.error(`获取数据失败: ${url}`, err);
      setError(err instanceof Error ? err : new Error(String(err)));
      
      // 检查是否是认证错误 (401) 或特定的未授权访问错误
      if (
        (err.status === 401) || 
        (err.error && (
          err.error.includes('未授权') || 
          err.error.includes('认证失败') || 
          err.error.includes('unauthorized')
        ))
      ) {
        console.warn(`[Cache] 检测到认证错误，停止重试请求: ${url}`);
        // 认证错误时，标记不应该重试
        setShouldRetry(false);
      }
      
      // 缓存错误
      if (!cache[url]) {
        cache[url] = {
          data: undefined,
          timestamp: Date.now(),
          error: err
        };
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // 初始加载和定时刷新
  useEffect(() => {
    // 重置状态 - URL变化时
    if (url) {
      setShouldRetry(true);
    }
    
    refresh();
    
    // 设置定时刷新
    let intervalId: NodeJS.Timeout | null = null;
    if (options?.refreshInterval && options.refreshInterval > 0 && shouldRetry) {
      intervalId = setInterval(() => refresh(), options.refreshInterval);
    }
    
    // 清理函数
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [url, options?.refreshInterval, options?.forceRefresh]);
  
  // 当shouldRetry变化时，需要处理interval
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    // 如果不应该重试，清除任何现有的interval
    if (!shouldRetry) {
      return;
    }
    
    // 否则，如果需要定时刷新，重新设置interval
    if (options?.refreshInterval && options.refreshInterval > 0) {
      intervalId = setInterval(() => refresh(), options.refreshInterval);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [shouldRetry]);
  
  return {
    data,
    error,
    isLoading,
    shouldRetry,
    resetRetry: () => setShouldRetry(true),
    mutate: (skipCache = true) => refresh(skipCache) // 提供与 SWR 类似的 mutate 函数用于手动刷新，默认跳过缓存
  };
}

// 手动调用 API 并更新缓存
export async function mutateData(url: string, callback?: () => Promise<void>) {
  try {
    // 清除缓存
    clearCache(url);
    
    // 如果提供了回调，先执行回调
    if (callback) {
      await callback();
    }
    
    // 获取新数据并更新缓存
    const newData = await api.get(url);
    cache[url] = {
      data: newData,
      timestamp: Date.now()
    };
    
    return newData;
  } catch (error) {
    console.error(`更新数据失败: ${url}`, error);
    throw error;
  }
}