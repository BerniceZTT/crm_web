import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Tag, 
  Tabs, 
  Modal, 
  Form, 
  Input, 
  Select, 
  message, 
  Popconfirm,
  Typography,
  Alert
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  FileExcelOutlined,
  UserOutlined,
  PhoneOutlined,
  ShopOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { UserRole, UserStatus, Agent } from '../shared/types';
import useSWR, { mutate } from 'swr';
import { api } from '../utils/api';
import { useResponsive } from '../hooks/useResponsive';
import ResponsiveTooltip from '../components/common/ResponsiveTooltip';

const { TabPane } = Tabs;
const { Option } = Select;
const { Title } = Typography;

// 为SWR创建fetcher函数，使用已有的api工具
const fetcher = (url: string) => api.get(url);

// 安全的日期格式化函数
const formatDate = (dateString: string | Date | undefined) => {
  if (!dateString) return '未知日期';
  
  try {
    const date = new Date(dateString);
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      console.warn('无效的日期值:', dateString);
      return '日期错误';
    }
    return date.toLocaleDateString();
  } catch (error) {
    console.error('日期格式化错误:', error);
    return '日期错误';
  }
};

const AgentManagement: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
  const isFactorySales = user?.role === UserRole.FACTORY_SALES;
  const userID = user?._id
  const [activeTab, setActiveTab] = useState<string>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<Partial<Agent> | null>(null);
  const [form] = Form.useForm();
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  // 获取所有代理商
  const { data: agentsData, error: agentsError } = useSWR('/api/agents', fetcher);
  const agents = agentsData?.agents || [];
  const loading = !agentsData && !agentsError;
  
  console.log('Agents data:', agentsData, 'Error:', agentsError);
  
  // 获取销售人员列表 - 确保此API可以被原厂销售访问
  const { data: salesData } = useSWR(
    // 不限制角色，允许原厂销售和管理员都能获取
    '/api/users/sales',
    fetcher
  );
  
  const salesUsers = salesData?.users || [];

  // 筛选待审批代理商
  const pendingAgents = agents.filter(
    (agent: Agent) => agent.status === UserStatus.PENDING
  );
  
  // 渲染状态标签
  const renderStatusTag = (status: UserStatus) => {
    const statusConfig = {
      [UserStatus.PENDING]: { color: 'orange', text: '待审批' },
      [UserStatus.APPROVED]: { color: 'green', text: '已批准' },
      [UserStatus.REJECTED]: { color: 'red', text: '已拒绝' }
    };
    
    const { color, text } = statusConfig[status] || { color: 'default', text: '未知状态' };
    return <Tag color={color}>{text}</Tag>;
  };
  
  // 打开添加/编辑代理商模态框
  const showModal = (agentInfo?: Agent) => {
    setCurrentAgent(agentInfo || null);
    form.resetFields();
    
    if (agentInfo) {
      form.setFieldsValue({
        ...agentInfo
      });
    } else if (isFactorySales) {
      // 如果是原厂销售创建新代理商，默认选择自己为关联销售
      form.setFieldsValue({
        relatedSalesId: user?._id
      });
    }
    
    setModalVisible(true);
  };
  
  // 保存代理商
  const handleSave = async () => {
    try {
      // 重置错误状态
      setSubmitError(null);
      
      // 验证表单
      const values = await form.validateFields();
      
      if (currentAgent?._id) {
        // 更新代理商
        await api.put(`/api/agents/${currentAgent._id}`, values, { showSuccessMessage: true });
        mutate('/api/agents'); // 重新获取数据
        setModalVisible(false);
      } else {
        // 创建代理商
        await api.post('/api/agents', values, { showSuccessMessage: true });
        mutate('/api/agents'); // 重新获取数据
        setModalVisible(false);
      }
    } catch (error) {
      console.error('Save agent failed:', error);
      
      // 处理Zod验证错误
      if (error.data?.error?.issues) {
        const issues = error.data.error.issues;
        // 从issues中提取错误信息
        const errorMessages = issues.map((issue: any) => `${issue.path.join('.')}：${issue.message}`);
        setSubmitError(errorMessages.join('; '));
        
        // 设置对应字段的错误状态
        const fieldErrors: Record<string, string[]> = {};
        issues.forEach((issue: any) => {
          const field = issue.path[0];
          if (field) {
            fieldErrors[field] = fieldErrors[field] || [];
            fieldErrors[field].push(issue.message);
          }
        });
        
        // 设置表单字段错误
        Object.entries(fieldErrors).forEach(([field, errors]) => {
          form.setFields([{
            name: field,
            errors: errors
          }]);
        });
      } else {
        // 普通错误
        setSubmitError(error.error || '保存失败，请重试');
      }
    }
  };
  
  // 删除代理商
  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/agents/${id}`, { showSuccessMessage: true });
      mutate('/api/agents'); // 重新获取数据
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };
  
  // 审批代理商
  const handleApprove = async (id: string, approved: boolean) => {
    try {
      await api.put(`/api/agents/${id}`, {
        status: approved ? UserStatus.APPROVED : UserStatus.REJECTED
      }, { showSuccessMessage: true });
      
      mutate('/api/agents'); // 重新获取数据
    } catch (error) {
      console.error('Approval failed:', error);
    }
  };
  
  // 导出代理商为CSV
  const handleExportCSV = () => {
    // 直接使用浏览器下载功能
    window.location.href = `${process.env.AIPA_API_DOMAIN}/api/agents/export/csv`;
  };
  
  // 关闭模态框
  const handleCancel = () => {
    setModalVisible(false);
  };
  
  // 已批准代理商表格列定义
  const agentColumns = [
    {
      title: '代理商名称',
      dataIndex: 'companyName',
      key: 'companyName',
      responsive: ['xs', 'sm', 'md', 'lg']
    },
    {
      title: '联系人',
      dataIndex: 'contactPerson',
      key: 'contactPerson',
      responsive: ['sm', 'md', 'lg']
    },
    {
      title: '联系电话',
      dataIndex: 'phone',
      key: 'phone',
      responsive: ['md', 'lg']
    },
    {
      title: '关联销售',
      dataIndex: 'relatedSalesName',
      key: 'relatedSalesName',
      render: (text: string) => text || '未分配',
      responsive: ['md', 'lg']
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: renderStatusTag,
      responsive: ['xs', 'sm', 'md', 'lg']
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => formatDate(date),
      responsive: ['lg']
    },
    {
      title: '操作',
      key: 'action',
      responsive: ['xs', 'sm', 'md', 'lg'],
      render: (_: any, record: Agent) => {
        // 如果是超级管理员，始终显示所有操作按钮
        if (isSuperAdmin) {
          return (
            <Space size="small">
              <ResponsiveTooltip title="编辑">
                <Button 
                  icon={<EditOutlined />} 
                  onClick={() => showModal(record)} 
                  size="small"
                  type="link"
                />
              </ResponsiveTooltip>
              
              <Popconfirm
                title="确定要删除此代理商吗？"
                onConfirm={() => handleDelete(record._id!)}
                okText="是"
                cancelText="否"
              >
                <ResponsiveTooltip title="删除">
                  <Button 
                    icon={<DeleteOutlined />} 
                    size="small"
                    type="link"
                    danger
                  />
                </ResponsiveTooltip>
              </Popconfirm>
            </Space>
          );
        }
        
        // 对于原厂销售角色：已批准的代理商不显示任何操作按钮，非已批准的显示编辑和删除
        if (isFactorySales) {
          // 已批准的代理商，不显示任何按钮
          if (record.status === UserStatus.APPROVED) {
            return null;
          }
          
          // 待审批或已拒绝的代理商，显示编辑和删除按钮
          return (
            <Space size="small">
              <ResponsiveTooltip title="编辑">
                <Button 
                  icon={<EditOutlined />} 
                  onClick={() => showModal(record)} 
                  size="small"
                  type="link"
                />
              </ResponsiveTooltip>
              
              <Popconfirm
                title="确定要删除此代理商吗？"
                onConfirm={() => handleDelete(record._id!)}
                okText="是"
                cancelText="否"
              >
                <ResponsiveTooltip title="删除">
                  <Button 
                    icon={<DeleteOutlined />} 
                    size="small"
                    type="link"
                    danger
                  />
                </ResponsiveTooltip>
              </Popconfirm>
            </Space>
          );
        }
        
        return null;
      }
    }
  ];
  
  // 待审批代理商表格列定义 - 添加关联销售列
  const pendingColumns = [
    {
      title: '代理商名称',
      dataIndex: 'companyName',
      key: 'companyName',
      responsive: ['xs', 'sm', 'md', 'lg']
    },
    {
      title: '联系人',
      dataIndex: 'contactPerson',
      key: 'contactPerson',
      responsive: ['sm', 'md', 'lg']
    },
    {
      title: '联系电话',
      dataIndex: 'phone',
      key: 'phone',
      responsive: ['md', 'lg']
    },
    {
      title: '关联销售',
      dataIndex: 'relatedSalesName',
      key: 'relatedSalesName',
      render: (text: string) => text || '未分配',
      responsive: ['md', 'lg']
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => formatDate(date),
      responsive: ['lg']
    },
    {
      title: '操作',
      key: 'action',
      responsive: ['xs', 'sm', 'md', 'lg'],
      render: (_: any, record: Agent) => {
        // 仅超级管理员可以看到审批按钮
        if (isSuperAdmin) {
          return (
            <Space size={isMobile ? "middle" : "small"} className="flex flex-row">
              <Button 
                type="primary"
                icon={<CheckCircleOutlined />} 
                onClick={() => handleApprove(record._id!, true)} 
                size="small"
              >
                {!isMobile && "批准"}
              </Button>
              
              <Button 
                danger
                icon={<CloseCircleOutlined />} 
                onClick={() => handleApprove(record._id!, false)} 
                size="small"
              >
                {!isMobile && "拒绝"}
              </Button>
            </Space>
          );
        }
        
        // 原厂销售可以看到编辑和删除按钮，但不能审批
        if (isFactorySales) {
          return (
            <Space size="small">
              <ResponsiveTooltip title="编辑">
                <Button 
                  icon={<EditOutlined />} 
                  onClick={() => showModal(record)} 
                  size="small"
                  type="link"
                />
              </ResponsiveTooltip>
              
              <Popconfirm
                title="确定要删除此代理商吗？"
                onConfirm={() => handleDelete(record._id!)}
                okText="是"
                cancelText="否"
              >
                <ResponsiveTooltip title="删除">
                  <Button 
                    icon={<DeleteOutlined />} 
                    size="small"
                    type="link"
                    danger
                  />
                </ResponsiveTooltip>
              </Popconfirm>
            </Space>
          );
        }
        
        return null;
      }
    }
  ];
  
  // 渲染模态框内容
  const renderModalContent = () => (
    <>
      {submitError && (
        <Alert
          message="保存失败"
          description={submitError}
          type="error"
          showIcon
          closable
          className="mb-4"
        />
      )}
      
      <Form
        form={form}
        layout="vertical"
      >
        <Form.Item
          name="companyName"
          label="代理商公司名称"
          rules={[{ required: true, message: '请输入代理商公司名称' }]}
        >
          <Input prefix={<ShopOutlined />} placeholder="请输入代理商公司名称" />
        </Form.Item>
        
        <Form.Item
          name="contactPerson"
          label="联系人"
          rules={[{ required: true, message: '请输入联系人' }]}
        >
          <Input prefix={<UserOutlined />} placeholder="请输入联系人" />
        </Form.Item>
        
        <Form.Item
          name="phone"
          label="联系电话"
          rules={[
            { required: true, message: '请输入联系电话' },
            { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号码' }
          ]}
        >
          <Input prefix={<PhoneOutlined />} placeholder="请输入联系电话" />
        </Form.Item>
        
        <Form.Item
          name="relatedSalesId"
          label="关联销售"
          rules={[{ required: true, message: '请选择关联销售' }]}
        >
          <Select 
            placeholder='请选择关联销售'
            disabled={isFactorySales} 
          >
            {salesUsers.map((seller: any) => (
              <Option key={seller._id} value={seller._id}>
                {seller.username}
              </Option>
            ))}
          </Select>
        </Form.Item>
        
        {!currentAgent && (
          <Form.Item
            name="password"
            label="登录密码"
            rules={[
              { required: true, message: '请输入登录密码' },
              { min: 6, message: '密码长度不能少于6个字符' }
            ]}
          >
            <Input.Password placeholder="请输入登录密码" />
          </Form.Item>
        )}
        
        {currentAgent && (
          <Form.Item
            name="password"
            label="登录密码"
            rules={[
              { min: 6, message: '密码长度不能少于6个字符' }
            ]}
            help="如不修改密码，请留空"
          >
            <Input.Password placeholder="留空表示不修改密码" />
          </Form.Item>
        )}
      </Form>
    </>
  );
  
  const { isMobile, isTablet, filterColumnsByDevice, getTableSize } = useResponsive();
  
  // 优化表格展示，添加展开功能以在移动端显示更多信息
  const expandedRowRender = (record: Agent) => {
    if (!isMobile) return null;
    
    return (
      <div className="p-2">
        <p><strong>联系电话:</strong> {record.phone}</p>
        <p><strong>关联销售:</strong> {record.relatedSalesName || '未分配'}</p>
        <p><strong>创建时间:</strong> {formatDate(record.createdAt)}</p>
      </div>
    );
  };
  
  return (
    <div>
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        tabBarExtraContent={
          <Space style={{ flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            {hasPermission('exports', 'agents') && (
              <Button 
                icon={<FileExcelOutlined />}
                onClick={handleExportCSV}
                size={isMobile ? "small" : undefined}
              >
                {!isMobile && "导出CSV"}
              </Button>
            )}
            
            {activeTab === 'all' && hasPermission('agents', 'create') && (
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => showModal()}
                size={isMobile ? "small" : undefined}
              >
                {!isMobile && "新增代理商"}
              </Button>
            )}
          </Space>
        }
      >
        <TabPane tab="所有代理商" key="all">
          <Card bodyStyle={{ padding: isMobile ? 8 : 24 }}>
            <Table
              columns={filterColumnsByDevice(agentColumns)}
              dataSource={agents}
              rowKey="_id"
              loading={loading}
              size={getTableSize()}
              pagination={{
                showSizeChanger: !isMobile,
                showTotal: (total) => `共 ${total} 条记录`,
                simple: isMobile,
                defaultPageSize: isMobile ? 10 : 20
              }}
              expandable={isMobile ? {
                expandedRowRender,
                expandRowByClick: true
              } : undefined}
              scroll={{ x: isTablet ? 600 : undefined }}
            />
          </Card>
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              待审批代理商
              {pendingAgents.length > 0 && (
                <Tag color="red" className="ml-2">{pendingAgents.length}</Tag>
              )}
            </span>
          } 
          key="pending"
        >
          <Card bodyStyle={{ padding: isMobile ? 8 : 24 }}>
            {pendingAgents.length > 0 ? (
              <Table
                columns={filterColumnsByDevice(pendingColumns)}
                dataSource={pendingAgents}
                rowKey="_id"
                loading={loading}
                pagination={pendingAgents.length > 10 ? {
                  simple: isMobile,
                  defaultPageSize: isMobile ? 10 : 20
                } : false}
                size={getTableSize()}
                expandable={isMobile ? {
                  expandedRowRender,
                  expandRowByClick: true
                } : undefined}
                scroll={{ x: isTablet ? 600 : undefined }}
              />
            ) : (
              <div className="py-10 text-center text-gray-500">
                暂无待审批代理商
              </div>
            )}
          </Card>
        </TabPane>
      </Tabs>
      
      {/* 优化模态框在移动端的展示 */}
      <Modal
        title={currentAgent ? '编辑代理商' : '新增代理商'}
        open={modalVisible}
        onCancel={handleCancel}
        footer={[
          <Button key="cancel" onClick={handleCancel}>取消</Button>,
          <Button key="submit" type="primary" onClick={handleSave}>保存</Button>
        ]}
        destroyOnClose
        width={isMobile ? "95%" : 520}
      >
        {renderModalContent()}
      </Modal>
      
      <style jsx global>{`
        /* 优化移动端表格样式 */
        @media (max-width: 767px) {
          /* 确保操作按钮水平排列 */
          .ant-table-cell .flex.flex-row {
            display: flex !important;
            flex-direction: row !important;
          }
          
          /* 增强按钮点击区域 */
          .ant-table-cell .ant-btn {
            min-width: 32px;
            padding: 0 8px;
          }
        }
      `}</style>
    </div>
  );
};

export default AgentManagement;