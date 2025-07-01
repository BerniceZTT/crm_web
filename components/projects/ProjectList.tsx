/**
 * 项目列表组件
 * 显示客户的所有项目，根据显示模式控制关联信息列的显示
 */
import React, { useState, useMemo } from 'react';
import { 
  Table, 
  Button, 
  Tag, 
  Space, 
  Modal, 
  message,
  Empty,
  Typography,
  Tooltip
} from 'antd';
import { 
  EditOutlined, 
  DeleteOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  UserOutlined,
  ShopOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { Project, ProjectProgress, UserRole } from '../../shared/types';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';
import { useResponsive } from '../../hooks/useResponsive';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

interface ProjectListProps {
  customerId: string;
  projects: Project[];
  loading: boolean;
  onRefresh: () => void;
  onEdit: (project: Project) => void;
  onAdd: () => void;
  showRelatedColumns?: boolean;
  showCreateButton?: boolean;
  pagination?: { page: number; limit: number };
  serverPagination?: { page: number; limit: number; total: number; pages: number } | null;
  onPageChange?: (page: number, pageSize?: number) => void;
  onShowSizeChange?: (current: number, size: number) => void;
}

const ProjectList: React.FC<ProjectListProps> = ({
  customerId,
  projects,
  loading,
  onRefresh,
  onEdit,
  onAdd,
  showRelatedColumns = true,
  showCreateButton = false,
  pagination,
  serverPagination,
  onPageChange,
  onShowSizeChange
}) => {
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const navigate = useNavigate();
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const formatDateTime = (dateTime: string | Date, showTime: boolean = false) => {
    if (!dateTime) return '-';
    const date = new Date(dateTime);
    
    if (showTime) {
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        ...(isMobile ? {} : { second: '2-digit' }),
        hour12: false
      });
    } else {
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    }
  };

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

  const formatAmount = (amount: number) => {
    if (amount === 0) return '-';
    
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

  const canEdit = () => {
    if (!user) return false;
    return user.role === UserRole.SUPER_ADMIN || 
           user.role === UserRole.FACTORY_SALES || 
           user.role === UserRole.AGENT;
  };

  const canDelete = () => {
    if (!user) return false;
    return user.role === UserRole.SUPER_ADMIN;
  };

  const canCreateProject = () => {
    if (!user) return false;
    return user.role === UserRole.SUPER_ADMIN || 
           user.role === UserRole.FACTORY_SALES || 
           user.role === UserRole.AGENT;
  };

  const handleViewDetail = (project: Project) => {
    console.log('查看项目详情，项目ID:', project._id);
    console.log('项目信息:', project);
    
    if (!project._id) {
      message.error('项目ID无效，无法查看详情');
      return;
    }
    
    try {
      navigate(`/projects/detail/${project._id}`);
    } catch (error) {
      console.error('导航到项目详情页面失败:', error);
      message.error('跳转失败，请重试');
    }
  };

  const handleDelete = (project: Project) => {
    setDeletingProject(project);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!deletingProject) return;
    
    setDeleteLoading(true);
    try {
      await api.delete(`/api/projects/${deletingProject._id}`, {
        showSuccessMessage: true
      });
      
      setDeleteModalVisible(false);
      setDeletingProject(null);
      onRefresh();
    } catch (error) {
      console.error('删除项目失败:', error);
      message.error('删除项目失败');
    } finally {
      setDeleteLoading(false);
    }
  };

  const baseColumns = [
    {
      title: '项目名称',
      dataIndex: 'projectName',
      key: 'projectName',
      ellipsis: true,
      width: isMobile ? 120 : 150,
    },
    {
      title: '产品型号',
      dataIndex: 'productName',
      key: 'productName',
      ellipsis: true,
      width: isMobile ? 100 : 150,
    },
    {
      title: '批次号',
      dataIndex: 'batchNumber',
      key: 'batchNumber',
      ellipsis: true,
      width: isMobile ? 80 : 120,
    },
    {
      title: (
        <Space>
          <ClockCircleOutlined />
          开始时间
        </Space>
      ),
      dataIndex: 'startDate',
      key: 'startDate',
      width: isMobile ? 110 : 140,
      render: (startDate: string | Date) => {
        if (!startDate) return '-';
        const date = new Date(startDate);
        const shortTime = formatDateTime(startDate, false);
        const fullTime = formatDateTime(startDate, true);
        
        return (
          <Tooltip title={`完整时间: ${fullTime}`}>
            <Space direction="vertical" size={0}>
              <Text style={{ fontSize: '12px' }}>{shortTime}</Text>
              {!isMobile && (
                <Text type="secondary" style={{ fontSize: '10px' }}>
                  {date.toLocaleTimeString('zh-CN', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: false 
                  })}
                </Text>
              )}
            </Space>
          </Tooltip>
        );
      },
    },
    {
      title: '项目进展',
      dataIndex: 'projectProgress',
      key: 'projectProgress',
      width: isMobile ? 80 : 120,
      render: (progress: ProjectProgress) => (
        <Tag color={getProgressColor(progress)}>{progress}</Tag>
      ),
    },
    {
      title: '小批量总额',
      dataIndex: 'smallBatchTotal',
      key: 'smallBatchTotal',
      width: isMobile ? 100 : 120,
      render: (total: number) => (
        <Text type={total > 0 ? 'success' : 'secondary'}>
          {total > 0 ? `${formatAmount(total)}万元` : '-'}
        </Text>
      ),
    },
    {
      title: '批量总额',
      dataIndex: 'massProductionTotal',
      key: 'massProductionTotal',
      width: isMobile ? 100 : 120,
      render: (total: number) => (
        <Text type={total > 0 ? 'success' : 'secondary'}>
          {total > 0 ? `${formatAmount(total)}万元` : '-'}
        </Text>
      ),
    },
  ];

  const relatedColumns = showRelatedColumns ? [
    {
      title: (
        <Space>
          <TeamOutlined />
          关联客户
        </Space>
      ),
      dataIndex: 'customerName',
      key: 'customerName',
      width: isMobile ? 100 : 120,
      ellipsis: true,
      render: (customerName: string) => (
        <Tooltip title={customerName}>
          <Text>{customerName || '-'}</Text>
        </Tooltip>
      ),
    },
    {
      title: (
        <Space>
          <UserOutlined />
          关联销售
        </Space>
      ),
      dataIndex: 'relatedSalesName',
      key: 'relatedSalesName',
      width: isMobile ? 90 : 110,
      ellipsis: true,
      render: (salesName: string) => (
        <Tooltip title={salesName || '无关联销售'}>
          <Text type={salesName ? 'default' : 'secondary'}>
            {salesName || '-'}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: (
        <Space>
          <ShopOutlined />
          关联代理商
        </Space>
      ),
      dataIndex: 'relatedAgentName',
      key: 'relatedAgentName',
      width: isMobile ? 100 : 120,
      ellipsis: true,
      render: (agentName: string) => (
        <Tooltip title={agentName || '无关联代理商'}>
          <Text type={agentName ? 'default' : 'secondary'}>
            {agentName || '-'}
          </Text>
        </Tooltip>
      ),
    },
  ] : [];

  const endColumns = [
    {
      title: '创建人',
      dataIndex: 'creatorName',
      key: 'creatorName',
      width: isMobile ? 60 : 100,
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: isMobile ? 100 : 140,
      render: (_, record: Project) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
              className="text-blue-500 hover:text-blue-700"
            />
          </Tooltip>
          {canEdit() && (
            <Tooltip title="编辑">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => onEdit(record)}
              />
            </Tooltip>
          )}
          {canDelete() && (
            <Tooltip title="删除">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const columns = [...baseColumns, ...relatedColumns, ...endColumns];

  const mobileColumns = columns.filter(col => {
    const key = col.key as string;
    if (showRelatedColumns) {
      return ['projectName', 'startDate', 'projectProgress', 'customerName', 'action'].includes(key);
    } else {
      return ['projectName', 'startDate', 'projectProgress', 'action'].includes(key);
    }
  });

  const paginationConfig = useMemo(() => {
    if (customerId) {
      return {
        pageSize: isMobile ? 5 : 10,
        showSizeChanger: !isMobile,
        showQuickJumper: !isMobile,
        showTotal: (total: number, range: [number, number]) => 
          `第 ${range[0]}-${range[1]} 条/共 ${total} 条`,
        pageSizeOptions: ['5', '10', '20', '50'],
      };
    }
    
    if (pagination && serverPagination && onPageChange && onShowSizeChange) {
      console.log('[分页配置] 使用服务端分页信息:', {
        serverPagination,
        projectsLength: projects.length,
        clientPagination: pagination
      });
      
      const actualPageSize = serverPagination.limit;
      const actualCurrent = serverPagination.page;
      const actualTotal = serverPagination.total;
      
      if (projects.length > actualPageSize) {
        console.warn('[分页配置] 数据异常：当前页数据量超过页面大小', {
          projectsLength: projects.length,
          pageSize: actualPageSize
        });
      }
      
      return {
        current: actualCurrent,
        pageSize: actualPageSize,
        total: actualTotal,
        showSizeChanger: !isMobile,
        showQuickJumper: !isMobile,
        showTotal: (total: number, range: [number, number]) => 
          `第 ${range[0]}-${range[1]} 条/共 ${total} 条`,
        pageSizeOptions: ['5', '10', '20', '50'],
        onChange: (page: number, pageSize?: number) => {
          console.log('[分页变化] 页码变化:', { page, pageSize });
          if (onPageChange) {
            onPageChange(page, pageSize);
          }
        },
        onShowSizeChange: (current: number, size: number) => {
          console.log('[分页变化] 页面大小变化:', { current, size });
          if (onShowSizeChange) {
            onShowSizeChange(current, size);
          }
        },
      };
    }
    
    if (pagination && onPageChange && onShowSizeChange) {
      console.log('[分页配置] 使用降级分页配置，当前项目数:', projects.length);
      
      return {
        current: pagination.page,
        pageSize: pagination.limit,
        showSizeChanger: !isMobile,
        showQuickJumper: !isMobile,
        showTotal: (total: number, range: [number, number]) => 
          `第 ${range[0]}-${range[1]} 条/共 ${total} 条`,
        pageSizeOptions: ['5', '10', '20', '50'],
        onChange: onPageChange,
        onShowSizeChange: onShowSizeChange,
      };
    }
    
    return {
      pageSize: isMobile ? 5 : 10,
      showSizeChanger: !isMobile,
      showQuickJumper: !isMobile,
      showTotal: (total: number, range: [number, number]) => 
        `第 ${range[0]}-${range[1]} 条/共 ${total} 条`,
      pageSizeOptions: ['5', '10', '20', '50'],
    };
  }, [customerId, pagination, serverPagination, onPageChange, onShowSizeChange, isMobile, projects.length]);

  return (
    <>
      <div className="mb-4 flex justify-between items-center">
        <div>
          <Text strong>项目列表</Text>
          <Text type="secondary" className="ml-2">
            {customerId 
              ? `共 ${projects.length} 个项目` 
              : serverPagination 
                ? `第 ${serverPagination.page}/${serverPagination.pages} 页 (共 ${serverPagination.total} 条)`
                : `第 ${pagination?.page || 1} 页 (每页 ${pagination?.limit || 10} 条)`
            }
          </Text>
          {!showRelatedColumns && (
            <Text type="secondary" className="ml-2 text-xs">
              (隐藏关联信息列)
            </Text>
          )}
        </div>
        
        {showCreateButton && canCreateProject() && (
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={onAdd}
            size={isMobile ? "middle" : "middle"}
          >
            {isMobile ? '新建' : '新建项目'}
          </Button>
        )}
      </div>

      <Table
        dataSource={projects}
        columns={isMobile ? mobileColumns : columns}
        rowKey="_id"
        loading={loading}
        pagination={paginationConfig}
        scroll={{ 
          x: isMobile 
            ? (showRelatedColumns ? 800 : 600) 
            : (showRelatedColumns ? 1400 : 1000) 
        }}
        size={isMobile ? "small" : "middle"}
        locale={{
          emptyText: (
            <Empty 
              description="暂无项目数据"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )
        }}
      />

      <Modal
        title="确认删除"
        open={deleteModalVisible}
        onOk={confirmDelete}
        onCancel={() => setDeleteModalVisible(false)}
        confirmLoading={deleteLoading}
        okText="确认删除"
        cancelText="取消"
        okType="danger"
        width={isMobile ? '90%' : 400}
      >
        <p>
          确定要删除项目 <Text strong>"{deletingProject?.projectName}"</Text> 吗？
        </p>
        <p className="text-red-500 text-sm">
          此操作不可逆，请谨慎操作。
        </p>
      </Modal>
    </>
  );
};

export default ProjectList;