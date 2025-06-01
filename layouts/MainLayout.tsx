/**
 * 主布局组件
 * 提供应用程序的整体布局，包括侧边栏导航和顶部栏
 * 增强了移动端的响应式支持和优化了视觉效果
 */

import React, { useState, useEffect } from 'react';
import { Layout, Menu, Dropdown, Button, Avatar, Typography, Drawer, Badge } from 'antd';
import { 
  DashboardOutlined, 
  TeamOutlined, 
  ShoppingOutlined,
  UserOutlined,
  ShopOutlined,
  GlobalOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  BellOutlined
} from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../shared/types';
import { motion } from 'framer-motion';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

// 角色显示名称映射
const roleDisplayNames = {
  [UserRole.SUPER_ADMIN]: '超级管理员',
  [UserRole.FACTORY_SALES]: '原厂销售',
  [UserRole.AGENT]: '代理商',
  [UserRole.INVENTORY_MANAGER]: '库存管理员'
};

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // 监听窗口大小变化，使用防抖处理避免频繁触发
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && !collapsed) {
        setCollapsed(true);
      }
    };
    
    // 添加防抖处理，避免频繁触发
    let resizeTimer: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(handleResize, 100);
    };
    
    window.addEventListener('resize', debouncedResize);
    handleResize(); // 初始化检查
    
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(resizeTimer);
    };
  }, [collapsed]);
  
  // 检查首页重定向逻辑 - 库存管理员直接跳转到产品页面
  useEffect(() => {
    if (user?.role === UserRole.INVENTORY_MANAGER && location.pathname === '/') {
      navigate('/products');
    }
  }, [location.pathname, user?.role, navigate]);
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  // 菜单项配置
  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link to="/">数据看板</Link>,
      access: hasPermission('dashboard', 'read')
    },
    {
      key: '/customers',
      icon: <TeamOutlined />,
      label: <Link to="/customers">客户管理</Link>,
      access: hasPermission('customers', 'read')
    },
    {
      key: '/products',
      icon: <ShoppingOutlined />,
      label: <Link to="/products">产品管理</Link>,
      access: hasPermission('products', 'read') && user?.role !== UserRole.AGENT
    },
    {
      key: '/agents',
      icon: <ShopOutlined />,
      label: <Link to="/agents">代理商管理</Link>,
      access: hasPermission('agents', 'read')
    },
    {
      key: '/users',
      icon: <UserOutlined />,
      label: <Link to="/users">用户管理</Link>,
      access: user?.role === UserRole.SUPER_ADMIN
    },
    {
      key: '/public-pool',
      icon: <GlobalOutlined />,
      label: <Link to="/public-pool">客户公海</Link>,
      access: hasPermission('publicPool', 'read')
    }
  ].filter(item => item.access);
  
  // 根据当前路径找到选中的菜单项
  const selectedKey = (() => {
    if (location.pathname.startsWith('/projects')) {
      return '/customers';
    }
    
    const matchedItem = menuItems.find(item => 
      location.pathname === item.key || 
      (item.key !== '/' && location.pathname.startsWith(`${item.key}/`))
    );
    
    return matchedItem?.key || '/';
  })();
  
  // 渲染菜单内容
  const renderMenu = () => (
    <Menu
      mode="inline"
      selectedKeys={[selectedKey]}
      items={menuItems}
      style={{ 
        borderRight: 0,
        backgroundColor: 'transparent' 
      }}
      className="menu-with-hover-effect"
      onClick={() => isMobile && setDrawerVisible(false)}
    />
  );
  
  // 获取标题内容
  const getTitleContent = () => {
    return '乾芯CRM系统';
  };
  
  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 在非移动设备上使用侧边栏 */}
      {!isMobile && (
        <Sider 
          trigger={null} 
          collapsible 
          collapsed={collapsed}
          theme="light"
          width={250}
          style={{
            boxShadow: '0 0 15px rgba(0,0,0,0.05)',
            overflowY: 'auto',
            height: '100vh',
            position: 'fixed',
            left: 0,
            zIndex: 100,
            background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
            borderRight: '1px solid #f1f5f9'
          }}
        >
          <div className="p-5 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Title level={4} className="m-0">
                <span className="text-gradient">
                  {collapsed ? 'CRM' : getTitleContent()}
                </span>
              </Title>
            </motion.div>
          </div>
          
          {renderMenu()}
        </Sider>
      )}
      
      {/* 在移动设备上使用抽屉组件 */}
      {isMobile && (
        <Drawer
          placement="left"
          closable={false}
          onClose={() => setDrawerVisible(false)}
          open={drawerVisible}
          width={250}
          bodyStyle={{ 
            padding: 0,
            background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
          }}
          maskClosable={true}
          style={{ zIndex: 1001 }}
        >
          <div className="p-5 flex items-center justify-center">
            <Title level={4} className="m-0">
              <span className="text-gradient">
                {getTitleContent()}
              </span>
            </Title>
          </div>
          
          {renderMenu()}
        </Drawer>
      )}
      
      <Layout style={{ 
        marginLeft: isMobile ? 0 : (collapsed ? 80 : 250), 
        transition: 'all 0.3s',
        background: '#f8fafc',
      }}>
        <Header style={{ 
          background: 'rgba(255, 255, 255, 0.95)', 
          backdropFilter: 'blur(10px)',
          padding: '0 20px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          position: 'sticky',
          top: 0,
          zIndex: 99,
          width: '100%',
          height: isMobile ? '56px' : '64px',
          borderBottom: '1px solid #f1f5f9'
        }}>
          <Button
            type="text"
            icon={isMobile ? (drawerVisible ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />) : 
                            (collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />)}
            onClick={() => isMobile ? setDrawerVisible(!drawerVisible) : setCollapsed(!collapsed)}
            style={{ 
              fontSize: isMobile ? '16px' : '14px',
              color: '#4f46e5'
            }}
            className="hover:bg-indigo-50 transition-colors"
          />
          
          <div className="flex items-center space-x-3">            
            <Dropdown menu={{
              items: [
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: '退出登录',
                  onClick: handleLogout
                }
              ]
            }}>
              <div className="flex items-center cursor-pointer py-2 px-3 rounded-lg hover:bg-indigo-50 transition-colors">
                <Avatar 
                  icon={<UserOutlined />} 
                  className="mr-2" 
                  style={{ 
                    backgroundColor: '#4f46e5',
                    boxShadow: '0 2px 5px rgba(79, 70, 229, 0.2)'
                  }}
                  size={isMobile ? 'small' : 'default'}
                />
                {/* 改进用户信息显示 */}
                <div className={`flex flex-col`}>
                  <span className="font-medium text-gray-800 leading-tight">
                    {user?.username || user?.companyName || 'User'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {roleDisplayNames[user?.role as UserRole] || '用户'}
                  </span>
                </div>
              </div>
            </Dropdown>
          </div>
        </Header>
        
        <Content style={{ 
          margin: isMobile ? '12px 8px' : '24px 16px',
          padding: 0,
          minHeight: 280,
          transition: 'all 0.3s',
        }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            style={{
              background: '#fff',
              borderRadius: '12px',
              padding: isMobile ? '12px 8px' : '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              minHeight: '280px',
              height: '100%',
              overflowX: 'auto'
            }}
          >
            <Outlet />
          </motion.div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;