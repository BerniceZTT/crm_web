/**
 * 项目管理页面 - 性能优化版本
 * 支持查看特定客户的项目或所有项目
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Card, 
  Button, 
  Modal, 
  message,
  Form,
  Typography,
  Breadcrumb,
  Spin
} from 'antd';
import { 
  ArrowLeftOutlined} from '@ant-design/icons';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Project, 
  Product, 
  Customer
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
  // 新增：模态框key，用于强制重新渲染表单组件
  const [modalKey, setModalKey] = useState<string>('');

  // 性能优化：使用 useMemo 缓存计算结果
  const apiUrls = useMemo(() => ({
    customer: customerId ? `/api/customers/${customerId}` : null,
    products: '/api/products',
    projects: customerId 
      ? `/api/projects/customer/${customerId}` 
      : '/api/projects'
  }), [customerId]);

  // 性能优化：并行加载数据，减少总等待时间
  const { 
    data: customerData, 
    isLoading: customerLoading,
    error: customerError
  } = useData<{ customer: Customer }>(apiUrls.customer);
  
  const { 
    data: productsData,
    isLoading: productsLoading 
  } = useData<{ products: Product[] }>(apiUrls.products);
  
  const {
    data: projectsData,
    isLoading: projectsLoading,
    error: projectsError,
    mutate: mutateProjects
  } = useData<{ projects: Project[] }>(apiUrls.projects);
  
  const customer = customerData?.customer;
  const products = productsData?.products || [];
  const projects = projectsData?.projects || [];

  // 性能优化：使用 useMemo 缓存复杂计算
  const pageTitle = useMemo(() => {
    if (customerId && customer) {
      return `${customer.name} - 项目管理`;
    }
    return '项目管理';
  }, [customerId, customer?.name]);

  const breadcrumbItems = useMemo(() => {
    const items = [];
    
    if (customerId && customer) {
      items.push({
        title: <a onClick={() => navigate('/customers')}>客户管理</a>
      });
      items.push({
        title: <a onClick={() => navigate(`/customers/${customerId}`)}>{customer.name}</a>
      });
      items.push({
        title: '项目管理'
      });
    } else {
      items.push({
        title: '项目管理'
      });
    }
    
    return items;
  }, [customerId, customer?.name, navigate]);

  // 性能优化：使用 useCallback 避免函数重复创建
  const handleGoBack = useCallback(() => {
    if (customerId) {
      navigate(`/customers/${customerId}`);
    } else {
      navigate('/customers');
    }
  }, [customerId, navigate]);

  // 修改：新建项目时确保完全重置
  const handleAddProject = useCallback(() => {
    console.log('开始新建项目，重置所有状态...');
    
    // 重置当前项目状态
    setCurrentProject(null);
    setProjectMode('create');
    
    // 生成新的modalKey，强制重新渲染ProjectForm组件
    setModalKey(`create_${Date.now()}`);
    
    // 重置表单
    projectForm.resetFields();
    
    // 如果有customerId，预填充客户信息
    if (customerId) {
      projectForm.setFieldsValue({ customerId });
    }
    
    // 打开弹窗
    setProjectModalVisible(true);
    
    console.log('新建项目弹窗已打开，状态已重置');
  }, [customerId, projectForm]);

  // 修改：编辑项目时也生成新的key
  const handleEditProject = useCallback((project: Project) => {
    console.log('开始编辑项目:', project.projectName);
    project.startDate = dayjs(project.startDate)
    setCurrentProject(project);
    setProjectMode('edit');
    
    // 生成新的modalKey，确保表单组件重新渲染
    setModalKey(`edit_${project._id}_${Date.now()}`);
    
    // 设置表单值
    projectForm.setFieldsValue(project);
    
    setProjectModalVisible(true);
    
    console.log('编辑项目弹窗已打开');
  }, [projectForm]);

  const handleProjectSubmit = useCallback(async () => {
    try {
      const values = await projectForm.validateFields();
      setProjectLoading(true);
      
      console.time('项目提交耗时'); // 性能监控
      
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
      
      mutateProjects();
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

  // 修改：取消时确保完全重置状态
  const handleProjectCancel = useCallback(() => {
    console.log('取消项目操作，重置状态...');
    
    setProjectModalVisible(false);
    projectForm.resetFields();
    setCurrentProject(null);
    setModalKey(''); // 重置modalKey
    
    console.log('项目弹窗已关闭，状态已重置');
  }, [projectForm]);

  // 性能优化：显示加载性能指标
  useEffect(() => {
    if (!customerLoading && !productsLoading && !projectsLoading) {
      console.log('项目管理页面数据加载完成');
      console.log(`客户数据: ${customer ? '已加载' : '无需加载'}`);
      console.log(`产品数量: ${products.length}`);
      console.log(`项目数量: ${projects.length}`);
    }
  }, [customerLoading, productsLoading, projectsLoading, customer, products.length, projects.length]);

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
        <Button onClick={() => mutateProjects()} type="primary">
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
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={handleGoBack}
              className={`${isMobile ? 'mb-2' : 'mr-4'}`}
              size={isMobile ? "middle" : "middle"}
            >
              返回
            </Button>
            <div className={`flex items-center ${isMobile ? 'mb-2' : ''}`}>
              <Title level={isMobile ? 5 : 4} className="m-0">
                {pageTitle}
              </Title>
            </div>
          </div>
        </div>
      </div>
      
      {/* 项目列表 */}
      <Card 
        className="project-list-card"
        bodyStyle={{ padding: isMobile ? '12px' : '24px' }}
      >
        <ProjectList
          customerId={customerId || ''}
          projects={projects}
          loading={projectsLoading}
          onRefresh={() => mutateProjects()}
          onEdit={handleEditProject}
          onAdd={handleAddProject}
        />
      </Card>

      {/* 项目创建/编辑Modal - 添加key属性确保组件重新渲染 */}
      <Modal
        key={modalKey} // 关键修改：添加key属性
        title={`${projectMode === 'create' ? '新建' : '编辑'}项目`}
        open={projectModalVisible}
        onOk={handleProjectSubmit}
        onCancel={handleProjectCancel}
        confirmLoading={projectLoading}
        width={isMobile ? '95%' : 800}
        destroyOnClose={true} // 确保关闭时销毁组件
        okText={projectMode === 'create' ? '创建' : '保存'}
        cancelText="取消"
        maskClosable={false} // 防止误操作
      >
        <ProjectForm
          key={modalKey} // 关键修改：ProjectForm组件也添加key属性
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