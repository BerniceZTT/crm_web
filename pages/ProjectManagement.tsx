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
  ProjectOutlined
} from '@ant-design/icons';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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

  // 🆕 添加分页状态管理 - 🔧 修复：确保初始状态与服务端一致
  const [pagination, setPagination] = useState({
    page: 1,
    limit: isMobile ? 5 : 10
  });

  // 🔧 关键修复：使用ref存储上次用户信息，避免频繁比较
  const lastUserRef = useRef<{ id?: string; role?: string } | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 🔧 从路由状态获取额外信息
  const routeState = location.state as { customerName?: string; fromCustomerDetail?: boolean } | null;

  // 性能优化：使用 useMemo 缓存计算结果 - 🆕 添加分页参数
  const apiUrls = useMemo(() => {
    const baseUrl = customerId
      ? `/api/projects/customer/${customerId}`
      : '/api/projects';

    // 🆕 只有在非客户项目页面时才添加分页参数
    if (!customerId) {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });
      return {
        customer: customerId ? `/api/customers/${customerId}` : null,
        products: '/api/products',
        projects: `${baseUrl}?${params.toString()}`
      };
    }

    return {
      customer: customerId ? `/api/customers/${customerId}` : null,
      products: '/api/products',
      projects: baseUrl
    };
  }, [customerId, pagination.page, pagination.limit]);

  // 🔧 修复：添加完整的数据获取逻辑
  const { data: customer, error: customerError, isLoading: customerLoading } = useData(apiUrls.customer);
  const { data: productsData, error: productsError, isLoading: productsLoading } = useData(apiUrls.products);
  const { data: projectsData, error: projectsError, isLoading: projectsLoading, mutate: mutateProjects } = useData(apiUrls.projects);

  // 🔧 修复：安全地提取数据
  const products = productsData?.products || [];
  const projects = projectsData?.projects || [];
  // 🆕 提取服务端返回的分页信息
  const serverPagination = projectsData?.pagination || null;

  // 性能优化：使用 useMemo 缓存稳定引用的用户ID
  const userId = useMemo(() => {
    return user?._id || user?.id || (user as any)?.userId;
  }, [user?._id, user?.id, (user as any)?.userId]);

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

  // 🔧 修复：添加是否显示创建按钮的逻辑
  const shouldShowCreateButton = useMemo(() => {
    return !!customerId;
  }, [customerId]);

  // 🆕 分页处理函数 - 🔧 修复：确保状态同步
  const handlePageChange = useCallback((page: number, pageSize?: number) => {
    setPagination(prev => ({
      page: page,
      limit: pageSize || prev.limit
    }));
  }, []);

  // 🆕 页面大小变化处理函数 - 🔧 修复：确保状态同步
  const handleShowSizeChange = useCallback((current: number, size: number) => {
    // 🔧 确保分页状态立即更新，避免不一致
    setPagination({
      page: 1, // 重置到第一页
      limit: size
    });
  }, []);

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
  }, [customerId, projectForm]);

  // 🔧 修复：编辑项目时主动获取完整数据，确保包含附件信息
  const handleEditProject = useCallback(async (project: Project) => {
    try {
      console.log('开始编辑项目，先获取完整数据:', project.projectName);
      
      // 🔧 修复：主动请求完整的项目数据，确保包含附件信息
      const response = await api.get(`/api/projects/${project._id}`);
      
      if (response.success && response.project) {
        console.log('获取到完整项目数据:', response.project);
        
        // 使用完整的项目数据
        const fullProject = response.project;
        fullProject.startDate = dayjs(fullProject.startDate);
        
        setCurrentProject(fullProject);
        setProjectMode('edit');
        setModalKey(`edit_${fullProject._id}_${Date.now()}`);
        
        // 使用完整数据设置表单
        projectForm.setFieldsValue(fullProject);
        setProjectModalVisible(true);
        
        console.log('编辑项目弹窗已打开，使用完整数据');
        console.log('小批量附件数量:', fullProject.smallBatchAttachments?.length || 0);
        console.log('批量出货附件数量:', fullProject.massProductionAttachments?.length || 0);
      } else {
        throw new Error('获取项目详情失败');
      }
    } catch (error) {
      console.error('获取项目完整数据失败:', error);
      message.error('获取项目详情失败，请重试');
      
      // 🔧 降级方案：如果API请求失败，仍然使用列表数据
      console.log('降级使用列表数据进行编辑');
      project.startDate = dayjs(project.startDate);
      setCurrentProject(project);
      setProjectMode('edit');
      setModalKey(`edit_${project._id}_${Date.now()}`);
      
      projectForm.setFieldsValue(project);
      setProjectModalVisible(true);
    }
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
    setProjectModalVisible(false);
    projectForm.resetFields();
    setCurrentProject(null);
    setModalKey('');
  }, [projectForm]);

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
        <div className={`flex ${isMobile ? 'flex-col' : 'flex justify-between items-center'}`}>
          <div className={`flex items-center ${isMobile ? 'mb-2' : ''}`}>
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
              {/* 🆕 添加分页调试信息 */}
              {serverPagination && (
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  [Debug: 当前页{serverPagination.page}/{serverPagination.pages},
                  数据{projects.length}/{serverPagination.total}]
                </Text>
              )}
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
          showCreateButton={shouldShowCreateButton}
          pagination={!customerId ? pagination : undefined}
          serverPagination={!customerId ? serverPagination : undefined}
          onPageChange={handlePageChange}
          onShowSizeChange={handleShowSizeChange}
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