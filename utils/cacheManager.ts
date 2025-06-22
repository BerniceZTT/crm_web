/**
 * 独立的缓存管理器
 * 避免与 AuthContext 和 dataFetcher 产生循环依赖
 */

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
export const isCacheValid = (key: string) => {
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
  return true;
};

// 增强的缓存清理函数 - 支持用户切换场景
export const clearAllProjectCaches = () => {
  console.log('[Cache] 开始清除所有项目相关缓存');
  
  // 1. 清除内存缓存中的项目相关数据
  Object.keys(cache).forEach(key => {
    if (key.includes('/api/projects') || 
        key.includes('/api/customers') || 
        key.includes('project') || 
        key.includes('customer')) {
      delete cache[key];
      console.log(`[Cache] 已清除内存缓存: ${key}`);
    }
  });
  
  // 2. 清除localStorage中的相关缓存
  try {
    const keysToRemove = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes('projects') || 
        key.includes('customers') || 
        key.includes('swr:') ||
        key.includes('api-cache')
      )) {
        keysToRemove.push(key);
      }
    }
    
    console.log(`[Cache] 正在清除${keysToRemove.length}个本地存储缓存项`);
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (e) {
    console.error('[Cache] 清除localStorage缓存出错:', e);
  }
  
  // 3. 标记页面已激活，强制下次请求刷新
  pageActivated = true;
  
  console.log('[Cache] 项目相关缓存清理完成');
  return true;
};

// 用户切换专用的缓存清理函数
export const clearUserSwitchCaches = () => {
  console.log('[Cache] 用户切换，开始彻底清除缓存');
  
  // 清除所有内存缓存
  Object.keys(cache).forEach(key => {
    delete cache[key];
  });
  
  // 清除相关的localStorage缓存
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes('api') || 
        key.includes('cache') || 
        key.includes('swr:') ||
        key.startsWith('data_')
      )) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log(`[Cache] 用户切换清除了 ${keysToRemove.length} 个缓存项`);
  } catch (e) {
    console.error('[Cache] 用户切换清除缓存出错:', e);
  }
  
  // 强制标记页面激活
  pageActivated = true;
  
  console.log('[Cache] 用户切换缓存清理完成');
};

// 获取缓存状态和工具函数
export const getCacheState = () => ({
  cache,
  pageActivated
});

// 设置页面激活状态
export const setPageActivated = (activated: boolean) => {
  pageActivated = activated;
};

// 获取缓存数据
export const getCacheData = (key: string) => {
  return cache[key];
};

// 设置缓存数据
export const setCacheData = (key: string, data: any, error?: any) => {
  cache[key] = {
    data,
    timestamp: Date.now(),
    error
  };
};
