import React, { useState, useCallback } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Tag, 
  Input, 
  Select, 
  Modal,
  Form,
  Alert,
  message,
  Typography,
  Tooltip,
  Empty,
  Spin,
  Row,
  Col,
  Popover,
  Collapse
} from 'antd';
import { 
  InfoCircleOutlined, 
  EnvironmentOutlined,
  UserSwitchOutlined,
  TeamOutlined,
  ShopOutlined,
  QuestionCircleOutlined} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { 
  CustomerNature,
  CustomerImportance,
  UserRole,
  UserBrief,
  AgentBrief,
  PublicPoolCustomer,
  AssignableUsers,
  PublicPoolResponse
} from '../shared/types';
import { publicPoolPermissions } from '../shared/auth';
import { api } from '../utils/api';
import { useData, clearCustomerCaches } from '../utils/dataFetcher';
import { useResponsive } from '../hooks/useResponsive';
import CustomerFilters from '../components/customers/CustomerFilters';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;
const { Panel } = Collapse;

const PublicPoolManagement: React.FC = () => {
  const { user } = useAuth();
  const { isMobile, getTableSize } = useResponsive();
  const [keyword, setKeyword] = useState('');
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<PublicPoolCustomer | null>(null);
  const [rulesVisible, setRulesVisible] = useState(false);
  const [selectedSalesId, setSelectedSalesId] = useState<string>(
    user?.role === UserRole.FACTORY_SALES 
      ? user?._id ?? '' 
      : user?.role === UserRole.AGENT 
        ? user?.relatedSalesId ?? '' 
        : ''
  );
  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    user?.role === UserRole.AGENT ? user?._id ?? '' : ''
  );
    const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
  
  const canAssign = user ? publicPoolPermissions.canAssign(user.role as UserRole) : false;
  
  // 构建查询参数，增加所有筛选条件
  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    
    if (keyword && keyword.trim() !== '') {
      params.append('keyword', keyword.trim());
    }
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    
    return params.toString();
  }, [keyword, filters]);
  
  const { data, error, isLoading, mutate: refreshPublicPool } = useData<PublicPoolResponse>(
    `/api/public-pool?${buildQueryParams()}`,
    { forceRefresh: true }
  );
  
  const { data: assignableUsers, isLoading: isAssignableLoading } = useData<AssignableUsers>(
    canAssign? '/api/public-pool/assignable-users' : null
  );
  
  // 搜索处理函数
  const handleSearch = (value: string) => {
    setKeyword(value);
  };
  
  // 筛选条件变化处理函数
  const handleFilterChange = (field: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // 重置所有筛选条件
  const handleResetFilters = () => {
    setKeyword('');
    setFilters({});
  };
  
  const showAssignModal = (customer: PublicPoolCustomer) => {
    setCurrentCustomer(customer);
    setAssignModalVisible(true);
    
    setSelectedSalesId('');
    setSelectedAgentId('');
    
    if (user?.role === UserRole.FACTORY_SALES) {
      setSelectedSalesId(user._id || '');
    } else if (user?.role === UserRole.AGENT) {
      setSelectedSalesId(user.relatedSalesId || '');
      setSelectedAgentId(user._id || '');
    }
  };
  
  const handleAssign = async () => {
    if (!currentCustomer || (!selectedSalesId && !selectedAgentId)) {
      message.error('请至少选择一个分配对象');
      return;
    }
    
    try {    
      await api.post(`/api/change_customers/${currentCustomer?._id}/assign`, {
        salesId: selectedSalesId,
        agentId: selectedAgentId
      });

      message.success(isSuperAdmin ? '客户分配成功' : '客户跟进成功');
      setAssignModalVisible(false);
      
      clearCustomerCaches();
      refreshPublicPool(true); 
    } catch (error) {
      console.error('Operation failed:', error);
      message.error(error.error || (isSuperAdmin ? '分配失败' : '跟进失败'));
    }
  };
  
  const getSalesName = () => {
    if (!selectedSalesId) return '';
    
    if (assignableUsers?.salesUsers) {
      const user = assignableUsers.salesUsers.find((u: UserBrief) => u._id === selectedSalesId);
      return user ? user.username : '';
    }
    
    return '';
  };
  
  const getAgentName = () => {
    if (!selectedAgentId) return '';
    
    if (assignableUsers?.agents) {
      const agent = assignableUsers.agents.find((a: AgentBrief) => a._id === selectedAgentId);
      return agent ? `${agent.companyName} (${agent.contactPerson})` : '';
    }
    
    return '';
  };
  
  // 增强表格列配置，确保显示所有相关字段
  const baseColumns = [
    {
      title: '客户名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Text strong>{text}</Text>
      )
    },
    {
      title: '客户性质',
      dataIndex: 'nature',
      key: 'nature',
      render: (nature: CustomerNature) => {
        const colorMap = {
          [CustomerNature.LISTED]: 'blue',
          [CustomerNature.SME]: 'green',
          [CustomerNature.RESEARCH]: 'purple',
          [CustomerNature.STATE_OWNED]: 'red'
        };
        return <Tag color={colorMap[nature] || 'default'}>{nature}</Tag>;
      }
    },
    {
      title: '重要程度',
      dataIndex: 'importance',
      key: 'importance',
      render: (importance: CustomerImportance) => {
        if (!importance) return <span>-</span>;
        
        const colorMap = {
          [CustomerImportance.A]: 'red',
          [CustomerImportance.B]: 'orange',
          [CustomerImportance.C]: 'blue'
        };
        return <Tag color={colorMap[importance] || 'default'}>{importance}</Tag>;
      }
    },
    {
      title: '应用领域',
      dataIndex: 'applicationField',
      key: 'applicationField',
    },
    {
      title: '产品需求',
      dataIndex: 'productNeeds',
      key: 'productNeeds',
      render: (productNeeds: string[]) => {
        if (!productNeeds || productNeeds.length === 0) return <span>-</span>;
        return <Tag color="blue">{productNeeds.length}个产品</Tag>;
      }
    },
    {
      title: '所在地',
      dataIndex: 'address',
      key: 'address',
      responsive: ['md', 'lg'],
      render: (address: string) => (
        <span>
          <EnvironmentOutlined className="mr-1 text-red-500" />
          {address || '-'}
        </span>
      )
    },
    // {
    //   title: '创建人',
    //   dataIndex: 'creatorName',
    //   key: 'creatorName',
    //   responsive: ['lg'],
    //   render: (creatorName: string, record: PublicPoolCustomer) => (
    //     <span>
    //       <UserOutlined className="mr-1 text-blue-500" />
    //       {creatorName || '未知'} 
    //       {record.creatorType && (
    //         <Tag color="blue" className="ml-1" size="small">
    //           {record.creatorType === 'FACTORY_SALES' ? '销售' : 
    //            record.creatorType === 'AGENT' ? '代理商' : 
    //            record.creatorType === 'SUPER_ADMIN' ? '管理员' : record.creatorType}
    //         </Tag>
    //       )}
    //     </span>
    //   )
    // },
    {
      title: '进入公海时间',
      dataIndex: 'enterPoolTime',
      key: 'enterPoolTime',
      responsive: ['md', 'lg'],
      render: (date: string) => new Date(date).toLocaleDateString(),
      sorter: (a: PublicPoolCustomer, b: PublicPoolCustomer) => 
        new Date(a.enterPoolTime).getTime() - new Date(b.enterPoolTime).getTime()
    }
  ];
  
  const actionColumn = {
    title: '操作',
    key: 'action',
    render: (_: any, record: PublicPoolCustomer) => (
      <Space size="small">
        {canAssign && (
          <Button 
            type="primary"
            size={isMobile ? "small" : "middle"}
            icon={<UserSwitchOutlined />}
            onClick={() => showAssignModal(record)}
            style={{ color: '#ffffff' }}
          >
            {isMobile ? "" : (isSuperAdmin ? '分配' : '跟进')}
          </Button>
        )}
      </Space>
    )
  };
  
  // 根据设备类型选择要显示的列
  const columns = isMobile 
    ? [baseColumns[0], baseColumns[1], baseColumns[2], actionColumn] // 移动端只显示最重要的列
    : [...baseColumns, actionColumn];
  
  const publicPoolRules = (
    <div>
      <p>1. 客户从录入后三个月未进入打样测试阶段，进入公海</p>
      <p>2. 公海客户保留原销售和代理商信息，便于追溯</p>
      <p>3. 公海客户可被管理员分配或销售/代理商跟进</p>
    </div>
  );
  
  const publicCustomers = data?.publicCustomers || [];
  
  // 自定义包装Tooltip的组件，在移动端时不显示Tooltip
  const ResponsiveTooltip = ({ children, title, ...props }: any) => {
    if (isMobile) {
      return children;
    }
    return <Tooltip title={title} {...props}>{children}</Tooltip>;
  };
  
  return (
    <div className="public-pool-page">
      <Card className="mb-4">
        <div className="flex justify-between items-center mb-4 flex-wrap">
          <div className="flex items-center mb-2 md:mb-0">
            <div className="flex items-center">
              <div className="flex items-center">
                <Title level={4} className="m-0 mr-2" style={{ position: 'relative', top: '2px' }}>客户公海池</Title>
                {isMobile ? (
                  <Button 
                    type="text"
                    icon={<QuestionCircleOutlined className="text-blue-500 text-lg" />}
                    style={{ padding: '0 4px', position: 'relative', top: '-2px' }}
                    onClick={() => setRulesVisible(!rulesVisible)}
                  />
                ) : (
                  <Popover 
                    content={publicPoolRules} 
                    title="公海规则" 
                    trigger="click" 
                    placement="bottomLeft"
                  >
                    <QuestionCircleOutlined 
                      className="text-blue-500 cursor-pointer text-lg" 
                      style={{ position: 'relative', top: '-2px' }} 
                    />
                  </Popover>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* 使用统一的客户筛选组件 */}
        <CustomerFilters
          onFilterChange={handleFilterChange}
          onSearch={handleSearch}
          keyword={keyword}
          onReset={handleResetFilters}
          filters={filters}
          isPublicPool={true} // 标记是公海池筛选
        />
        
        {/* 移动端公海规则展示区 */}
        {isMobile && rulesVisible && (
          <div className="mb-4 p-3 bg-blue-50 rounded-md border border-blue-100">
            <div className="flex justify-between items-center mb-2">
              <Text strong className="text-blue-700">公海规则</Text>
              <Button 
                type="text" 
                size="small" 
                onClick={() => setRulesVisible(false)}
                className="text-gray-500"
              >
                收起
              </Button>
            </div>
            {publicPoolRules}
          </div>
        )}
        
        {isLoading ? (
          <div className="flex justify-center items-center p-10">
            <Spin size="large" tip="加载中..." />
          </div>
        ) : error ? (
          <Alert 
            message="加载失败" 
            description={error.message || "获取公海客户失败，请刷新重试"} 
            type="error" 
            showIcon 
          />
        ) : publicCustomers.length === 0 ? (
          <Empty description="暂无公海客户" />
        ) : (
          <Table
            columns={columns}
            dataSource={publicCustomers}
            rowKey="_id"
            pagination={{
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条记录`,
              simple: isMobile
            }}
            scroll={{ x: 'max-content' }}
            size={getTableSize()}
          />
        )}
      </Card>
      
      <Modal
        title={isSuperAdmin ? "分配客户" : "跟进客户"}
        open={assignModalVisible}
        onCancel={() => setAssignModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setAssignModalVisible(false)}>
            取消
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            onClick={handleAssign}
            disabled={!selectedSalesId && !selectedAgentId}
            loading={isAssignableLoading}
            style={{ color: '#ffffff' }}
          >
            {isSuperAdmin ? "确认分配" : "确认跟进"}
          </Button>
        ]}
        width={isMobile ? '100%' : 600}
        style={isMobile ? { top: 20 } : undefined}
      >
        <div className="mb-4">
          <Text strong>您即将{isSuperAdmin ? "分配" : "跟进"}以下客户：</Text>
          <div className="mt-2 p-3 bg-blue-50 rounded">
            <p><Text strong>客户名称：</Text> {currentCustomer?.name}</p>
            <p><Text strong>客户性质：</Text> {currentCustomer?.nature}</p>
            <p><Text strong>应用领域：</Text> {currentCustomer?.applicationField}</p>
            <p><Text strong>所在地：</Text> {currentCustomer?.address}</p>
          </div>
        </div>
        
        <Form layout="vertical">
          <div className="p-3 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg shadow-sm border border-gray-200">
            <div className="text-lg font-medium mb-3 text-gray-700">请选择分配对象：</div>
            
            <Row gutter={isMobile ? 8 : 16} className="mb-2">
              <Col span={isMobile ? 24 : 12} className={isMobile ? "mb-2" : ""}>
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 h-full">
                  <Form.Item 
                    label={
                      <span>
                        <TeamOutlined className="mr-1 text-blue-500" />
                        选择销售人员
                      </span>
                    }
                    style={{ marginBottom: 0 }}
                  >
                    <Select
                      placeholder="请选择销售人员"
                      style={{ width: '100%' }}
                      size={isMobile ? "small" : "middle"}
                      loading={isAssignableLoading}
                      value={selectedSalesId || undefined}
                      onChange={(value) => {
                        setSelectedSalesId(value);
                        if (value && selectedAgentId) {
                          const agent = assignableUsers?.agents?.find(a => a._id === selectedAgentId);
                          if (agent && agent.relatedSalesId !== value) {
                            setSelectedAgentId('');
                          }
                        }
                      }}
                      disabled={user?.role === UserRole.FACTORY_SALES || user?.role === UserRole.AGENT}
                    >
                      {assignableUsers?.salesUsers?.map((user: UserBrief) => (
                        <Option key={user._id} value={user._id}>{user.username}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </div>
              </Col>
              
              <Col span={isMobile ? 24 : 12}>
                <div className="bg-green-50 p-3 rounded-lg border border-green-100 h-full">
                  <Form.Item 
                    label={
                      <span>
                        <ShopOutlined className="mr-1 text-green-500" />
                        选择代理商
                        {selectedSalesId && !isMobile && (
                          <ResponsiveTooltip title="已根据所选销售人员筛选出关联代理商">
                            <InfoCircleOutlined className="ml-1 text-blue-500" />
                          </ResponsiveTooltip>
                        )}
                      </span>
                    }
                    style={{ marginBottom: 0 }}
                  >
                    <Select
                      placeholder="请选择代理商"
                      style={{ width: '100%' }}
                      size={isMobile ? "small" : "middle"}
                      loading={isAssignableLoading}
                      value={selectedAgentId || undefined}
                      onChange={(value) => setSelectedAgentId(value)}
                      disabled={user?.role === UserRole.AGENT}
                    >
                      {assignableUsers?.agents?.filter(agent => {
                        if (selectedSalesId) {
                          return selectedSalesId === agent.relatedSalesId;
                        }
                        return true;
                      }).map((agent: AgentBrief) => (
                        <Option key={agent._id} value={agent._id}>
                          {agent.companyName} ({agent.contactPerson})
                          {agent.relatedSalesName && (
                            <Tag color="blue" size="small" className="ml-1">
                              关联销售: {agent.relatedSalesName}
                            </Tag>
                          )}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </div>
              </Col>
            </Row>
          </div>
          
          {(selectedSalesId || selectedAgentId) && (
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded">
              <Text strong>分配确认：</Text>
              <div className="mt-2">
                {selectedSalesId && (
                  <div className="flex items-center mb-1">
                    <TeamOutlined className="text-blue-500 mr-2" />
                    <Text>
                      将客户 <Text strong>{currentCustomer?.name}</Text> {isSuperAdmin ? "分配给销售：" : "跟进为销售负责："}
                      <Text strong className="text-blue-500">{getSalesName()}</Text>
                    </Text>
                  </div>
                )}
                
                {selectedAgentId && (
                  <div className="flex items-center">
                    <ShopOutlined className="text-green-500 mr-2" />
                    <Text>
                      将客户 <Text strong>{currentCustomer?.name}</Text> {isSuperAdmin ? "分配给代理商：" : "跟进为代理商负责："}
                      <Text strong className="text-green-500">{getAgentName()}</Text>
                    </Text>
                  </div>
                )}
              </div>
            </div>
          )}
        </Form>
        
        <div className="mt-4">
          <Collapse ghost>
            <Panel header="分配/跟进说明" key="1">
              <ul className="pl-4 m-0">
                <li>分配/跟进后，客户将从公海中移除并归入负责人客户库</li>
                <li>系统将记录此次操作信息，包括操作人和时间</li>
                <li>此操作不可撤销，请确认后操作</li>
                {selectedSalesId && !isMobile && (
                  <li><Text type="warning">注意</Text>：选择销售后，代理商列表仅显示与该销售关联的代理商</li>
                )}
              </ul>
            </Panel>
          </Collapse>
        </div>
      </Modal>
      
      <style jsx global>{`
        .public-pool-page .ant-table-cell {
          padding: ${isMobile ? '8px 4px' : '16px 8px'};
          white-space: nowrap;
        }
        
        @media (max-width: 767px) {
          .public-pool-page .ant-table {
            font-size: 14px;
          }
          
          .public-pool-page .ant-table-thead > tr > th,
          .public-pool-page .ant-table-tbody > tr > td {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          .public-pool-page .ant-pagination-simple {
            margin-top: 12px;
          }
          
          .public-pool-page .ant-table-content {
            overflow-x: auto;
          }
          
          .public-pool-page .ant-table-thead > tr > th,
          .public-pool-page .ant-table-tbody > tr > td {
            min-width: 100px;
          }
          
          .public-pool-page .ant-table-tbody > tr > td:last-child {
            min-width: 60px;
          }
        }
        
        .public-pool-page .ant-collapse-header {
          padding: 8px 0;
        }
        
        .public-pool-page .ant-collapse-content-box {
          padding: 0 0 8px 0;
        }
        
        /* 确保确认按钮文字为白色 */
        .public-pool-page .ant-btn-primary {
          color: #ffffff;
        }
      `}</style>
    </div>
  );
};

export default PublicPoolManagement;