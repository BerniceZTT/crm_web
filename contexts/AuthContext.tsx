import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../shared/types';
import { api } from '../utils/api';
import { hasPermission } from '../shared/auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string, isAgent?: boolean) => Promise<User>;
  loginAsAgent: (companyName: string, password: string) => Promise<User>;
  register: (userData: Partial<User>) => Promise<void>;
  registerAsAgent: (agentData: any) => Promise<void>;
  logout: () => void;
  hasPermission: (resource: string, action: string) => boolean;
}

// 创建认证上下文
const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => { throw new Error('Not implemented') },
  loginAsAgent: async () => { throw new Error('Not implemented') },
  register: async () => {},
  registerAsAgent: async () => {},
  logout: () => {},
  hasPermission: () => false
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);
  
  // 存储认证错误信息
  const [authError, setAuthError] = useState<string | null>(null);
  
  // 标记是否正在进行token验证，避免重复验证
  const [isValidating, setIsValidating] = useState(false);
  
  // 检查token的有效性
  const validateStoredToken = () => {
    const token = localStorage.getItem('token');
    if (!token) return false;
    
    // 基本验证：token至少应该是一个长字符串
    if (typeof token !== 'string' || token.length < 20) {
      console.warn('存储的token格式无效，自动清除');
      localStorage.removeItem('token');
      return false;
    }
    
    return true;
  };
  
  // 初始化时验证token，只运行一次
  useEffect(() => {
    const validateInitialToken = async () => {
      if (isValidating || authInitialized) return;
      
      setIsValidating(true);
      console.log('====== 初始化认证状态 ======');
      
      try {
        if (!validateStoredToken()) {
          console.log('未找到有效token，用户未登录');
          setUser(null);
          setAuthError(null);
          setIsLoading(false);
          setAuthInitialized(true);
          setIsValidating(false);
          return;
        }
        
        const token = localStorage.getItem('token');
        console.log(`找到存储的token，长度: ${token!.length}，验证中...`);
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('验证请求超时 (5秒)')), 5000)
        );
        
        const validatePromise = api.get('/api/auth/validate', { 
          showErrorMessage: false,
          ignoreAuthError: true
        });
        
        const response = await Promise.race([validatePromise, timeoutPromise]);
        
        if (response && response.user) {
          const validatedUser = response.user;
          
          console.log(`Token验证成功! 用户: ${validatedUser.username || validatedUser.companyName}, 角色: ${validatedUser.role}`);
          setUser(validatedUser);
          setAuthError(null);
        } else {
          console.warn('验证接口未返回有效用户信息:', response);
          throw new Error('验证接口未返回用户信息');
        }
      } catch (error) {
        console.error('Token验证失败:', error);
        
        localStorage.removeItem('token');
        setUser(null);
        
        const errorMessage = error.error || error.message || '会话失效，请重新登录';
        setAuthError(errorMessage);
      } finally {
        setIsLoading(false);
        setIsValidating(false);
        setAuthInitialized(true);
        console.log('====== 认证初始化完成 ======');
      }
    };

    validateInitialToken();
  }, []);
  
  const login = async (username: string, password: string, isAgent: boolean = false): Promise<User> => {
    setIsLoading(true);
    console.log(`尝试${isAgent ? '代理商' : '用户'}登录: ${username}`);
    
    try {
      setUser(null);
      setAuthError(null);
      localStorage.removeItem('token');
      
      const response = await api.post('/api/auth/login', 
        { username, password, isAgent },
        { 
          showErrorMessage: true,
          ignoreAuthError: true
        }
      );
      
      console.log('登录响应详情:', response);
      
      let tokenValue: string | null = null;
      let userData: User | null = null;
      
      if (response && response.success === true && response.data) {
        
        tokenValue = response.data.token;
        userData = response.data.user;
      }
      
      if (!tokenValue || typeof tokenValue !== 'string' || tokenValue.length < 20) {
        console.error('无法从响应中提取有效token:', response);
        throw new Error('登录失败: 无法提取有效的token，服务器返回格式错误');
      }
      
      if (!userData) {
        console.error('无法从响应中提取用户信息:', response);
        throw new Error('登录失败: 无法提取用户信息');
      }
      
      console.log(`登录成功! 用户: ${userData.username}, 角色: ${userData.role}`);
      console.log(`Token信息: ${tokenValue.substring(0, 10)}... (${tokenValue.length}字符)`);
      
      localStorage.setItem('token', tokenValue);
      setUser(userData);
      
      return userData;
    } catch (error) {
      console.error('登录失败:', error);
      setAuthError(error.error || error.message || '登录失败');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  const loginAsAgent = async (companyName: string, password: string): Promise<User> => {
    return login(companyName, password, true);
  };
  
  const register = async (userData: Partial<User>) => {
    try {
      // 修改注册API调用，禁用自动错误消息提示
      await api.post('/api/auth/register', userData, { 
        showSuccessMessage: true,
        showErrorMessage: false // 禁用自动错误消息，由组件自行处理
      });
    } catch (error) {
      console.error('注册失败:', error);
      throw error;
    }
  };
  
  const registerAsAgent = async (agentData: any) => {
    try {
      await api.post('/api/auth/agent/register', agentData, { showSuccessMessage: true });
    } catch (error) {
      console.error('代理商注册失败:', error);
      throw error;
    }
  };
  
  const logout = () => {
    console.log('用户登出，清除认证状态');
    
    localStorage.removeItem('token');
    
    setUser(null);
    setAuthError(null);
  };
  
  const checkPermission = (resource: string, action: string) => {
    if (!user || !user.role) return false;
    return hasPermission(user.role, resource, action);
  };
  
  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading: isLoading && !authInitialized,
        login,
        loginAsAgent,
        register,
        registerAsAgent,
        logout,
        hasPermission: checkPermission
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};