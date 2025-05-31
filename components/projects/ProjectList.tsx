/**
 * 项目列表组件
 * 显示客户的所有项目，去掉附件展示
 */
import React, { useState } from 'react';
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
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined,
  EyeOutlined
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
}

const ProjectList: React.FC<ProjectListProps> = ({
  customerId,
  projects,
  loading,
  onRefresh,
  onEdit,
  onAdd
}) => {
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const navigate = useNavigate();
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  // 检查用户权限
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

  // 处理查看详情 - 增加错误处理和调试信息
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

  // 处理删除项目
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

  // 表格列定义 - 移除附件列
  const columns = [
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
      render: (_: any, record: Project) => (
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

  // 移动端显示更简洁的列
  const mobileColumns = columns.filter(col => 
    ['projectName', 'projectProgress', 'action'].includes(col.key as string)
  );

  return (
    <>
      <div className="mb-4 flex justify-between items-center">
        <div>
          <Text strong>项目列表</Text>
          <Text type="secondary" className="ml-2">
            共 {projects.length} 个项目
          </Text>
        </div>
        {canEdit() && (
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={onAdd}
            size={isMobile ? "middle" : "middle"}
          >
            新建项目
          </Button>
        )}
      </div>

      <Table
        dataSource={projects}
        columns={isMobile ? mobileColumns : columns}
        rowKey="_id"
        loading={loading}
        pagination={{
          pageSize: isMobile ? 5 : 10,
          showSizeChanger: !isMobile,
          showQuickJumper: !isMobile,
          showTotal: (total, range) => 
            `第 ${range[0]}-${range[1]} 条/共 ${total} 条`,
        }}
        scroll={{ x: isMobile ? 400 : 800 }}
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

      {/* 删除确认对话框 */}
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