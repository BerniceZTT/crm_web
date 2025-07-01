/**
 * 客户管理业务逻辑钩子
 * 集中处理客户管理页面的状态和操作
 * 简化版本 - 统一搜索和筛选功能
 */
import { useState, useCallback, useEffect } from 'react';
import { message, Form } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useData } from '../utils/dataFetcher';
import { Customer, AgentBrief, UserRole } from '../shared/types';
import { exportCustomersToExcel } from '../utils/fileUtils';

export const useCustomerManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // 表单实例
  const [form] = Form.useForm();
  const [importForm] = Form.useForm();
  const [assignForm] = Form.useForm();
  
  // 统一的查询条件对象 - 增加新的筛选维度
  const [queryParams, setQueryParams] = useState({
    keyword: '',
    nature: undefined,
    importance: undefined,
    isInPublicPool: undefined,
    relatedSalesId: undefined, // 新增：关联销售筛选
    relatedAgentId: undefined, // 新增：关联代理商筛选
    page: 1,
    limit: 10
  });
  
  // 状态管理
  const [availableAgents, setAvailableAgents] = useState<AgentBrief[]>([]);
  const [currentCustomer, setCurrentCustomer] = useState<Partial<Customer> | null>(null);
  
  // 模态框状态
  const [modalVisible, setModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  
  // 判断用户角色
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
  const isFactorySales = user?.role === UserRole.FACTORY_SALES;
  const isAgent = user?.role === UserRole.AGENT;
  const userID = user?._id;
  
  // 获取可分配的代理商列表
  const availableAgentsUrl = (user?.role === UserRole.FACTORY_SALES || user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.AGENT) ? '/api/agents/assignable' : null;
  const { data: agentsData } = useData(availableAgentsUrl);
  
  // 获取产品列表数据
  const { data: productsData } = useData('/api/products');
  const products = productsData?.products || [];
  
  // 获取销售人员列表
  const { data: salesData } = useData('/api/users/sales');
  const salesUsers = salesData?.users || [];
  
  // 处理代理商数据
  useEffect(() => {
    if (agentsData?.agents) {
      setAvailableAgents(agentsData.agents);
    }
  }, [agentsData]);
  
  // 筛选与销售关联的代理商
  const filterAgentsBySalesId = useCallback((salesId: string) => {
    if (!agentsData?.agents) return [];
    
    return agentsData.agents.filter((agent: AgentBrief) => 
      agent.relatedSalesId === salesId
    );
  }, [agentsData]);
  
  // 构建API请求参数
  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    
    // 将所有非空查询参数添加到URL中
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    
    return params.toString();
  }, [queryParams]);
  
  // 使用自定义 hook 获取客户数据
  const apiUrl = `/api/customers?${buildQueryString()}`;
  const { data, error, isLoading, mutate: refreshCustomers } = useData(apiUrl);

  // 安全获取客户列表
  const customers = data?.customers || [];
  const pagination = data?.pagination || { 
    total: 0, 
    page: 1, 
    limit: queryParams.limit, 
    pages: 1 
  };
  
  // 修正分页信息，确保当前页使用本地状态
  const correctedPagination = {
    ...pagination,
    page: queryParams.page, // 使用本地查询参数的页码
    limit: queryParams.limit, // 使用本地查询参数的页面大小
    total: pagination.total, // 使用服务端返回的总数
    pages: Math.ceil(pagination.total / queryParams.limit) // 重新计算总页数
  };

  // 统一的查询条件更新函数 - 处理所有搜索和筛选操作
  const updateQueryParams = useCallback((updates: Partial<typeof queryParams>) => {
    setQueryParams(prev => {
      // 如果更新包含页码以外的查询条件，重置页码为1
      const resetPage = Object.keys(updates).some(key => key !== 'page' && key !== 'limit');
      
      return {
        ...prev,
        ...updates,
        page: resetPage ? 1 : (updates.page || prev.page)
      };
    });
  }, []);
  
  // 搜索处理 - 调用统一的更新函数
  const handleSearch = (value: string) => {
    updateQueryParams({ keyword: value });
  };
  
  // 筛选变更处理 - 调用统一的更新函数
  const handleFilterChange = (field: string, value: any) => {
    updateQueryParams({ [field]: value });
  };
  
  // 重置所有筛选 - 增加新的筛选字段
  const handleResetFilters = useCallback(() => {
    // 重置为初始状态，但保留每页数量
    updateQueryParams({
      keyword: '',
      nature: undefined,
      importance: undefined,
      isInPublicPool: undefined,
      relatedSalesId: undefined, // 新增：重置关联销售筛选
      relatedAgentId: undefined, // 新增：重置关联代理商筛选
      page: 1
    });
    
    // message.success('筛选条件已重置');
  }, [updateQueryParams]);
  
  // 翻页处理
  const handlePageChange = (page: number, pageSize?: number) => {
    const updates: Partial<typeof queryParams> = { page };
    if (pageSize) {
      updates.limit = pageSize;
    }
    updateQueryParams(updates);
  };
  
  // 取消处理函数 - 用于关闭所有模态框
  const handleCancel = () => {
    // 使用单独的状态更新调用，避免状态更新合并导致需要多次点击
    if (modalVisible) {
      setModalVisible(false);
    }
    
    if (importModalVisible) {
      setImportModalVisible(false);
    }
    
    if (assignModalVisible) {
      setAssignModalVisible(false);
    }
    
    // 延迟重置表单，确保模态框已关闭
    setTimeout(() => {
      form.resetFields();
      importForm.resetFields();
      assignForm?.resetFields();
    }, 100);
  };
  
  // 保存客户
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      // 确保 annualDemand 是数字类型
      if (values.annualDemand) {
        values.annualDemand = Number(values.annualDemand);
      }
      
      // 如果有关联销售，自动将客户从公海移出
      if (values.relatedSalesId) {
        values.isInPublicPool = false;
      }
      
      console.log('提交的客户数据:', values);
      
      if (currentCustomer?._id) {
        // 更新客户
        await api.put(`/api/customers/${currentCustomer._id}`, values);
        message.success('客户信息更新成功');
      } else {
        // 创建客户
        await api.post('/api/customers', values);
        message.success('客户创建成功');
      }
      
      setModalVisible(false);
      // 刷新数据
      refreshCustomers();
    } catch (error) {
      console.error('Save failed:', error);
      message.error(error.error || '保存失败');
    }
  };

  // 显示模态框
  const showModal = (customer?: Customer) => {
    setCurrentCustomer(customer || null);
    form.resetFields();
    
    if (customer) {
      // 编辑现有客户，设置表单值
      const formValues = { ...customer };
      
      // 如果客户的 progress 是 PUBLIC_POOL，则不设置该字段值，保持为空
      if (formValues.progress === 'PUBLIC_POOL') {
        delete formValues.progress;
      }
      
      form.setFieldsValue({
        ...formValues,
        // 如果当前用户是原厂销售且是新建客户，默认关联销售是自己
        relatedSalesId: customer.relatedSalesId || (isFactorySales ? user?._id : undefined)
      });
      
      // 如果有关联销售，筛选代理商列表
      if (customer.relatedSalesId) {
        setAvailableAgents(filterAgentsBySalesId(customer.relatedSalesId));
      }
    } else {
      // 创建新客户，设置默认值
      let defaultSalesId = undefined;
      let defaultAgentId = undefined;

      if (isFactorySales) {
        // 销售角色默认关联销售为自己
        defaultSalesId = user?._id;
      } else if (isAgent && user) {
        // 代理商角色默认关联代理商为自己，关联销售为代理商关联的销售
        defaultSalesId = user?.relatedSalesId;
        defaultAgentId = user?._id;
      } else if (isSuperAdmin) {
        // 管理员不设置默认值
        defaultSalesId = undefined;
        defaultAgentId = undefined;
      }

      form.setFieldsValue({
        relatedSalesId: defaultSalesId,
        relatedAgentId: defaultAgentId
      });
      
      // 如果有默认销售，筛选代理商列表
      if (defaultSalesId) {
        setAvailableAgents(filterAgentsBySalesId(defaultSalesId));
      }
    }
    
    setModalVisible(true);
  };
  
  // 处理删除客户
  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/customers/${id}`);
      message.success('客户删除成功');
      refreshCustomers();
    } catch (error) {
      console.error('Delete failed:', error);
      message.error('删除失败: ' + (error.error || '未知错误'));
    }
  };
  
  // 查看客户详情
  const viewCustomerDetail = (id: string) => {
    navigate(`/customers/${id}`);
  };
  
  // 移入公海
  const moveToPublicPool = async (id: string) => {
    try {
      await api.post(`/api/customers/${id}/move-to-public`);
      message.success('客户已成功移入公海');
      refreshCustomers();
    } catch (error) {
      console.error('Move to public pool failed:', error);
      message.error('移入公海失败: ' + (error.error || '未知错误'));
    }
  };
  
  // 显示分配客户模态框
  const showAssignModal = (customer: Customer) => {
    setCurrentCustomer(customer);
    assignForm?.resetFields();
    
    // 始终首先获取当前客户的关联信息
    let defaultSalesId = customer.relatedSalesId;
    let defaultAgentId = customer.relatedAgentId;
    
    // 仅在特定角色且当前客户没有关联信息时应用默认角色
    if (isFactorySales && !defaultSalesId) {
      defaultSalesId = user?._id;
    }
    
    if (isAgent && user) {
      // 代理商角色默认关联代理商为自己，关联销售为代理商关联的销售
      if (!defaultAgentId) defaultAgentId = user?._id;
      if (!defaultSalesId) defaultSalesId = user?.relatedSalesId;
    }
    
    assignForm.setFieldsValue({
      salesId: defaultSalesId,
      agentId: defaultAgentId
    });
    
    // 如果有默认销售，筛选代理商列表
    if (defaultSalesId) {
      setAvailableAgents(filterAgentsBySalesId(defaultSalesId));
    }
    
    setAssignModalVisible(true);
  };
  
  // 处理分配客户（同时分配销售和代理商）
  const handleAssignCustomer = async () => {
    try {
      // 先验证表单字段
      const values = await assignForm.validateFields();
      
      // 表单验证通过后再提交请求
      await api.post(`/api/change_customers/${currentCustomer?._id}/assign`, {
        salesId: values.salesId,
        agentId: values.agentId
      });
      
      message.success('客户已成功分配');
      setAssignModalVisible(false);
      refreshCustomers();
    } catch (error) {
      console.error('Assign failed:', error);
      
      // 区分表单验证错误和API请求错误
      if (error.errorFields) {
        // 表单验证错误
        message.error('请填写必要的分配信息');
      } else {
        // API请求错误
        message.error('分配失败: ' + (error.error || '未知错误'));
      }
    }
  };
  
  // 取消代理商关联
  const cancelAgentAssignment = async (id: string) => {
    try {
      await api.post(`/api/customers/${id}/cancel-agent`);
      message.success('已取消客户与代理商的关联');
      refreshCustomers();
    } catch (error) {
      console.error('Cancel assignment failed:', error);
      message.error('取消代理商关联失败: ' + (error.error || '未知错误'));
    }
  };
  
  // 显示批量导入模态框
  const showImportModal = () => {
    importForm.resetFields();
    setImportModalVisible(true);
  };
  
  // 处理批量导入客户
  const handleImportCustomers = async () => {
    try {
      const values = await importForm.validateFields();
      
      // 这里假设values.file是一个文件对象或文件ID
      await api.post('/api/customers/bulk-import', {
        customers: [] // 这里需要从上传的文件中解析客户数据
      });
      
      message.success('客户批量导入成功');
      setImportModalVisible(false);
      refreshCustomers();
    } catch (error) {
      console.error('Import failed:', error);
      message.error('导入失败: ' + (error.error || '未知错误'));
    }
  };
  
  // 处理客户关联销售变更
  const handleSalesChange = (salesId: string) => {
    setAvailableAgents(filterAgentsBySalesId(salesId));
  };

  // 处理批量导出客户
  const handleExportCustomers = useCallback(async () => {
    console.log("customers",customers)
    try {
      if (!customers || customers.length === 0) {
        message.warning('当前没有客户数据可以导出');
        return;
      }
      
      // 构建当前筛选条件的描述
      const filterDescription = [];
      if (queryParams.keyword) {
        filterDescription.push(`关键词: ${queryParams.keyword}`);
      }
      if (queryParams.nature) {
        filterDescription.push(`客户性质: ${queryParams.nature}`);
      }
      if (queryParams.importance) {
        filterDescription.push(`重要程度: ${queryParams.importance}`);
      }
      if (queryParams.isInPublicPool !== undefined) {
        filterDescription.push(`客户状态: ${queryParams.isInPublicPool ? '公海客户' : '私海客户'}`);
      }
      if (queryParams.relatedSalesId) {
        const salesUser = salesUsers.find(s => s._id === queryParams.relatedSalesId);
        filterDescription.push(`关联销售: ${salesUser?.username || queryParams.relatedSalesId}`);
      }
      if (queryParams.relatedAgentId) {
        const agent = availableAgents.find(a => a._id === queryParams.relatedAgentId);
        filterDescription.push(`关联代理商: ${agent?.companyName || queryParams.relatedAgentId}`);
      }
      
      // 生成文件名
      let filename = '客户数据导出';
      if (filterDescription.length > 0) {
        filename += `_${filterDescription.join('_')}`;
      }
      
      // 为了避免文件名过长，限制长度
      if (filename.length > 100) {
        filename = `客户数据导出_筛选条件${filterDescription.length}项`;
      }
      
      // 导出当前页面的客户数据
      exportCustomersToExcel(customers, filename);
      
      message.success(`成功导出 ${customers.length} 条客户数据`);
      
      console.log('客户数据导出完成:', {
        total: customers.length,
        filters: filterDescription,
        filename
      });
      
    } catch (error) {
      console.error('导出客户数据失败:', error);
      message.error('导出失败: ' + (error.message || '未知错误'));
    }
  }, [customers, queryParams, salesUsers, availableAgents]);

  return {
    // 状态 - 增加新的筛选字段
    filters: {
      nature: queryParams.nature,
      importance: queryParams.importance,
      isInPublicPool: queryParams.isInPublicPool,
      relatedSalesId: queryParams.relatedSalesId, // 新增
      relatedAgentId: queryParams.relatedAgentId // 新增
    },
    keyword: queryParams.keyword,
    customers,
    pagination: correctedPagination, // 使用修正后的分页信息
    error,
    isLoading,
    modalVisible,
    importModalVisible,
    assignModalVisible,
    currentCustomer,
    userRole: user?.role,
    userId: user?._id,
    
    // 数据
    products,
    salesUsers,
    availableAgents,
    
    // 表单实例
    form,
    importForm,
    assignForm,
    
    // 方法
    handleSearch,
    handleFilterChange,
    handleResetFilters,
    handlePageChange,
    showModal,
    handleCancel,
    handleSave,
    handleDelete,
    viewCustomerDetail,
    moveToPublicPool,
    showAssignModal,
    handleAssignCustomer,
    cancelAgentAssignment,
    showImportModal,
    handleImportCustomers,
    handleSalesChange,
    handleExportCustomers, // 新增导出方法
    refreshCustomers
  };
};