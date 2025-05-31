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
  SearchOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useResponsive } from '../hooks/useResponsive';
import { useCustomerManagement } from '../hooks/useCustomerManagement';
import { api } from '../utils/api';

// 导入子组件
import CustomerFilters from '../components/customers/CustomerFilters';
import CustomerTable from '../components/customers/CustomerTable';
import CustomerForm from '../components/customers/CustomerForm';
import CustomerAssignForm from '../components/customers/CustomerAssignForm';
import CustomerImportForm, { CustomerImportFormRef } from '../components/customers/CustomerImportForm';
import CustomerNameValidator from '../components/customers/CustomerNameValidator';

const CustomerManagement: React.FC = () => {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  const [importBtnLoading, setImportBtnLoading] = useState(false);
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
    handleImportCustomers,
    handleSalesChange,
    refreshCustomers
  } = useCustomerManagement();

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

    // 准备初始数据，将校验通过的名称设置到表单中
    const initialData = {
      name: validatedName
    };

    // 等待Modal关闭后再设置表单值并显示新建客户弹窗
    setTimeout(() => {
      form.setFieldsValue(initialData);
      showModal();
    }, 100);

    message.success('客户名称校验通过，请继续填写其他信息');
  };

  // 增强版的导入处理函数，增加加载状态控制
  const handleImportWithLoading = async () => {
    // 检查文件是否已上传
    if (!importForm.getFieldValue('file') || importForm.getFieldValue('file').length === 0) {
      message.error('请先上传客户数据文件');
      return;
    }

    setImportBtnLoading(true);

    // 获取CustomerImportForm中解析好的客户数据
    // 使用ref对象访问组件方法
    const parsedData = importFormRef.current?.getParsedCustomers();

    if (!parsedData) {
      message.error('无法获取解析后的客户数据');
      setImportBtnLoading(false);
      return;
    }

    // 开始显示进度
    const updateProgress = importFormRef.current?.startImportProgress();

    try {
      // 验证数据有效性
      if (!parsedData.isValid) {
        importFormRef.current?.setImportResultStatus({
          success: false,
          message: '导入验证失败，请修正以下问题:',
          errors: parsedData.errors,
          duplicateCustomers: parsedData.duplicateCustomers
        }, 100, 'error');
        return;
      }

      // 验证客户数据不为空
      if (!parsedData.customers || parsedData.customers.length === 0) {
        importFormRef.current?.setImportResultStatus({
          success: false,
          message: '导入失败：解析的客户数据为空',
          errors: ['请确保Excel文件包含有效的客户数据，并且至少有一条记录']
        }, 100, 'error');
        return;
      }

      // 更新进度到50%
      updateProgress && updateProgress();

      console.log('发送的客户数据:', JSON.stringify({
        customers: parsedData.customers
      }));

      // 调用API进行批量导入
      const importResponse = await api.post('/api/customers/bulk-import', {
        customers: parsedData.customers
      }, { showSuccessMessage: true });

      if (importResponse && importResponse.success) {
        // 导入成功，更新UI状态
        importFormRef.current?.setImportResultStatus({
          success: true,
          message: importResponse.message || '客户数据导入成功',
          successCount: importResponse.count || parsedData.customers.length
        });

        // 刷新客户列表
        refreshCustomers();
      } else {
        // 导入失败，显示错误信息
        importFormRef.current?.setImportResultStatus({
          success: false,
          message: importResponse.error || '导入失败，请重试',
          errors: importResponse.errors || []
        }, 100, 'error');
      }
    } catch (error: any) {
      console.error('客户导入失败:', error);

      // 显示错误信息
      importFormRef.current?.setImportResultStatus({
        success: false,
        message: '导入失败: ' + (error.error || error.message || '未知错误'),
        errors: error.errors || []
      }, 100, 'error');
    } finally {
      setImportBtnLoading(false);
    }
  };

  // 关闭导入弹窗并重置表单
  const handleCloseImportModal = () => {
    handleCancel();
    importForm.resetFields();
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">客户管理</h1>

        {/* 操作按钮 - 更加紧凑的布局 */}
        <Space wrap size="small">
              <Button 
                icon={<SearchOutlined />} 
                onClick={showNameValidator}
                className="border-blue-500 text-blue-500 hover:bg-blue-50"
              >
                查重
              </Button>

          {hasPermission('customers', 'create') && (
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={() => showModal()}
              >
                新增客户
              </Button>
          )}

          {!isMobile && hasPermission('customers', 'create') && (
            <Button 
              icon={<UploadOutlined />} 
              onClick={showImportModal}
            >
              批量导入
            </Button>
          )}
        </Space>
      </div>

      {/* 筛选条件卡片 - 使用受控组件模式传递filters和keyword */}
      <CustomerFilters 
        onFilterChange={handleFilterChange} 
        onSearch={handleSearch}
        keyword={keyword}
        filters={filters}
        onReset={handleResetFilters}
      />

      {/* 客户表格 */}
      <CustomerTable 
        customers={customers}
        pagination={pagination}
        isLoading={isLoading}
        error={error}
        onPageChange={handlePageChange}
        viewCustomerDetail={viewCustomerDetail}
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
        onCancel={handleCloseImportModal}
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