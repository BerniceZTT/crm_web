import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Login from './pages/Login';
import Register from './pages/Register';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import CustomerManagement from './pages/CustomerManagement';
import CustomerDetail from './pages/CustomerDetail';
import ProductManagement from './pages/ProductManagement';
import UserManagement from './pages/UserManagement';
import AgentManagement from './pages/AgentManagement';
import PublicPoolManagement from './pages/PublicPoolManagement';
import NotFound from './pages/NotFound';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { UserRole } from './shared/types';
import RoleBasedRoute from './components/RoleBasedRoute';
import './styles/global.css'; // 全局样式文件

// 私有路由守卫
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-primary-600 text-lg animate-pulse">加载中...</div>
      </div>
    );
  }
  
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// 公共路由守卫 (已登录用户不能访问登录/注册页)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-primary-600 text-lg animate-pulse">加载中...</div>
      </div>
    );
  }
  
  return !isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
};

const AppRoutes = () => {
  const { user } = useAuth();
  
  // 根据不同角色重定向到适当的首页
  const getDefaultRoute = () => {
    if (!user) return <Navigate to="/login" replace />;
    
    // 原厂销售和代理商默认进入客户管理页面
    if (user.role === UserRole.FACTORY_SALES || user.role === UserRole.AGENT) {
      return <Navigate to="/customers" replace />;
    }
    
    // 库存管理员默认进入产品页面
    if (user.role === UserRole.INVENTORY_MANAGER) {
      return <Navigate to="/products" replace />;
    }
    // 超级管理员或其他角色进入看板
    return <Dashboard />;
  };
  
  return (
    <Routes>
      <Route 
        path="/login" 
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } 
      />
      <Route 
        path="/register" 
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        } 
      />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <MainLayout />
          </PrivateRoute>
        }
      >
        <Route index element={getDefaultRoute()} />
        <Route path="customers" element={<CustomerManagement />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="products" element={<ProductManagement />} />
        
        {/* 用户管理页面添加角色保护，仅超级管理员可访问 */}
        <Route 
          path="users" 
          element={
            <RoleBasedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
              <UserManagement />
            </RoleBasedRoute>
          } 
        />
        
        <Route path="agents" element={<AgentManagement />} />
        <Route path="public-pool" element={<PublicPoolManagement />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
};

const App = () => {
  // 自定义主题配置
  const themeConfig = {
    token: {
      // 主色调更新为更加精致的蓝紫色调
      colorPrimary: '#4f46e5', // 主题色改为靛青色
      colorSuccess: '#10b981', // 成功色
      colorWarning: '#f59e0b', // 警告色
      colorError: '#ef4444',   // 错误色
      colorInfo: '#3b82f6',    // 信息色
      
      // 圆角设置
      borderRadius: 8,
      
      // 字体设置
      fontFamily: "'Nunito', 'Helvetica Neue', Arial, sans-serif",
      fontSize: 14,
      
      // 阴影设置 - 增加精致度
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
      boxShadowSecondary: '0 2px 8px rgba(0, 0, 0, 0.05)',
      
      // 减小边框宽度增加精致感
      lineWidth: 1,
      
      // 控件尺寸微调
      controlHeight: 38, // 增大默认控件高度
      
      // 色彩饱和度调整
      colorBgContainer: '#ffffff',
      colorBgElevated: '#ffffff',
      colorBgLayout: '#f5f7fb', // 淡蓝灰背景，更有质感
    },
    algorithm: theme.defaultAlgorithm, // 使用默认算法派生其他颜色
    components: {
      Card: {
        colorBgContainer: '#ffffff',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
        borderRadiusLG: 12,
      },
      Table: {
        borderRadius: 8,
        colorBgContainer: '#ffffff',
        fontSize: 14,
      },
      Button: {
        // 按钮样式优化
        borderRadius: 6,
        controlHeight: 40, // 增大按钮高度
        controlHeightSM: 32, // 小尺寸按钮高度
        controlHeightLG: 48, // 大尺寸按钮高度
        colorPrimaryHover: '#4338ca', // 深一点的悬停颜色
        colorPrimaryActive: '#3730a3', // 更深的激活颜色
        fontSizeLG: 16, // 大按钮字体大小
        marginXS: 8, // 按钮内边距
        paddingContentHorizontal: 16, // 按钮水平内边距
        fontSize: 15, // 默认字体大小增大
      },
      Input: {
        borderRadius: 6,
        controlHeight: 40, // 与按钮一致
      },
      Select: {
        borderRadius: 6,
        controlHeight: 40, // 与按钮一致
      },
      Modal: {
        borderRadiusLG: 12,
      },
    },
  };

  return (
    <ConfigProvider
      locale={zhCN}
      theme={themeConfig}
    >
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
        <ToastContainer 
          position="top-right" 
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnHover
          draggable
          theme="light"
          toastClassName="toast-with-shadow"
        />
      </AuthProvider>
    </ConfigProvider>
  );
};

export default App;