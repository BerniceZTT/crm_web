/**
 * 优化后的数据获取工具 - 支持批量请求
 * 减少网络请求次数，提高页面加载速度
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';
import { isCacheValid, getCacheData, setCacheData } from './cacheManager';
import { clearCache } from './dataFetcher';

// 🚀 新增：批量数据获取钩子
export function useBatchData<T>(
  batchUrl: string | null,
  options?: {
    refreshInterval?: number;
    userId?: string;
  }
) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  const lastUserIdRef = useRef<string | undefined>(options?.userId);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 🚀 批量数据获取函数
  const fetchBatchData = useCallback(async (skipCache = false) => {
    setIsLoading(true);
    
    if (!batchUrl) {
      setData(undefined);
      setIsLoading(false);
      return;
    }
    
    try {
      // 检查缓存
      if (!skipCache && isCacheValid(batchUrl)) {
        console.log(`[批量缓存] 使用缓存数据: ${batchUrl}`);
        const cachedData = getCacheData(batchUrl);
        setData(cachedData.data);
        setIsLoading(false);
        return;
      }
      
      console.log(`[批量请求] 获取数据: ${batchUrl}`);
      const startTime = Date.now();
      
      const response = await api.get(batchUrl);
      
      const duration = Date.now() - startTime;
      console.log(`[批量请求] 完成，耗时: ${duration}ms`);
      
      setData(response);
      setError(null);
      
      // 缓存数据
      setCacheData(batchUrl, response);
      
    } catch (err) {
      console.error(`[批量请求] 失败: ${batchUrl}`, err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [batchUrl]);
  
  // 🚀 用户切换检测
  useEffect(() => {
    const currentUserId = options?.userId;
    const lastUserId = lastUserIdRef.current;
    
    if (currentUserId && lastUserId && currentUserId !== lastUserId) {
      console.log(`[批量请求] 检测到用户切换，清除缓存`);
      
      // 清除相关缓存
      if (batchUrl) {
        clearCache(batchUrl);
      }
      
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      
      refreshTimeoutRef.current = setTimeout(() => {
        fetchBatchData(true);
      }, 100);
      
      lastUserIdRef.current = currentUserId;
    } else if (currentUserId && !lastUserId) {
      lastUserIdRef.current = currentUserId;
    }
  }, [options?.userId, fetchBatchData, batchUrl]);
  
  // 🚀 初始数据加载
  useEffect(() => {
    if (batchUrl) {
      fetchBatchData();
    }
  }, [batchUrl, fetchBatchData]);
  
  // 🚀 定时刷新
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    if (options?.refreshInterval && options.refreshInterval > 0) {
      intervalId = setInterval(() => {
        fetchBatchData();
      }, options.refreshInterval);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [options?.refreshInterval, fetchBatchData]);
  
  // 清理函数
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);
  
  const mutate = useCallback((skipCache = true) => {
    return fetchBatchData(skipCache);
  }, [fetchBatchData]);
  
  return {
    data,
    error,
    isLoading,
    mutate
  };
}

export {
  clearCache,
  clearCacheByPrefix
} from './cacheManager';

// 保持原有的useData功能不变，供其他地方继续使用
export { useData } from './dataFetcher';
