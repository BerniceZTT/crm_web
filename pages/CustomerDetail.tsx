import React, { useState, useEffect, useMemo } from 'react';
import { 
  Card, 
  Descriptions, 
  Button, 
  Tabs, 
  Tag, 
  Form, 
  Input, 
  Select, 
  Modal, 
  message, 
  Timeline,
  Divider,
  Statistic,
  Row,
  Col,
  Typography,
  Spin,
  Empty
} from 'antd';
import { 
  ArrowLeftOutlined, 
  FileTextOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
  ImportOutlined,
  ExportOutlined,
  HistoryOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Customer, 
  CustomerNature, 
  CustomerImportance, 
  CustomerProgress,
  UserRole,
  FollowUpRecord,
  CustomerAssignmentHistory,
  CustomerProgressHistory, 
  Product
} from '../shared/types';
import { useAuth } from '../contexts/AuthContext';
import { useData, mutateData } from '../utils/dataFetcher';
import { api } from '../utils/api';
import { useResponsive } from '../hooks/useResponsive';

const { Title, Text } = Typography;
const { TextArea } = Input;

const CustomerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [followUpForm] = Form.useForm();
  
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpModalVisible, setFollowUpModalVisible] = useState(false);
  
  const { 
    isMobile, 
    getDescriptionsSize,
    getDescriptionsLayout,
    getMobileDescriptionsLabelStyle,
    getMobileDescriptionsContentStyle 
  } = useResponsive();
  
  const { 
    data: customerData, 
    isLoading: customerLoading, 
    error: customerError,
    mutate: mutateCustomer
  } = useData<{ customer: Customer }>(id ? `/api/customers/${id}` : null);
  
  const customer = customerData?.customer;
  
  const { 
    data: productsData } = useData<{ products: Product[] }>('/api/products');
  const products = productsData?.products || [];
  
  const productMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    products.forEach(product => {
      if (product._id) {
        map[product._id] = `${product.modelName} - ${product.packageType}`;
      }
    });
    return map;
  }, [products]);
  
  const getProductName = (productId: string) => {
    return productMap[productId] || productId;
  };
  
  const {
    data: followUpData,
    isLoading: followUpRecordsLoading,
    error: followUpRecordsError,
    mutate: mutateFollowUpRecords
  } = useData<{ records: FollowUpRecord[] }>(id ? `/api/followUpRecords/${id}` : null);
  
  const followUpRecords = followUpData?.records || [];

  const {
    data: historyData,
    isLoading: historyLoading,
    error: historyError
  } = useData<{ history: CustomerAssignmentHistory[] }>(id ? `/api/customer-progress/${id}` : null);

  console.log('historyData',historyData)
  const assignmentHistory = historyData?.history || [];
  
  const {
    data: progressHistoryData,
    isLoading: progressHistoryLoading,
    error: progressHistoryError
  } = useData<CustomerProgressHistory[]>(id ? `/api/customer-progress/${id}` : null);
  
  const progressHistory = progressHistoryData || [];
  
  const publicPoolHistory = useMemo(() => {
    return assignmentHistory.filter(history => 
      history.operationType === 'publicPool' || 
      history.operationType === 'assign' ||
      history.operationType === '认领'
    );
  }, [assignmentHistory]);
  
  const handleAddFollowUp = async () => {
    try {
      const values = await followUpForm.validateFields();
      setFollowUpLoading(true);
      
      await api.post('/api/followUpRecords', {
        customerId: id,
        title: values.title,
        content: values.content
      }, { showSuccessMessage: true });
      
      mutateFollowUpRecords();
      
      setFollowUpModalVisible(false);
      followUpForm.resetFields();
    } catch (error) {
      console.error('Add follow-up failed:', error);
      message.error('添加跟进记录失败');
    } finally {
      setFollowUpLoading(false);
    }
  };
  
  const handleDeleteFollowUp = async (recordId: string) => {
    try {
      await api.delete(`/api/followUpRecords/${recordId}`, {
        showSuccessMessage: true
      });
      
      mutateFollowUpRecords();
    } catch (error) {
      console.error('Delete follow-up failed:', error);
      message.error('删除跟进记录失败');
    }
  };
  
  const showFollowUpModal = () => {
    followUpForm.resetFields();
    setFollowUpModalVisible(true);
  };
  
  const goBack = () => {
    navigate('/customers');
  };
  
  if (customerLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }
  
  if (customerError || !customer) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <div className="text-red-500 mb-4">加载失败: {customerError?.message || '未找到客户信息'}</div>
        <Button onClick={goBack}>返回客户列表</Button>
      </div>
    );
  }
  
  const getProgressColor = (progress: CustomerProgress) => {
    const colorMap = {
      [CustomerProgress.SAMPLE_EVALUATION]: 'purple',
      [CustomerProgress.TESTING]: 'blue',
      [CustomerProgress.SMALL_BATCH]: 'cyan',
      [CustomerProgress.MASS_PRODUCTION]: 'green',
      [CustomerProgress.PUBLIC_POOL]: 'red'
    };
    return colorMap[progress] || 'default';
  };
  
  const getImportanceColor = (importance: CustomerImportance) => {
    const colorMap = {
      [CustomerImportance.A]: 'red',
      [CustomerImportance.B]: 'orange',
      [CustomerImportance.C]: 'green'
    };
    return colorMap[importance] || 'default';
  };

  const getOperationColor = (operationType: string) => {
    const colorMap: Record<string, string> = {
      '分配': 'green',
      '认领': 'blue',
      '移入公海池': 'red',
      '新建分配': 'orange',
      '新建认领': 'purple',
      'publicPool': 'red',
      'assign': 'green',
      'cancel': 'orange'
    };
    return colorMap[operationType] || 'blue';
  };

  const formatOperationType = (history: CustomerAssignmentHistory) => {
    if (['分配', '认领', '移入公海池', '新建分配', '新建认领'].includes(history.operationType)) {
      return history.operationType;
    }
    
    if (history.operationType === 'publicPool') {
      return '移入公海池';
    } else if (history.operationType === 'assign') {
      if (!history.fromRelatedSalesId || history.fromRelatedSalesId === null) {
        return '认领';
      } else {
        return '分配';
      }
    } else if (history.operationType === 'cancel') {
      return '取消分配';
    }
    return '未知操作';
  };

  const formatOperationContent = (history: CustomerAssignmentHistory) => {
    if (['分配', '认领', '移入公海池', '新建分配', '新建认领'].includes(history.operationType)) {
      if (history.operationType === '移入公海池') {
        const fromName = history.fromRelatedSalesName;
        if(history.fromRelatedAgentName){
          return `客户从「${fromName}(销售)」「${history.fromRelatedAgentName}(代理商)」移入公海`;
        }
        return `客户从「${fromName}(销售)」移入公海`;
      } else if (history.operationType === '认领') {
        const toName = history.toRelatedSalesName;
        if(history.toRelatedAgentName){
          return`从公海认领到「${toName}(销售)」「${history.toRelatedAgentName}(代理商)」`;
        }
        return `从公海认领到「${toName}(销售)」`;
      } else if (history.operationType === '新建认领') {
        const toName = history.toRelatedSalesName;
        if(history.toRelatedAgentName){
          return `新建客户并认领给「${toName}(销售)」「${history.toRelatedAgentName}(代理商)」`;
        }
        return `新建客户并认领给「${toName}(销售)」`;
      } else if (history.operationType === '新建分配') {
        const toName = history.toRelatedSalesName;
        if (history.toRelatedAgentName) {
          return `新建客户并分配给「${toName}(销售)」「${history.toRelatedAgentName}(代理商)」`;
        } else {
          return `新建客户并分配给「${toName}(销售)」`;
        }
      } else { // 分配
        const fromName = history.fromRelatedSalesName || '未知';
        const toName = history.toRelatedSalesName || '未知';
        
        if (history.fromRelatedAgentName && history.toRelatedAgentName && 
            history.fromRelatedAgentName !== history.toRelatedAgentName) {
          return `客户从 「${fromName}(销售)」「${history.fromRelatedAgentName}(代理商)」分配给「${toName}(销售)」「${history.toRelatedAgentName}(代理商)」`;
        } else if (history.fromRelatedAgentName && !history.toRelatedAgentName) {
          return `客户从「${fromName}(销售)」「${history.fromRelatedAgentName}(代理商)」分配给「${toName}(销售)」(无代理商)`;
        } else if (!history.fromRelatedAgentName && history.toRelatedAgentName) {
          return `客户从「${fromName}(销售)」(无代理商)分配给「${toName}(销售)」「${history.toRelatedAgentName}(代理商)」`;
        } else {
          return `客户从「${fromName}(销售)」分配给「${toName}(销售)」`;
        }
      }
    }
  
    return '操作详情未知';
  };
  
  // 添加日期格式化工具函数
  const formatDateTime = (dateString: string | undefined) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };
  
  return (
    <div className="customer-detail">
      <div className={`${isMobile ? 'flex flex-col' : 'flex justify-between items-center'} ${isMobile ? 'mb-3' : 'mb-6'}`}>
        <div className={`flex ${isMobile ? 'flex-col items-start' : 'items-center'}`}>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={goBack}
            className={`${isMobile ? 'mb-1' : 'mr-3'}`}
            size={isMobile ? "middle" : "middle"}
          >
            返回
          </Button>
          <div className={`${isMobile ? 'mb-1' : ''} flex flex-wrap items-center`}>
            <Title level={isMobile ? 5 : 4} className={`m-0 mr-2 ${isMobile ? 'mb-1' : ''}`} style={{ 
              wordBreak: 'break-word',
              maxWidth: isMobile ? '100%' : '500px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {customer.name}
            </Title>
            <div className="flex flex-wrap">
              <Tag 
                color={getProgressColor(customer.progress)} 
                className="mr-1 mb-1"
                style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {customer.progress}
              </Tag>
              <Tag 
                color={getImportanceColor(customer.importance)}
                className="mb-1"
                style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {customer.importance}
              </Tag>
            </div>
          </div>
        </div>
      </div>
      
      <Row gutter={[16, isMobile ? 8 : 16]}>
        <Col xs={24} md={16}>
          <Card 
            className={isMobile ? "mb-2" : "mb-4"}
            size={isMobile ? "small" : "default"}
            bodyStyle={isMobile ? { padding: '8px 6px' } : {}}
          >
            <Descriptions 
              title="基本信息" 
              bordered 
              column={{ xxl: 2, xl: 2, lg: 2, md: 2, sm: 1, xs: 1 }}
              size={getDescriptionsSize()}
              layout={getDescriptionsLayout()}
              labelStyle={getMobileDescriptionsLabelStyle()}
              contentStyle={getMobileDescriptionsContentStyle()}
              className={isMobile ? 'compact-descriptions' : ''}
            >
              <Descriptions.Item label="客户名称">{customer.name}</Descriptions.Item>
              <Descriptions.Item label="客户性质">{customer.nature}</Descriptions.Item>
              <Descriptions.Item label="重要程度">{customer.importance}</Descriptions.Item>
              <Descriptions.Item label="客户进展">{customer.progress}</Descriptions.Item>
              <Descriptions.Item label="联系人">{customer.contactPerson}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{customer.contactPhone}</Descriptions.Item>
              <Descriptions.Item label="年需求量">{customer.annualDemand} 片</Descriptions.Item>
              <Descriptions.Item label="应用领域">{customer.applicationField}</Descriptions.Item>
              <Descriptions.Item label="公司地址" span={isMobile ? 1 : 2}>{customer.address}</Descriptions.Item>
              <Descriptions.Item label="产品需求" span={isMobile ? 1 : 2}>
                <div className="flex flex-wrap">
                  {customer.productNeeds.map((productId, index) => (
                    <Tag key={index} className="mr-1 mb-1">{getProductName(productId)}</Tag>
                  ))}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="创建人">
                {customer.ownerName}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
          
          <Card
            size={isMobile ? "small" : "default"}
            bodyStyle={isMobile ? { padding: '12px 8px' } : {}}
          >
            <Tabs 
              defaultActiveKey="progressHistory" 
              type={isMobile ? "card" : "line"}
              size={isMobile ? "small" : "large"}
              items={[
                {
                  key: 'progressHistory',
                  label: <span><HistoryOutlined />进展历史</span>,
                  children: (
                    <>
                      {progressHistoryLoading ? (
                        <div className="flex justify-center my-8">
                          <Spin tip="加载中..." />
                        </div>
                      ) : progressHistory.length === 0 ? (
                        <Empty description="暂无进展历史记录" />
                      ) : (
                        <Timeline>
                          {progressHistory.map((record, index) => (
                            <Timeline.Item 
                              key={record._id || index} 
                              color={record.toProgress === CustomerProgress.MASS_PRODUCTION ? "green" : 
                                     record.toProgress === CustomerProgress.PUBLIC_POOL ? "red" : "blue"}
                            >
                              <div className="mb-2">
                                <Text strong style={{ fontSize: isMobile ? '14px' : '16px' }}>
                                  进展变更
                                </Text>
                                <Text 
                                  type="secondary" 
                                  className="ml-3" 
                                  style={{ fontSize: isMobile ? '12px' : '14px' }}
                                >
                                  {record.createdAt ? new Date(record.createdAt).toLocaleDateString() + ' ' + 
                                    new Date(record.createdAt).toLocaleTimeString() : '-'}
                                </Text>
                              </div>
                              <div className="mb-2" style={{ fontSize: isMobile ? '13px' : '14px' }}>
                                客户进展从「
                                <Tag color={getProgressColor(record.fromProgress as CustomerProgress)}>
                                  {record.fromProgress}
                                </Tag>
                                」变更为「
                                <Tag color={getProgressColor(record.toProgress as CustomerProgress)}>
                                  {record.toProgress}
                                </Tag>
                                」
                              </div>
                              {record.remark && (
                                <div className="mt-1 bg-gray-50 p-3 rounded" style={{ fontSize: isMobile ? '13px' : '14px' }}>
                                  备注: {record.remark}
                                </div>
                              )}
                              <div className="text-gray-500" style={{ fontSize: isMobile ? '12px' : '13px' }}>
                                操作人: {record.operatorName}
                              </div>
                            </Timeline.Item>
                          ))}
                        </Timeline>
                      )}
                    </>
                  )
                },
                {
                  key: 'opportunities',
                  label: <span><TeamOutlined />操作记录</span>,
                  children: (
                    <>
                      {historyLoading ? (
                        <div className="flex justify-center my-8">
                          <Spin tip="加载中..." />
                        </div>
                      ) : assignmentHistory.length === 0 ? (
                        <Empty description="暂无操作记录" />
                      ) : (
                        <Timeline>
                          {assignmentHistory.map((history, index) => (
                            <Timeline.Item 
                              key={history._id || index} 
                              color={getOperationColor(history.operationType)}
                            >
                              <div className="mb-2">
                                <Text strong style={{ fontSize: isMobile ? '14px' : '16px' }}>
                                  {formatOperationType(history)}
                                </Text>
                                <Text 
                                  type="secondary" 
                                  className="ml-3" 
                                  style={{ fontSize: isMobile ? '12px' : '14px' }}
                                >
                                  {history.createdAt ? new Date(history.createdAt).toLocaleDateString() + ' ' + 
                                    new Date(history.createdAt).toLocaleTimeString() : '-'}
                                </Text>
                              </div>
                              <div className="mb-2" style={{ fontSize: isMobile ? '13px' : '14px' }}>
                                {formatOperationContent(history)}
                              </div>
                              <div className="text-gray-500" style={{ fontSize: isMobile ? '12px' : '13px' }}>
                                操作人: {history.operatorName} 
                              </div>
                            </Timeline.Item>
                          ))}
                        </Timeline>
                      )}
                    </>
                  )
                },
                {
                  key: 'followUp',
                  label: <span><FileTextOutlined />跟进记录</span>,
                  children: (
                    <>
                      <div className="mb-4">
                        <Button 
                          type="primary" 
                          icon={<PlusOutlined />}
                          onClick={showFollowUpModal}
                          size={isMobile ? "middle" : "middle"}
                        >
                          添加跟进记录
                        </Button>
                      </div>
                      
                      {followUpRecordsLoading ? (
                        <div className="flex justify-center my-8">
                          <Spin tip="加载中..." />
                        </div>
                      ) : followUpRecords.length === 0 ? (
                        <Empty description="暂无跟进记录" />
                      ) : (
                        <Timeline>
                          {followUpRecords.map((record) => (
                            <Timeline.Item key={record._id}>
                              <div className={`${isMobile ? 'flex flex-col' : 'flex justify-between items-start'} mb-2`}>
                                <div className={isMobile ? 'mb-1' : ''}>
                                  <Text strong style={{ fontSize: isMobile ? '14px' : '16px' }}>{record.title}</Text>
                                  <Text 
                                    type="secondary" 
                                    className={isMobile ? 'ml-2' : 'ml-3'} 
                                    style={{ fontSize: isMobile ? '12px' : '14px' }}
                                  >
                                    {record.createdAt ? new Date(record.createdAt).toLocaleDateString() : '-'}
                                  </Text>
                                </div>
                                <div className="flex items-center">
                                  <Text 
                                    className="mr-3" 
                                    style={{ fontSize: isMobile ? '12px' : '14px' }}
                                  >
                                    由 {record.creatorName} 创建
                                  </Text>
                                  <Button 
                                    type="text" 
                                    size="small" 
                                    danger
                                    icon={<DeleteOutlined />} 
                                    onClick={() => handleDeleteFollowUp(record._id!)}
                                    className="flex items-center"
                                  />
                                </div>
                              </div>
                              <div className="mt-1 bg-gray-50 p-3 rounded" style={{ fontSize: isMobile ? '13px' : '14px' }}>
                                {record.content}
                              </div>
                            </Timeline.Item>
                          ))}
                        </Timeline>
                      )}
                    </>
                  )
                }
              ]}
            />
          </Card>
        </Col>
        
        <Col xs={24} md={8}>
          <Card 
            className="mb-4"
            size={isMobile ? "small" : "default"}
            bodyStyle={isMobile ? { padding: '12px 8px' } : {}}
          >
            <div className="flex items-center mb-4">
              <UserOutlined className="text-xl mr-2 text-blue-500" />
              <div>
                <div className="text-gray-500 text-sm">联系人</div>
                <div className="font-medium">{customer.contactPerson}</div>
              </div>
            </div>
            
            <div className="flex items-center mb-4">
              <PhoneOutlined className="text-xl mr-2 text-green-500" />
              <div>
                <div className="text-gray-500 text-sm">联系电话</div>
                <div className="font-medium">{customer.contactPhone}</div>
              </div>
            </div>
            
            <div className="flex items-start">
              <EnvironmentOutlined className="text-xl mr-2 text-red-500 mt-1" />
              <div>
                <div className="text-gray-500 text-sm">公司地址</div>
                <div className="font-medium">{customer.address}</div>
              </div>
            </div>
          </Card>
          
          <Card 
            title="客户时间线"
            size={isMobile ? "small" : "default"}
            bodyStyle={isMobile ? { padding: '12px 8px' } : {}}
          >
            <Timeline>
              <Timeline.Item color="green">
                <p>客户创建</p>
                <p className="text-gray-500 text-sm">
                  {customer.createdAt ? formatDateTime(customer.createdAt) : '-'}
                </p>
              </Timeline.Item>
              
              {publicPoolHistory.length > 0 && (publicPoolHistory[0].operationType === 'assign' || publicPoolHistory[0].operationType === '认领') && (
                <Timeline.Item color="blue">
                  <p>最近认领</p>
                  <p className="text-gray-500 text-sm">
                    {publicPoolHistory[0].createdAt ? formatDateTime(publicPoolHistory[0].createdAt) : '-'}
                  </p>
                  <p className="text-gray-500 text-sm">
                    由 {publicPoolHistory[0].operatorName} 认领
                  </p>
                </Timeline.Item>
              )}
              
              {progressHistory.length > 0 && (
                <Timeline.Item color="orange">
                  <p>最近进展变更</p>
                  <p className="text-gray-500 text-sm">
                    从 {progressHistory[0].fromProgress} 变更为 {progressHistory[0].toProgress}
                  </p>
                  <p className="text-gray-500 text-sm">
                    {progressHistory[0].createdAt ? formatDateTime(progressHistory[0].createdAt) : '-'}
                  </p>
                </Timeline.Item>
              )}
              
              {followUpRecords.length > 0 && (
                <Timeline.Item color="blue">
                  <p>最近跟进：{followUpRecords[0].title}</p>
                  <p className="text-gray-500 text-sm">
                    {followUpRecords[0].createdAt ? formatDateTime(followUpRecords[0].createdAt) : '-'}
                  </p>
                </Timeline.Item>
              )}
              
              <Timeline.Item>
                <p>最近更新</p>
                <p className="text-gray-500 text-sm">
                  {customer.updatedAt ? formatDateTime(customer.updatedAt) : '-'}
                </p>
              </Timeline.Item>
            </Timeline>
          </Card>
        </Col>
      </Row>
      
      <Modal
        title="添加跟进记录"
        open={followUpModalVisible}
        onCancel={() => setFollowUpModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setFollowUpModalVisible(false)}>取消</Button>,
          <Button key="submit" type="primary" onClick={handleAddFollowUp} loading={followUpLoading}>保存</Button>
        ]}
        width={isMobile ? '95%' : 600}
        destroyOnClose
      >
        <Form
          form={followUpForm}
          layout="vertical"
        >
          <Form.Item
            name="title"
            label="记录标题"
            rules={[{ required: true, message: '请输入记录标题' }]}
          >
            <Input placeholder="请输入记录标题，例如：电话沟通、现场拜访" />
          </Form.Item>
          
          <Form.Item
            name="content"
            label="跟进内容"
            rules={[{ required: true, message: '请输入跟进内容' }]}
          >
            <TextArea 
              rows={4} 
              placeholder="请详细描述本次跟进的详情，例如：沟通内容、客户反馈、后续计划等" 
            />
          </Form.Item>
          
          <div className="bg-blue-50 p-3 rounded text-sm">
            <p>提示：添加详细的跟进记录有助于团队了解客户状态，提高销售转化率。</p>
          </div>
        </Form>
      </Modal>
      
      <style jsx global>{`
        @media (max-width: 768px) {
          .customer-detail .ant-descriptions-item {
            padding: 4px 8px !important;
          }
          
          .customer-detail .ant-card-head {
            padding: 0 8px !important;
            min-height: 36px !important; /* 减小高度 */
          }
          
          .customer-detail .ant-card-head-title {
            padding: 6px 0 !important; /* 减小内边距 */
          }
          
          .customer-detail .ant-card-body {
            padding: 8px 6px !important;
          }
          
          .customer-detail .ant-descriptions-header {
            margin-bottom: 4px !important; /* 减小底部间距 */
            padding: 6px !important; /* 减小内边距 */
          }
          
          /* 确保标签文本在移动端不换行，内容区域会自动换行 */
          .customer-detail .compact-descriptions .ant-descriptions-item-label {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          .customer-detail .compact-descriptions .ant-descriptions-item-content {
            word-break: break-word;
          }
          
          /* 减小标签间距 */
          .customer-detail .ant-tag {
            margin-right: 4px !important;
            margin-bottom: 4px !important;
            padding: 0 4px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default CustomerDetail;