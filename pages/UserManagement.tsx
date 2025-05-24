/**
 * 用户管理页面
 * 仅超级管理员可见，用于管理系统用户和审批新用户注册
 */

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
  Spin
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  UserOutlined,
  PhoneOutlined,
  LockOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { User, UserRole, UserStatus } from '../shared/types';
import { api } from '../utils/api';
import useSWR, { mutate } from 'swr';
import { useResponsive } from '../hooks/useResponsive';
import ResponsiveTooltip from '../components/common/ResponsiveTooltip';

const { TabPane } = Tabs;
const { Option } = Select;

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

const UserManagement: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState<Partial<User> | null>(null);
  const [approvalInfo, setApprovalInfo] = useState<{id: string, type: string, approved: boolean}>({
    id: '',
    type: 'user',
    approved: false
  });
  const [rejectReason, setRejectReason] = useState('');
  const [form] = Form.useForm();
  const { isMobile, isTablet, filterColumnsByDevice, getTableSize } = useResponsive();
  
  // 获取所有用户 - 添加错误处理和重试逻辑
  const { 
    data: usersData, 
    error: usersError, 
    isValidating: usersLoading,
    mutate: mutateUsers
  } = useSWR<{users: User[]}>('/api/users', api.get, {
    onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
      // 重试最多5次
      if (retryCount >= 5) return;
      
      // 如果是认证错误，刷新token或重定向到登录页
      if (error.status === 401) {
        // 可以在这里添加重新登录的逻辑
        setTimeout(() => revalidate({ retryCount }), 5000);
        return;
      }
      
      // 3秒后重试
      setTimeout(() => revalidate({ retryCount }), 3000);
    }
  });
  
  // 获取待审批用户 - 修复API路径
  const { 
    data: pendingData, 
    error: pendingError, 
    isValidating: pendingLoading,
    mutate: mutatePending
  } = useSWR<{pendingAccounts: User[]}>('/api/users/pending/approval', api.get, {
    onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
      if (retryCount >= 5) return;
      
      if (error.status === 401) {
        setTimeout(() => revalidate({ retryCount }), 5000);
        return;
      }
      
      setTimeout(() => revalidate({ retryCount }), 3000);
    }
  });
  
  // 错误处理增强
  useEffect(() => {
    if (usersError) {
      console.error("用户列表获取错误:", usersError);
      message.error(`获取用户列表失败: ${usersError.error || '未知错误'}`);
    }
    if (pendingError) {
      console.error("待审批用户获取错误:", pendingError);
      message.error(`获取待审批用户失败: ${pendingError.error || '未知错误'}`);
    }
  }, [usersError, pendingError]);
  
  // 打开添加/编辑用户模态框
  const showModal = (userInfo?: User) => {
    setCurrentUser(userInfo || null);
    form.resetFields();
    
    if (userInfo) {
      // 编辑用户时，不显示密码字段
      form.setFieldsValue({
        username: userInfo.username,
        phone: userInfo.phone,
        role: userInfo.role
      });
    }
    
    setModalVisible(true);
  };
  
  // 保存用户
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      if (currentUser?._id) {
        // 更新用户
        await api.put(`/api/users/${currentUser._id}`, values);
        message.success('用户信息更新成功');
        // 刷新用户列表
        mutateUsers();
      } else {
        // 创建用户
        await api.post('/api/users', values);
        message.success('用户创建成功');
        // 刷新用户列表
        mutateUsers();
      }
      
      setModalVisible(false);
    } catch (error) {
      message.error(`操作失败: ${error.message || '未知错误'}`);
      console.error('Save failed:', error);
    }
  };
  
  // 删除用户
  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/users/${id}`);
      message.success('用户删除成功');
      // 刷新用户列表
      mutateUsers();
    } catch (error) {
      message.error(`删除失败: ${error.message || '未知错误'}`);
    }
  };
  
  // 显示审批模态框
  const showApprovalModal = (id: string, type: string, approved: boolean) => {
    setApprovalInfo({ id, type, approved });
    setRejectReason('');
    
    if (!approved) {
      setApprovalModalVisible(true);
    } else {
      // 如果是批准，直接处理
      handleApprove(id, type, approved);
    }
  };
  
  // 审批用户
  const handleApprove = async (id: string, type: string, approved: boolean) => {
    try {
      const data = {
        id,
        type,
        approved,
        reason: approved ? undefined : rejectReason
      };
      
      await api.post('/api/users/approve', data);
      message.success(approved ? '已批准用户申请' : '已拒绝用户申请');
      
      // 刷新待审批列表和用户列表
      mutatePending();
      mutateUsers();
      
      setApprovalModalVisible(false);
    } catch (error) {
      message.error(`审批失败: ${error.error || '未知错误'}`);
    }
  };
  
  // 角色标签渲染
  const renderRoleTag = (role: UserRole) => {
    let color = 'default';
    let text = '未知角色';
    
    switch (role) {
      case UserRole.SUPER_ADMIN:
        color = 'red';
        text = '超级管理员';
        break;
      case UserRole.FACTORY_SALES:
        color = 'blue';
        text = '原厂销售';
        break;
      case UserRole.INVENTORY_MANAGER:
        color = 'green';
        text = '库存管理员';
        break;
      case UserRole.AGENT:
        color = 'purple';
        text = '代理商';
        break;
    }
    
    return <Tag color={color}>{text}</Tag>;
  };
  
  // 状态标签渲染
  const renderStatusTag = (status: UserStatus) => {
    const statusConfig = {
      [UserStatus.PENDING]: { color: 'orange', text: '待审批' },
      [UserStatus.APPROVED]: { color: 'green', text: '已批准' },
      [UserStatus.REJECTED]: { color: 'red', text: '已拒绝' }
    };
    
    const { color, text } = statusConfig[status] || { color: 'default', text: '未知状态' };
    return <Tag color={color}>{text}</Tag>;
  };
  
  // 已批准用户表格列定义
  const userColumns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      responsive: ['xs', 'sm', 'md', 'lg']
    },
    {
      title: '联系电话',
      dataIndex: 'phone',
      key: 'phone',
      responsive: ['md', 'lg']
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: renderRoleTag,
      responsive: ['xs', 'sm', 'md', 'lg']
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: renderStatusTag,
      responsive: ['sm', 'md', 'lg']
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
      render: (_: any, record: User) => (
        <Space size="small">
          <ResponsiveTooltip title="编辑">
            <Button 
              icon={<EditOutlined />} 
              onClick={() => showModal(record)} 
              size="small"
              type="link"
              disabled={record.role === UserRole.SUPER_ADMIN && record._id !== user?._id}
            />
          </ResponsiveTooltip>
          
          <Popconfirm
            title="确定要删除此用户吗？"
            onConfirm={() => handleDelete(record._id!)}
            okText="是"
            cancelText="否"
            disabled={record.role === UserRole.SUPER_ADMIN}
          >
            <ResponsiveTooltip title="删除">
              <Button 
                icon={<DeleteOutlined />} 
                size="small"
                type="link"
                danger
                disabled={record.role === UserRole.SUPER_ADMIN}
              />
            </ResponsiveTooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];
  
  // 待审批用户表格列定义
  const pendingColumns = [
    {
      title: '用户名/公司名',
      dataIndex: 'username',
      key: 'username',
      render: (text: string, record: any) => record.companyName || text,
      responsive: ['xs', 'sm', 'md', 'lg']
    },
    {
      title: '联系电话',
      dataIndex: 'phone',
      key: 'phone',
      responsive: ['md', 'lg']
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: renderRoleTag,
      responsive: ['sm', 'md', 'lg']
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
      render: (_: any, record: any) => (
        <Space size={isMobile ? "middle" : "small"} className="flex flex-row">
          <Button 
            type="primary"
            icon={<CheckCircleOutlined />} 
            onClick={() => showApprovalModal(
              record._id!, 
              record.companyName ? 'agent' : 'user', 
              true
            )} 
            size="small"
          >
            {!isMobile && "批准"}
          </Button>
          
          <Button 
            danger
            icon={<CloseCircleOutlined />} 
            onClick={() => showApprovalModal(
              record._id!, 
              record.companyName ? 'agent' : 'user', 
              false
            )} 
            size="small"
          >
            {!isMobile && "拒绝"}
          </Button>
        </Space>
      )
    }
  ];
  
  // 计算待审批用户数量
  const pendingCount = pendingData?.pendingAccounts?.length || 0;
  
  // 优化表格展示，添加展开功能以在移动端显示更多信息
  const expandedRowRender = (record: User) => {
    if (!isMobile) return null;
    
    return (
      <div className="p-2">
        <p><strong>联系电话:</strong> {record.phone}</p>
        {record.status && <p><strong>状态:</strong> {renderStatusTag(record.status)}</p>}
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
          activeTab === 'all' ? (
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => showModal()}
              size={isMobile ? "small" : undefined}
            >
              {!isMobile && "新增用户"}
            </Button>
          ) : null
        }
      >
        <TabPane tab="所有用户" key="all">
          <Card bodyStyle={{ padding: isMobile ? 8 : 24 }}>
            {usersLoading ? (
              <div className="py-20 flex justify-center">
                <Spin size="large" tip="加载中..." />
              </div>
            ) : (
              <Table
                columns={filterColumnsByDevice(userColumns)}
                dataSource={usersData?.users || []}
                rowKey="_id"
                pagination={{
                  showSizeChanger: !isMobile,
                  showTotal: (total) => `共 ${total} 条记录`,
                  simple: isMobile,
                  defaultPageSize: isMobile ? 10 : 20
                }}
                size={getTableSize()}
                expandable={isMobile ? {
                  expandedRowRender,
                  expandRowByClick: true
                } : undefined}
                scroll={{ x: isTablet ? 600 : undefined }}
              />
            )}
          </Card>
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              待审批用户
              {pendingCount > 0 && (
                <Tag color="red" className="ml-2">{pendingCount}</Tag>
              )}
            </span>
          } 
          key="pending"
        >
          <Card bodyStyle={{ padding: isMobile ? 8 : 24 }}>
            {pendingLoading ? (
              <div className="py-20 flex justify-center">
                <Spin size="large" tip="加载中..." />
              </div>
            ) : pendingCount > 0 ? (
              <Table
                columns={filterColumnsByDevice(pendingColumns)}
                dataSource={pendingData?.pendingAccounts || []}
                rowKey="_id"
                pagination={pendingCount > 10 ? {
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
                暂无待审批用户
              </div>
            )}
          </Card>
        </TabPane>
      </Tabs>
      
      {/* 添加/编辑用户模态框 */}
      <Modal
        title={currentUser ? '编辑用户' : '新增用户'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleSave}>
            保存
          </Button>
        ]}
        width={isMobile ? "95%" : 520}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            role: UserRole.FACTORY_SALES
          }}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="请输入用户名" />
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
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择角色">
              <Option value={UserRole.FACTORY_SALES}>原厂销售</Option>
              <Option value={UserRole.INVENTORY_MANAGER}>库存管理员</Option>
              {user?.role === UserRole.SUPER_ADMIN && (
                <Option value={UserRole.SUPER_ADMIN}>超级管理员</Option>
              )}
            </Select>
          </Form.Item>
          
          {!currentUser && (
            <Form.Item
              name="password"
              label="密码"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码长度不能少于6个字符' }
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
            </Form.Item>
          )}
          
          {currentUser && (
            <Form.Item
              name="password"
              label="密码"
              rules={[
                { min: 6, message: '密码长度不能少于6个字符' }
              ]}
              help="如不修改密码，请留空"
            >
              <Input.Password prefix={<LockOutlined />} placeholder="留空表示不修改密码" />
            </Form.Item>
          )}
        </Form>
      </Modal>
      
      {/* 拒绝理由模态框 */}
      <Modal
        title={
          <span>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
            拒绝申请
          </span>
        }
        open={approvalModalVisible}
        onCancel={() => setApprovalModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setApprovalModalVisible(false)}>
            取消
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            danger
            onClick={() => handleApprove(
              approvalInfo.id, 
              approvalInfo.type, 
              false
            )}
          >
            确认拒绝
          </Button>
        ]}
        width={isMobile ? "95%" : 520}
      >
        <p>请输入拒绝理由（可选）：</p>
        <Input.TextArea 
          rows={4} 
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="请输入拒绝理由，该理由将会通知给申请人"
        />
      </Modal>
      
      <style jsx global>{`
        /* 优化移动端表格样式 */
        @media (max-width: 767px) {
          .ant-table-thead > tr > th {
            padding: 8px 4px !important;
            font-size: 14px !important;
          }
          
          .ant-table-tbody > tr > td {
            padding: 8px 4px !important;
            font-size: 14px !important;
          }
          
          /* 确保按钮内容垂直居中 */
          .ant-btn > .anticon + span, 
          .ant-btn > span + .anticon {
            margin-left: 6px;
            vertical-align: middle;
          }
          
          /* 确保展开行内容清晰可读 */
          .ant-table-expanded-row .p-2 {
            font-size: 14px;
            line-height: 1.8;
          }
          
          /* 强化标签显示 */
          .ant-tag {
            padding: 2px 6px !important;
            font-size: 12px !important;
          }
          
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

export default UserManagement;