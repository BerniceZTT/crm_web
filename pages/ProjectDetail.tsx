/**
 * 项目详情页面
 * 展示项目的所有详细信息，包括基本信息、小批量信息、批量出货信息等
 */
import React, { useEffect, useState } from 'react';
import { 
  Card, 
  Typography, 
  Row, 
  Col, 
  Tag, 
  Button, 
  Breadcrumb,
  Descriptions,
  List,
  Space,
  Spin,
  message,
  Tooltip,
  Empty,
  Result,
  Tabs,
  Form,
  Input,
  Modal,
  Timeline
} from 'antd';
import { 
  ArrowLeftOutlined, 
  DownloadOutlined,
  ProjectOutlined,
  PlusOutlined,
  DeleteOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { Project, ProjectProgress, UserRole, ProjectFollowUpRecord, ProjectProgressHistory } from '../shared/types';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useResponsive } from '../hooks/useResponsive';

const { TextArea } = Input;
const { Title, Text } = Typography;

const ProjectDetail: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 新增跟进记录相关状态
  const [followUpForm] = Form.useForm();
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpModalVisible, setFollowUpModalVisible] = useState(false);
  const [followUpRecords, setFollowUpRecords] = useState<ProjectFollowUpRecord[]>([]);
  const [followUpRecordsLoading, setFollowUpRecordsLoading] = useState(false);

  // 新增：项目进展历史相关状态
  const [progressHistory, setProgressHistory] = useState<ProjectProgressHistory[]>([]);
  const [progressHistoryLoading, setProgressHistoryLoading] = useState(false);

  // 获取项目详情
  useEffect(() => {
    const fetchProjectDetail = async () => {
      if (!projectId) {
        setError('项目ID不存在');
        setLoading(false);
        return;
      }
      
      console.log('正在获取项目详情，ID:', projectId);
      
      try {
        setLoading(true);
        setError(null);
        
        const response = await api.get(`/api/projects/${projectId}`);
        console.log('项目详情API响应:', response);
        
        if (response.project) {
          setProject(response.project);
        } else {
          setError('项目不存在或已被删除');
        }
      } catch (error: any) {
        console.error('获取项目详情失败:', error);
        
        // 更详细的错误处理
        if (error.response?.status === 404) {
          setError('项目不存在或已被删除');
        } else if (error.response?.status === 403) {
          setError('没有权限查看此项目');
        } else if (error.response?.status >= 500) {
          setError('服务器错误，请稍后重试');
          // // 服务端错误上报
          // if (process.env.NODE_ENV === 'development' && typeof aipaDevRuntime !== 'undefined') {
          //   aipaDevRuntime.reportApiError({
          //     url: `/api/projects/${projectId}`,
          //     method: 'GET',
          //     body: null,
          //   }, error.message || '获取项目详情失败');
          // }
        } else {
          setError('网络错误，请检查网络连接');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProjectDetail();
  }, [projectId]);

  // 新增：获取项目跟进记录
  const fetchProjectFollowUpRecords = async () => {
    if (!projectId) return;
    
    try {
      setFollowUpRecordsLoading(true);
      const response = await api.get(`/api/projectFollowUpRecords/${projectId}`);
      console.log('项目跟进记录API响应:', response);
      
      if (response.records) {
        setFollowUpRecords(response.records);
      }
    } catch (error: any) {
      console.error('获取项目跟进记录失败:', error);
      message.error('获取跟进记录失败');
    } finally {
      setFollowUpRecordsLoading(false);
    }
  };

  // 当项目加载成功后，获取跟进记录
  useEffect(() => {
    if (project && projectId) {
      fetchProjectFollowUpRecords();
    }
  }, [project, projectId]);

  // 新增：获取项目进展历史
  const fetchProjectProgressHistory = async () => {
    if (!projectId) return;
    
    try {
      setProgressHistoryLoading(true);
      const response = await api.get(`/api/project-progress/${projectId}`);
      console.log('项目进展历史API响应:', response);
      
      if (Array.isArray(response)) {
        setProgressHistory(response);
      } else {
        setProgressHistory([]);
      }
    } catch (error: any) {
      console.error('获取项目进展历史失败:', error);
      message.error('获取进展历史失败');
      setProgressHistory([]);
    } finally {
      setProgressHistoryLoading(false);
    }
  };

  // 当项目加载成功后，获取进展历史
  useEffect(() => {
    if (project && projectId) {
      fetchProjectProgressHistory();
    }
  }, [project, projectId]);

  // 新增：添加跟进记录
  const handleAddFollowUp = async () => {
    try {
      const values = await followUpForm.validateFields();
      setFollowUpLoading(true);
      
      await api.post('/api/projectFollowUpRecords', {
        projectId: projectId,
        title: values.title,
        content: values.content
      }, { showSuccessMessage: true });
      
      fetchProjectFollowUpRecords();
      
      setFollowUpModalVisible(false);
      followUpForm.resetFields();
    } catch (error) {
      console.error('添加跟进记录失败:', error);
      message.error('添加跟进记录失败');
    } finally {
      setFollowUpLoading(false);
    }
  };

  // 新增：删除跟进记录
  const handleDeleteFollowUp = async (recordId: string) => {
    try {
      await api.delete(`/api/projectFollowUpRecords/${recordId}`, {
        showSuccessMessage: true
      });
      
      fetchProjectFollowUpRecords();
    } catch (error) {
      console.error('删除跟进记录失败:', error);
      message.error('删除跟进记录失败');
    }
  };

  // 新增：显示跟进记录弹窗
  const showFollowUpModal = () => {
    followUpForm.resetFields();
    setFollowUpModalVisible(true);
  };

  // 新增：渲染项目进展历史时间轴
  const renderProgressTimeline = (data: ProjectProgressHistory[]) => {
    if (!data || data.length === 0) {
      return <Empty description="暂无进展历史" />;
    }

    return (
      <Timeline mode="left">
        {data.map((item, index) => (
          <Timeline.Item 
            key={index}
            color="blue"
          >
            <div className={`${isMobile ? 'text-sm' : 'text-base'}`}>
              <div className="font-medium mb-1">
                <span className="text-gray-600">
                  {new Date(item.createdAt!).toLocaleString()}
                </span>
              </div>
              <div className="text-gray-700 mb-1">
                从 <Tag color="orange">{item.fromProgress}</Tag> 
                <span className="mx-1">→</span>
                <Tag color="green">{item.toProgress}</Tag>
              </div>
              {item.remark && (
                <div className="text-gray-600 text-sm mb-1">
                  备注：{item.remark}
                </div>
              )}
              <div className="text-xs text-gray-500">
                操作人：{item.operatorName}
              </div>
            </div>
          </Timeline.Item>
        ))}
      </Timeline>
    );
  };

  // 获取进展状态的颜色
  const getProgressColor = (progress: ProjectProgress) => {
    const colorMap = {
      [ProjectProgress.SAMPLE_EVALUATION]: 'purple',
      [ProjectProgress.TESTING]: 'blue',
      [ProjectProgress.SMALL_BATCH]: 'cyan',
      [ProjectProgress.MASS_PRODUCTION]: 'green',
      [ProjectProgress.ABANDONED]: 'red'
    };
    return colorMap[progress] || 'default';
  };

  // 格式化金额显示
  const formatAmount = (amount?: number) => {
    if (!amount || amount === 0) return '-';
    
    if (amount < 0.000001) {
      return amount.toExponential(2);
    }
    
    const formatted = amount.toString();
    if (formatted.includes('.')) {
      const parts = formatted.split('.');
      const decimal = parts[1].replace(/0+$/, '');
      if (decimal.length === 0) {
        return parts[0];
      }
      const limitedDecimal = decimal.length > 6 ? decimal.substring(0, 6) : decimal;
      return `${parts[0]}.${limitedDecimal}`;
    }
    
    return formatted;
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 获取文件图标
  const getFileIcon = (fileType: string) => {
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('doc')) return '📝';
    if (fileType.includes('excel') || fileType.includes('sheet')) return '📊';
    return '📎';
  };

  // 下载文件
  const handleFileDownload = async (file: any) => {
    if (!project) return;
    
    try {
      const response = await fetch(`${process.env.AIPA_API_DOMAIN}/api/projects/download/${project._id}/${file.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '下载失败');
      }
      
      const result = await response.json();
      
      if (result.success && result.file) {
        const link = document.createElement('a');
        link.href = result.file.url;
        link.download = result.file.originalName;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success(`开始下载 ${result.file.originalName}`);
      } else {
        throw new Error('文件信息获取失败');
      }
    } catch (error) {
      console.error('下载文件失败:', error);
      message.error(`下载失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 检查用户权限
  const canEdit = () => {
    if (!user) return false;
    return user.role === UserRole.SUPER_ADMIN || 
           user.role === UserRole.FACTORY_SALES || 
           user.role === UserRole.AGENT;
  };

  // 处理返回
  const handleGoBack = () => {
    navigate(-1);
  };

  // 处理重试
  const handleRetry = () => {
    if (projectId) {
      setLoading(true);
      setError(null);
      // 重新触发数据获取
      const fetchProjectDetail = async () => {
        try {
          const response = await api.get(`/api/projects/${projectId}`);
          if (response.project) {
            setProject(response.project);
          } else {
            setError('项目不存在或已被删除');
          }
        } catch (error: any) {
          console.error('重试获取项目详情失败:', error);
          setError('获取项目详情失败，请稍后重试');
        } finally {
          setLoading(false);
        }
      };
      fetchProjectDetail();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" tip="正在加载项目详情..." />
      </div>
    );
  }

  if (error) {
    return (
      <Result
        status="404"
        title="项目详情加载失败"
        subTitle={error}
        extra={[
          <Button type="primary" onClick={handleRetry} key="retry">
            重试
          </Button>,
          <Button onClick={handleGoBack} key="back">
            返回
          </Button>
        ]}
      />
    );
  }

  if (!project) {
    return (
      <Result
        status="404"
        title="项目不存在"
        subTitle="请检查项目ID是否正确"
        extra={
          <Button type="primary" onClick={handleGoBack}>
            返回
          </Button>
        }
      />
    );
  }

  // Tab配置
  const tabItems = [
    {
      key: '1',
      label: (
        <span>
          <ProjectOutlined />
          项目信息
        </span>
      ),
      children: (
        <div>
          {/* 基本信息 */}
          <Card title="基本信息" className="mb-4">
            <Descriptions column={isMobile ? 1 : 2} size={isMobile ? 'small' : 'middle'}>
              <Descriptions.Item label="项目名称">{project.projectName}</Descriptions.Item>
              <Descriptions.Item label="客户名称">{project.customerName}</Descriptions.Item>
              <Descriptions.Item label="产品型号">{project.productName}</Descriptions.Item>
              <Descriptions.Item label="产品批次号">{project.batchNumber}</Descriptions.Item>
              <Descriptions.Item 
                label={
                  <Space>
                    <CalendarOutlined />
                    项目开始时间
                  </Space>
                }
              >
                <Space>
                  <Tag color="blue" icon={<CalendarOutlined />}>
                    {project.startDate ? new Date(project.startDate).toLocaleString() : '-'}
                  </Tag>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="项目进展">
                <Tag color={getProgressColor(project.projectProgress)}>
                  {project.projectProgress}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建人">{project.creatorName}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {project.createdAt ? new Date(project.createdAt).toLocaleString() : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {project.updatedAt ? new Date(project.updatedAt).toLocaleString() : '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 小批量信息 */}
          <Card title="小批量信息" className="mb-4">
            <Row gutter={[16, 16]}>
              <Col span={isMobile ? 24 : 8}>
                <div className="text-center">
                  <div className="text-gray-500 text-sm">小批量报价</div>
                  <div className="text-lg font-medium">
                    {project.smallBatchPrice ? `${formatAmount(project.smallBatchPrice)}元` : '-'}
                  </div>
                </div>
              </Col>
              <Col span={isMobile ? 24 : 8}>
                <div className="text-center">
                  <div className="text-gray-500 text-sm">小批量数量</div>
                  <div className="text-lg font-medium">
                    {project.smallBatchQuantity ? `${project.smallBatchQuantity}片` : '-'}
                  </div>
                </div>
              </Col>
              <Col span={isMobile ? 24 : 8}>
                <div className="text-center">
                  <div className="text-gray-500 text-sm">小批量总额</div>
                  <div className="text-lg font-medium text-green-600">
                    {project.smallBatchTotal ? `${formatAmount(project.smallBatchTotal)}万元` : '-'}
                  </div>
                </div>
              </Col>
            </Row>
            
            {/* 小批量附件 */}
            <div className="mt-6">
              <div className="mb-3 font-medium">小批量附件</div>
              {project.smallBatchAttachments && project.smallBatchAttachments.length > 0 ? (
                <List
                  size="small"
                  dataSource={project.smallBatchAttachments}
                  renderItem={(file) => (
                    <List.Item
                      actions={[
                        <Tooltip title="下载" key="download">
                          <Button
                            type="text"
                            size="small"
                            icon={<DownloadOutlined />}
                            onClick={() => handleFileDownload(file)}
                            className="text-blue-500 hover:text-blue-700"
                          />
                        </Tooltip>
                      ]}
                    >
                      <List.Item.Meta
                        avatar={<span className="text-lg">{getFileIcon(file.fileType)}</span>}
                        title={
                          <div className="flex items-center">
                            <Text ellipsis={{ tooltip: file.originalName }} className="max-w-64">
                              {file.originalName}
                            </Text>
                            <Text type="secondary" className="ml-2 text-xs">
                              {formatFileSize(file.fileSize)}
                            </Text>
                          </div>
                        }
                        description={
                          <Text type="secondary" className="text-xs">
                            {new Date(file.uploadTime).toLocaleString()}
                          </Text>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <div className="text-center py-4 text-gray-400 bg-gray-50 rounded">
                  暂无小批量附件
                </div>
              )}
            </div>
          </Card>

          {/* 批量出货信息 */}
          <Card title="批量出货信息" className="mb-4">
            <Row gutter={[16, 16]}>
              <Col span={isMobile ? 12 : 6}>
                <div className="text-center">
                  <div className="text-gray-500 text-sm">批量出货报价</div>
                  <div className="text-lg font-medium">
                    {project.massProductionPrice ? `${formatAmount(project.massProductionPrice)}元` : '-'}
                  </div>
                </div>
              </Col>
              <Col span={isMobile ? 12 : 6}>
                <div className="text-center">
                  <div className="text-gray-500 text-sm">批量出货数量</div>
                  <div className="text-lg font-medium">
                    {project.massProductionQuantity ? `${project.massProductionQuantity}片` : '-'}
                  </div>
                </div>
              </Col>
              <Col span={isMobile ? 12 : 6}>
                <div className="text-center">
                  <div className="text-gray-500 text-sm">批量出货总额</div>
                  <div className="text-lg font-medium text-green-600">
                    {project.massProductionTotal ? `${formatAmount(project.massProductionTotal)}万元` : '-'}
                  </div>
                </div>
              </Col>
              <Col span={isMobile ? 12 : 6}>
                <div className="text-center">
                  <div className="text-gray-500 text-sm">批量出货账期</div>
                  <div className="text-lg font-medium">
                    {project.paymentTerm || '-'}
                  </div>
                </div>
              </Col>
            </Row>
            
            {/* 批量出货附件 */}
            <div className="mt-6">
              <div className="mb-3 font-medium">批量出货附件</div>
              {project.massProductionAttachments && project.massProductionAttachments.length > 0 ? (
                <List
                  size="small"
                  dataSource={project.massProductionAttachments}
                  renderItem={(file) => (
                    <List.Item
                      actions={[
                        <Tooltip title="下载" key="download">
                          <Button
                            type="text"
                            size="small"
                            icon={<DownloadOutlined />}
                            onClick={() => handleFileDownload(file)}
                            className="text-blue-500 hover:text-blue-700"
                          />
                        </Tooltip>
                      ]}
                    >
                      <List.Item.Meta
                        avatar={<span className="text-lg">{getFileIcon(file.fileType)}</span>}
                        title={
                          <div className="flex items-center">
                            <Text ellipsis={{ tooltip: file.originalName }} className="max-w-64">
                              {file.originalName}
                            </Text>
                            <Text type="secondary" className="ml-2 text-xs">
                              {formatFileSize(file.fileSize)}
                            </Text>
                          </div>
                        }
                        description={
                          <Text type="secondary" className="text-xs">
                            {new Date(file.uploadTime).toLocaleString()}
                          </Text>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <div className="text-center py-4 text-gray-400 bg-gray-50 rounded">
                  暂无批量出货附件
                </div>
              )}
            </div>
          </Card>

          {/* 备注信息 */}
          {project.remark && (
            <Card title="备注信息">
              <div className="whitespace-pre-wrap">{project.remark}</div>
            </Card>
          )}
        </div>
      )
    },
    {
      key: '2',
      label: (
        <span>
          <FileTextOutlined />
          跟进记录
        </span>
      ),
      children: (
        <div>
          <div className="mb-4 flex justify-between items-center">
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={showFollowUpModal}
            >
              添加跟进
            </Button>
          </div>
          
          <Spin spinning={followUpRecordsLoading}>
            {followUpRecords.length > 0 ? (
              <div className="space-y-4">
                {followUpRecords.map((record) => (
                  <Card 
                    key={record._id} 
                    size="small"
                    title={
                      <div className="flex justify-between items-center">
                        <span>{record.title}</span>
                        <div className="flex items-center space-x-2">
                          <Text type="secondary" className="text-sm">
                            {record.createdAt ? new Date(record.createdAt).toLocaleString() : '-'}
                          </Text>
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleDeleteFollowUp(record._id!)}
                          />
                        </div>
                      </div>
                    }
                  >
                    <p className="mb-2">{record.content}</p>
                    <div className="text-sm text-gray-500">
                      创建人：{record.creatorName}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Empty description="暂无跟进记录" />
            )}
          </Spin>
        </div>
      )
    },
    {
      key: '3',
      label: (
        <span>
          <ClockCircleOutlined />
          进展历史
        </span>
      ),
      children: (
        <div>
          <Spin spinning={progressHistoryLoading}>
            {renderProgressTimeline(progressHistory)}
          </Spin>
        </div>
      )
    }
  ];

  return (
    <div className="project-detail p-6">
      {/* 页面头部 */}
      <div className={`${isMobile ? 'mb-4' : 'mb-6'}`}>
        <div className={`flex ${isMobile ? 'flex-col' : 'justify-between items-center'}`}>
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
                {project.projectName}
              </Title>
            </div>
          </div>
        </div>
      </div>

      {/* Tab内容 */}
      <Card>
        <Tabs 
          items={tabItems} 
          size={isMobile ? 'small' : undefined}
          tabPosition={isMobile ? 'top' : 'top'}
        />
      </Card>

      {/* 跟进记录Modal */}
      <Modal
        title="添加跟进记录"
        open={followUpModalVisible}
        onOk={handleAddFollowUp}
        onCancel={() => setFollowUpModalVisible(false)}
        confirmLoading={followUpLoading}
        width={isMobile ? '95%' : 600}
        okText="保存"
        cancelText="取消"
      >
        <Form form={followUpForm} layout="vertical">
          <Form.Item
            name="title"
            label="跟进标题"
            rules={[{ required: true, message: '请输入跟进标题' }]}
          >
            <Input placeholder="请输入跟进标题" />
          </Form.Item>
          <Form.Item
            name="content"
            label="跟进内容"
            rules={[{ required: true, message: '请输入跟进内容' }]}
          >
            <TextArea 
              rows={4} 
              placeholder="请详细描述跟进情况..."
              showCount
              maxLength={500}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectDetail;