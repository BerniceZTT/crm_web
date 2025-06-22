/**
 * 项目管理页面 - 修复无限渲染问题
 * 支持查看特定客户的项目或所有项目，增强独立项目管理功能
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Card, 
  Button, 
  Modal, 
  message,
  Form,
  Typography,
  Breadcrumb,
  Space,
  Spin
} from 'antd';
import { 
  ArrowLeftOutlined, 
  ProjectOutlined} from '@ant-design/icons';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Project, 
  Product, 
  Customer,
  UserRole
} from '../shared/types';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../utils/dataFetcher';
import { api } from '../utils/api';
import { useResponsive } from '../hooks/useResponsive';
import ProjectList from '../components/projects/ProjectList';
import ProjectForm from '../components/projects/ProjectForm';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const ProjectManagement: React.FC = () => {
  const { customerId } = useParams<{ customerId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  
  const [projectForm] = Form.useForm();
  const [projectModalVisible, setProjectModalVisible] = useState(false);
  const [projectLoading, setProjectLoading] = useState(false);
  const [currentProject, setCurrentProject] = useState<Partial<Project> | null>(null);
  const [projectMode, setProjectMode] = useState<'create' | 'edit'>('create');
  const [modalKey, setModalKey] = useState<string>('');
  
  // 🔧 关键修复：使用ref存储上次用户信息，避免频繁比较
  const lastUserRef = useRef<{ id?: string; role?: string } | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 🔧 从路由状态获取额外信息
  const routeState = location.state as { customerName?: string; fromCustomerDetail?: boolean } | null;

  // 性能优化：使用 useMemo 缓存计算结果
  const apiUrls = useMemo(() => ({
    customer: customerId ? `/api/customers/${customerId}` : null,
    products: '/api/products',
    projects: customerId 
      ? `/api/projects/customer/${customerId}` 
      : '/api/projects'
  }), [customerId]);

  // 🔧 稳定的用户ID获取
  const userId = useMemo(() => {
    return user?._id || user?.id || (user as any)?.userId;
  }, [user?._id, user?.id, (user as any)?.userId]);

  // 🔧 优化的数据获取 - 确保userId引用稳定
  const { 
    data: customerData, 
    isLoading: customerLoading,
    error: customerError
  } = useData<{ customer: Customer }>(apiUrls.customer, {
    userId
  });
  
  const { 
    data: productsData,
    isLoading: productsLoading 
  } = useData<{ products: Product[] }>(apiUrls.products, {
    userId 
  });
  
  const {
    data: projectsData,
    isLoading: projectsLoading,
    error: projectsError,
    mutate: mutateProjects
  } = useData<{ projects: Project[] }>(apiUrls.projects, {
    userId,
    forceRefresh: true 
  });

  // 🔧 关键修复：正确解构API响应数据
  const customer = customerData?.customer;
  const products = productsData?.products || [];
  const projects = projectsData?.projects || [];

  // 🔧 检查用户是否可以新建项目
  const canCreateProject = useMemo(() => {
    if (!user) return false;
    return user.role === UserRole.SUPER_ADMIN || 
           user.role === UserRole.FACTORY_SALES || 
           user.role === UserRole.AGENT;
  }, [user?.role]);

  // 🆕 判断是否显示新建项目按钮：只有从客户详情页进入时才显示
  const shouldShowCreateButton = useMemo(() => {
    return !!customerId && canCreateProject;
  }, [customerId, canCreateProject]);

  // 🔧 优化用户变化监听 - 防止无限循环
  useEffect(() => {
    if (!user) {
      lastUserRef.current = null;
      return;
    }

    const currentUserInfo = {
      id: user._id || user.id || (user as any)?.userId,
      role: user.role
    };

    const lastUserInfo = lastUserRef.current;

    // 只在用户ID或角色真正发生变化时才处理
    if (!lastUserInfo || 
        lastUserInfo.id !== currentUserInfo.id || 
        lastUserInfo.role !== currentUserInfo.role) {
      
      console.log(`[ProjectManagement] 用户信息更新:`, {
        previous: lastUserInfo,
        current: currentUserInfo,
        username: user.username || user.companyName
      });
      
      // 清除之前的定时器
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      
      // 🔧 使用防抖机制，避免频繁刷新
      refreshTimeoutRef.current = setTimeout(() => {
        console.log('[ProjectManagement] 执行延迟数据刷新');
        if (mutateProjects) {
          mutateProjects(true);
        }
      }, 300); // 300ms防抖
      
      lastUserRef.current = currentUserInfo;
    }
  }, [user?._id, user?.id, (user as any)?.userId, user?.role, user?.username, user?.companyName]);

  // 🔧 清理函数
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  // 性能优化：使用 useMemo 缓存复杂计算 - 更新页面标题逻辑
  const pageTitle = useMemo(() => {
    if (customerId) {
      const customerName = customer?.name || routeState?.customerName;
      if (customerName) {
        return `${customerName} - 项目管理`;
      }
      return '客户项目管理';
    }
    return '项目管理';
  }, [customerId, customer?.name, routeState?.customerName]);

  const breadcrumbItems = useMemo(() => {
    const items = [];
    
    if (customerId) {
      const customerName = customer?.name || routeState?.customerName;
      
      items.push({
        title: <a onClick={() => navigate('/customers')}>客户管理</a>
      });
      
      if (customerName) {
        items.push({
          title: <a onClick={() => navigate(`/customers/${customerId}`)}>{customerName}</a>
        });
      }
      
      items.push({
        title: '项目管理'
      });
    } else {
      items.push({
        title: '项目管理'
      });
    }
    
    return items;
  }, [customerId, customer?.name, routeState?.customerName, navigate]);

  const shouldShowRelatedColumns = useMemo(() => {
    return !customerId;
  }, [customerId]);

  // 性能优化：使用 useCallback 避免函数重复创建
  const handleGoBack = useCallback(() => {
    if (customerId) {
      navigate(`/customers/${customerId}`);
    } else {
      navigate('/customers');
    }
  }, [customerId, navigate]);

  const handleAddProject = useCallback(() => {    
    setCurrentProject(null);
    setProjectMode('create');
    setModalKey(`create_${Date.now()}`);
    
    projectForm.resetFields();
    
    if (customerId) {
      projectForm.setFieldsValue({ customerId });
    }
    
    setProjectModalVisible(true);
    
    console.log('新建项目弹窗已打开，状态已重置');
  }, [customerId, projectForm]);

  const handleEditProject = useCallback((project: Project) => {
    console.log('开始编辑项目:', project.projectName);
    project.startDate = dayjs(project.startDate)
    setCurrentProject(project);
    setProjectMode('edit');
    setModalKey(`edit_${project._id}_${Date.now()}`);
    
    projectForm.setFieldsValue(project);
    
    setProjectModalVisible(true);
    
    console.log('编辑项目弹窗已打开');
  }, [projectForm]);

  // 🔧 优化项目提交处理，使用稳定的mutateProjects引用
  const handleProjectSubmit = useCallback(async () => {
    try {
      const values = await projectForm.validateFields();
      setProjectLoading(true);
      
      console.time('项目提交耗时');
      
      if (projectMode === 'create') {
        const projectData = customerId ? { ...values, customerId } : values;
        await api.post('/api/projects', projectData, { 
          showSuccessMessage: true 
        });
      } else {
        await api.put(`/api/projects/${currentProject?._id}`, values, {
          showSuccessMessage: true
        });
      }
      
      console.timeEnd('项目提交耗时');
      
      // 🔧 延迟调用mutateProjects，避免与其他状态更新冲突
      setTimeout(() => {
        if (mutateProjects) {
          mutateProjects();
        }
      }, 100);
      
      setProjectModalVisible(false);
      projectForm.resetFields();
      setCurrentProject(null);
    } catch (error) {
      console.error('Project operation failed:', error);
      message.error(`${projectMode === 'create' ? '创建' : '更新'}项目失败`);
    } finally {
      setProjectLoading(false);
    }
  }, [projectForm, projectMode, customerId, currentProject, mutateProjects]);

  const handleProjectCancel = useCallback(() => {
    console.log('取消项目操作，重置状态...');
    
    setProjectModalVisible(false);
    projectForm.resetFields();
    setCurrentProject(null);
    setModalKey('');
    
    console.log('项目弹窗已关闭，状态已重置');
  }, [projectForm]);

  // 🔧 优化性能监控 - 减少不必要的日志
  useEffect(() => {
    if (!customerLoading && !productsLoading && !projectsLoading) {
      const shouldLog = Math.random() < 0.1; // 只有10%的概率打印日志，减少控制台噪音
      
      if (shouldLog) {
        console.log('项目管理页面数据加载完成');
        console.log(`客户数据: ${customer ? '已加载' : '无需加载'}`);
        console.log(`产品数量: ${products.length}`);
        console.log(`项目数量: ${projects.length}`);
        console.log(`显示关联信息列: ${shouldShowRelatedColumns ? '是' : '否'}`);
        console.log(`来源: ${routeState?.fromCustomerDetail ? '客户详情页' : '直接访问'}`);
        console.log(`显示新建按钮: ${shouldShowCreateButton ? '是' : '否'}`);
      }
      
      // 独立项目管理页面的统计信息
      if (!customerId && shouldLog) {
        console.log('独立项目管理页面，项目总数:', projects.length);
        const relatedSalesCount = projects.filter(p => p.relatedSalesName && p.relatedSalesName !== '-').length;
        const relatedAgentCount = projects.filter(p => p.relatedAgentName && p.relatedAgentName !== '-').length;
        console.log(`有关联销售的项目: ${relatedSalesCount}，有关联代理商的项目: ${relatedAgentCount}`);
      }
    }
  }, [customerLoading, productsLoading, projectsLoading, customer, products.length, projects.length, customerId, shouldShowRelatedColumns, routeState, shouldShowCreateButton]);

  // 如果是特定客户页面且客户信息加载中
  if (customerId && customerLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" tip="正在加载客户信息..." />
      </div>
    );
  }

  // 如果是特定客户页面但客户不存在
  if (customerId && customerError) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <div className="text-red-500 mb-4 text-center">
          <div className="text-lg font-medium mb-2">加载失败</div>
          <div className="text-sm">客户信息不存在或加载失败</div>
        </div>
        <Button onClick={handleGoBack} type="primary">
          返回
        </Button>
      </div>
    );
  }

  // 如果项目数据加载失败
  if (projectsError) {
    console.error('项目数据加载失败:', projectsError);
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <div className="text-red-500 mb-4 text-center">
          <div className="text-lg font-medium mb-2">项目数据加载失败</div>
          <div className="text-sm">{projectsError.message || '请检查网络连接或联系管理员'}</div>
        </div>
        <Button onClick={() => mutateProjects && mutateProjects()} type="primary">
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className="project-management">
      {/* 页面头部 */}
      <div className={`${isMobile ? 'mb-3' : 'mb-6'}`}>
        {/* 面包屑导航 */}
        <div className="mb-4">
          <Breadcrumb items={breadcrumbItems} />
        </div>

        {/* 标题和操作区 */}
        <div className={`${isMobile ? 'flex flex-col' : 'flex justify-between items-center'}`}>
          <div className={`flex ${isMobile ? 'flex-col items-start' : 'items-center'}`}>
            {customerId && (
              <Button 
                icon={<ArrowLeftOutlined />} 
                onClick={handleGoBack}
                className={`${isMobile ? 'mb-2' : 'mr-4'}`}
                size={isMobile ? "middle" : "middle"}
              >
                返回
              </Button>
            )}
            <div className={`flex items-center ${isMobile ? 'mb-2' : ''}`}>
              <ProjectOutlined className={`${isMobile ? 'mr-1' : 'mr-2'} text-primary`} />
              <Title level={isMobile ? 5 : 4} className="m-0">
                {pageTitle}
              </Title>
              {!customerId && (
                <Text type="secondary" className="ml-3">
                  全局项目管理，共 {projects.length} 个项目
                </Text>
              )}
            </div>
          </div>
          
          {/* 🆕 恢复：主页面的新建项目按钮 - 只在客户项目页面显示 */}
           {/* {shouldShowCreateButton && (
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={handleAddProject}
              size={isMobile ? "middle" : "middle"}
              className={`${isMobile ? 'mt-2 self-end' : ''}`}
            >
              {isMobile ? '新建项目' : '为该客户新建项目'}
            </Button>
          )} */}
        </div>
      </div>
      
      {/* 项目列表 */}
      <Card 
        className="project-list-card"
        bodyStyle={{ padding: isMobile ? '12px' : '24px' }}
        title={
          !customerId && (
            <Space>
              <ProjectOutlined />
              <Text strong>全部项目列表</Text>
              <Text type="secondary">（包含关联客户、销售、代理商信息）</Text>
            </Space>
          )
        }
      >
        <ProjectList
          customerId={customerId || ''}
          projects={projects}
          loading={projectsLoading}
          onRefresh={() => mutateProjects && mutateProjects()}
          onEdit={handleEditProject}
          onAdd={handleAddProject}
          showRelatedColumns={shouldShowRelatedColumns}
          showCreateButton={shouldShowCreateButton} // 🆕 传递新建按钮显示状态
        />
      </Card>

      {/* 项目创建/编辑Modal */}
      <Modal
        key={modalKey}
        title={`${projectMode === 'create' ? '新建' : '编辑'}项目`}
        open={projectModalVisible}
        onOk={handleProjectSubmit}
        onCancel={handleProjectCancel}
        confirmLoading={projectLoading}
        width={isMobile ? '95%' : 800}
        destroyOnClose={true}
        okText={projectMode === 'create' ? '创建' : '保存'}
        cancelText="取消"
        maskClosable={false}
      >
        <ProjectForm
          key={modalKey}
          form={projectForm}
          currentProject={currentProject}
          products={products}
          customerId={customerId || ''}
          mode={projectMode}
        />
      </Modal>

      {/* 移动端样式优化 */}
      <style jsx global>{`
        @media (max-width: 768px) {
          .project-management .ant-card {
            margin-bottom: 8px;
          }
          
          .project-management .ant-breadcrumb {
            font-size: 12px;
          }
          
          .project-list-card .ant-card-body {
            padding: 8px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ProjectManagement;