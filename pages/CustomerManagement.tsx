/**
 * 客户管理页面
 * 展示客户列表，提供增删改查和筛选功能
 * 增强了移动端适配
 */
import React, { useState, useRef } from 'react';
import { 
  Space, 
  Button, 
  Modal, 
  message,
  Form
} from 'antd';
import { 
  PlusOutlined, 
  UploadOutlined,
  DownloadOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useResponsive } from '../hooks/useResponsive';
import { useCustomerManagement } from '../hooks/useCustomerManagement';
import { api } from '../utils/api';
import { UserRole } from '../shared/types';

// 导入子组件
import CustomerFilters from '../components/customers/CustomerFilters';
import CustomerTable from '../components/customers/CustomerTable';
import CustomerForm from '../components/customers/CustomerForm';
import CustomerAssignForm from '../components/customers/CustomerAssignForm';
import CustomerImportForm, { CustomerImportFormRef } from '../components/customers/CustomerImportForm';
import CustomerNameValidator from '../components/customers/CustomerNameValidator';

const CustomerManagement: React.FC = () => {
  const { hasPermission, user } = useAuth();
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  const [importBtnLoading, setImportBtnLoading] = useState(false);
  const [exportBtnLoading, setExportBtnLoading] = useState(false);
  const [nameValidatorVisible, setNameValidatorVisible] = useState(false);
  const importFormRef = useRef<CustomerImportFormRef>(null);
  
  // 使用自定义钩子管理业务逻辑和状态
  const {
    // 状态
    keyword,
    filters,
    customers,
    pagination,
    error,
    isLoading,
    modalVisible,
    importModalVisible,
    assignModalVisible,
    currentCustomer,
    userRole,
    userId,
    
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
    showImportModal,
    handleSalesChange,
    refreshCustomers,
    handleExportCustomers, // 新增导出方法
  } = useCustomerManagement();

  // 新增查看客户项目函数
  const viewCustomerProjects = (customerId: string) => {
    navigate(`/projects/customer/${customerId}`);
  };

  // 显示客户名称校验器（查重功能）
  const showNameValidator = () => {
    setNameValidatorVisible(true);
  };

  // 关闭客户名称校验器
  const handleNameValidatorCancel = () => {
    setNameValidatorVisible(false);
  };

  // 从客户名称校验器确认后创建新客户
  const handleNameValidatorConfirm = (validatedName: string) => {
    setNameValidatorVisible(false);
    
    const initialData = {
      name: validatedName
    };
    
    setTimeout(() => {
      form.setFieldsValue(initialData);
      showModal();
    }, 100);
    
    message.success('客户名称校验通过，请继续填写其他信息');
  };

  // 增强版的导入处理函数，增加加载状态控制
  const handleImportWithLoading = async () => {
    if (!importForm.getFieldValue('file') || importForm.getFieldValue('file').length === 0) {
      message.error('请先上传客户数据文件');
      return;
    }

    setImportBtnLoading(true);
    
    const parsedData = importFormRef.current?.getParsedCustomers();
    
    if (!parsedData) {
      message.error('无法获取解析后的客户数据');
      setImportBtnLoading(false);
      return;
    }
    
    const updateProgress = importFormRef.current?.startImportProgress();
    
    try {
      if (!parsedData.isValid) {
        importFormRef.current?.setImportResultStatus({
          success: false,
          message: '导入验证失败，请修正以下问题:',
          errors: parsedData.errors,
          duplicateCustomers: parsedData.duplicateCustomers
        }, 100, 'error');
        return;
      }
      
      if (!parsedData.customers || parsedData.customers.length === 0) {
        importFormRef.current?.setImportResultStatus({
          success: false,
          message: '导入失败：解析的客户数据为空',
          errors: ['请确保Excel文件包含有效的客户数据，并且至少有一条记录']
        }, 100, 'error');
        return;
      }
      
      updateProgress && updateProgress();
      
      console.log('发送的客户数据:', JSON.stringify({
        customers: parsedData.customers
      }));
      
      const importResponse = await api.post('/api/customers/bulk-import', {
        customers: parsedData.customers
      }, { showSuccessMessage: true });
      
      if (importResponse && importResponse.success) {
        importFormRef.current?.setImportResultStatus({
          success: true,
          message: importResponse.message || '客户数据导入成功',
          successCount: importResponse.count || parsedData.customers.length
        });
        
        refreshCustomers();
      } else {
        importFormRef.current?.setImportResultStatus({
          success: false,
          message: importResponse.error || '导入失败，请重试',
          errors: importResponse.errors || []
        }, 100, 'error');
      }
    } catch (error: any) {
      console.error('客户导入失败:', error);
      
      importFormRef.current?.setImportResultStatus({
        success: false,
        message: '导入失败: ' + (error.message || '未知错误'),
        errors: error.errors || []
      }, 100, 'error');
    } finally {
      setImportBtnLoading(false);
    }
  };

  // 增强版的导出处理函数，增加加载状态控制
  const handleExportWithLoading = async () => {
    setExportBtnLoading(true);
    
    try {
      await handleExportCustomers();
    } catch (error) {
      console.error('导出客户数据失败:', error);
      message.error('导出失败: ' + (error.message || '未知错误'));
    } finally {
      setExportBtnLoading(false);
    }
  };

  // 判断是否为超级管理员
  const isAdmin = user?.role === UserRole.SUPER_ADMIN;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">客户管理</h1>
        
        {/* 操作按钮 - 更加紧凑的布局 */}
        <Space wrap size="small">
          {hasPermission('customers', 'create') && (
            <>
              <Button 
                icon={<SearchOutlined />} 
                onClick={showNameValidator}
                className="border-blue-500 text-blue-500 hover:bg-blue-50"
              >
                查重
              </Button>
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={() => showModal()}
              >
                新增客户
              </Button>
            </>
          )}
          
          {!isMobile && hasPermission('customers', 'create') && (
            <Button 
              icon={<UploadOutlined />} 
              onClick={showImportModal}
            >
              批量导入
            </Button>
          )}

          {/* 批量导出按钮 - 仅超级管理员在PC端可见 */}
          {!isMobile && isAdmin && (
            <Button 
              icon={<DownloadOutlined />} 
              onClick={handleExportWithLoading}
              loading={exportBtnLoading}
              className="border-green-500 text-green-500 hover:bg-green-50"
            >
              批量导出
            </Button>
          )}
        </Space>
      </div>
      
      {/* 筛选条件卡片 */}
      <CustomerFilters 
        onFilterChange={handleFilterChange} 
        onSearch={handleSearch}
        keyword={keyword}
        filters={filters}
        onReset={handleResetFilters}
      />
      
      {/* 客户表格 - 增加查看项目功能 */}
      <CustomerTable 
        customers={customers}
        pagination={pagination}
        isLoading={isLoading}
        error={error}
        onPageChange={handlePageChange}
        viewCustomerDetail={viewCustomerDetail}
        viewCustomerProjects={viewCustomerProjects} // 新增
        showModal={showModal}
        showAssignModal={showAssignModal}
        moveToPublicPool={moveToPublicPool}
        handleDelete={handleDelete}
      />
      
        {/* 客户查重模态框 */}
      <Modal
        title={
          <div className="flex items-center">
            <SearchOutlined className="mr-2 text-blue-500" />
            客户查重检查
          </div>
        }
        open={nameValidatorVisible}
        onCancel={handleNameValidatorCancel}
        footer={null}
        width={800}
        maskClosable={false}
        destroyOnClose
      >
        <CustomerNameValidator 
          visible={nameValidatorVisible}
          initialName=""
          onCancel={handleNameValidatorCancel}
          onConfirm={handleNameValidatorConfirm}
          readOnly={true}
        />
      </Modal>
      
      {/* 客户新增/编辑模态框 */}
      <Modal
        title={currentCustomer ? '编辑客户' : '新增客户'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={handleCancel}
        width={600}
        maskClosable={false}
        destroyOnClose
      >
        <CustomerForm 
          form={form}
          currentCustomer={currentCustomer}
          products={products}
          salesUsers={salesUsers}
          availableAgents={availableAgents}
          userRole={userRole}
          userId={userId}
          onSalesChange={handleSalesChange}
        />
      </Modal>
      
      {/* 客户分配模态框 */}
      <Modal
        title="分配客户"
        open={assignModalVisible}
        onOk={handleAssignCustomer}
        onCancel={handleCancel}
        width={500}
        maskClosable={false}
        destroyOnClose
      >
        <CustomerAssignForm 
          form={assignForm}
          currentCustomer={currentCustomer}
          salesUsers={salesUsers}
          availableAgents={availableAgents}
          userRole={userRole}
          onSalesChange={handleSalesChange}
        />
      </Modal>
      
      {/* 客户批量导入模态框 */}
      <Modal
        title="批量导入客户"
        open={importModalVisible}
        onOk={handleImportWithLoading}
        onCancel={handleCancel}
        okText="导入"
        okButtonProps={{ 
          icon: <UploadOutlined />,
          loading: importBtnLoading
        }}
        width={600}
        maskClosable={false}
        destroyOnClose
      >
        <CustomerImportForm 
          form={importForm} 
          ref={importFormRef}
        />
      </Modal>
    </div>
  );
};

export default CustomerManagement;