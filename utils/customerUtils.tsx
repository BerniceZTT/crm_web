/**
 * 客户管理工具函数
 * 包含表格列配置和其他功能函数
 */
import { Space, Button, Tag, Popconfirm, Dropdown, Modal } from 'antd';
import { 
  EyeOutlined,
  EditOutlined,
  UserSwitchOutlined,
  GlobalOutlined,
  DeleteOutlined,
  MoreOutlined,
  ProjectOutlined
} from '@ant-design/icons';
import { 
  Customer,
  CustomerNature,
  CustomerImportance,
  CustomerProgress} from '../shared/types';
import ResponsiveTooltip from '../components/common/ResponsiveTooltip';

// 获取表格列配置
export const getBaseColumns = (
  viewCustomerDetail: (id: string) => void
) => {
  return [
    {
      title: '客户名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (text: string, record: Customer) => (
        <a onClick={() => viewCustomerDetail(record._id || '')}>{text}</a>
      )
    },
    {
      title: '客户性质',
      dataIndex: 'nature',
      key: 'nature',
      width: 120,
      responsive: ['md', 'lg'],
      render: (nature: CustomerNature) => nature
    },
    {
      title: '重要程度',
      dataIndex: 'importance',
      key: 'importance',
      width: 100,
      render: (importance: CustomerImportance) => {
        let color = '';
        switch (importance) {
          case CustomerImportance.A:
            color = 'red';
            break;
          case CustomerImportance.B:
            color = 'orange';
            break;
          case CustomerImportance.C:
            color = 'blue';
            break;
          default:
            color = 'default';
        }
        return <Tag color={color}>{importance}</Tag>;
      }
    },
    {
      title: '应用领域',
      dataIndex: 'applicationField',
      key: 'applicationField',
      width: 150,
      responsive: ['lg']
    },
    {
      title: '产品需求',
      dataIndex: 'productNeeds',
      key: 'productNeeds',
      width: 150,
      render: (productNeeds: string[]) => {
        const count = productNeeds?.length || 0;
        return count > 0 ? <Tag color="blue">{count}个产品</Tag> : <span>-</span>;
      }
    },
    {
      title: '关联销售',
      dataIndex: 'relatedSalesName',
      key: 'relatedSalesName',
      width: 150,
      responsive: ['md', 'lg'],
      render: (text: string) => text || <span style={{ color: '#999' }}>未关联</span>
    },
    {
      title: '关联代理商',
      dataIndex: 'relatedAgentName',
      key: 'relatedAgentName',
      width: 150,
      responsive: ['lg'],
      render: (text: string) => text || <span style={{ color: '#999' }}>未关联</span>
    },
    {
      title: '创建人',
      dataIndex: 'ownerName',
      key: 'ownerName',
      width: 150,
      responsive: ['lg'],
      render: (text: string, record: Customer) => {
        if (!text) return <span style={{ color: '#999' }}>未分配</span>;
        let typeLabel = '';
        switch (record.ownerType) {
          case 'FACTORY_SALES':
            typeLabel = '(销售)';
            break;
          case 'AGENT':
            typeLabel = '(代理商)';
            break;
          default:
            typeLabel = '';
        }
        return <span>{text} {typeLabel}</span>;
      }
    }
  ];
};

// 获取操作列配置
// 获取操作列配置 - 增加查看项目操作
export const getActionColumn = (
  isMobile: boolean,
  viewCustomerDetail: (id: string) => void,
  showModal: (customer?: Customer) => void,
  showAssignModal: (customer: Customer) => void,
  moveToPublicPool: (id: string) => void,
  handleDelete: (id: string) => void,
  viewCustomerProjects: (id: string) => void, 
  permissions: {
    canViewCustomer: (customer: Customer) => boolean;
    canEditCustomer: (customer: Customer) => boolean;
    canAssignCustomer: (customer: Customer) => boolean;
    canMoveToPublicPool: (customer: Customer) => boolean;
    canDeleteCustomer: (customer: Customer) => boolean;
  }
) => {
  return {
    title: '操作',
    key: 'action',
    fixed: 'right' as const,
    width: isMobile ? 60 : 200,
    render: (_: any, record: Customer) => {
      if (record.progress === CustomerProgress.Disabled){
        return <>其他人已有进展</>
      }
      // 移动端使用下拉菜单
      if (isMobile) {
        const items = [];
        
        // 添加查看详情选项
        if (permissions.canViewCustomer(record)) {
          items.push({
            key: 'view',
            label: '查看详情',
            icon: <EyeOutlined />,
            onClick: () => viewCustomerDetail(record._id || '')
          });
        }

        // 添加查看项目选项
        if (permissions.canViewCustomer(record)) {
          items.push({
            key: 'viewProjects',
            label: '查看项目',
            icon: <ProjectOutlined />,
            onClick: () => viewCustomerProjects(record._id || '')
          });
        }
        
        // 添加编辑客户选项
        if (permissions.canEditCustomer(record)) {
          items.push({
            key: 'edit',
            label: '编辑客户',
            icon: <EditOutlined />,
            onClick: () => showModal(record)
          });
        }
        
        // 添加分配客户选项
        if (permissions.canAssignCustomer(record)) {
          items.push({
            key: 'assign',
            label: '分配客户',
            icon: <UserSwitchOutlined />,
            onClick: () => showAssignModal(record)
          });
        }
        
        // 添加移入公海选项
        if (permissions.canMoveToPublicPool(record)) {
          items.push({
            key: 'moveToPublic',
            label: '移入公海',
            icon: <GlobalOutlined />,
            danger: true,
            onClick: () => {
              Modal.confirm({
                title: '确定要将该客户移入公海吗?',
                onOk: () => moveToPublicPool(record._id || ''),
                okText: '确定',
                cancelText: '取消',
              });
            }
          });
        }
        
        // 添加删除客户选项
        if (permissions.canDeleteCustomer(record)) {
          items.push({
            key: 'delete',
            label: '删除客户',
            icon: <DeleteOutlined />,
            danger: true,
            onClick: () => {
              Modal.confirm({
                title: '确定要删除该客户吗?',
                onOk: () => handleDelete(record._id || ''),
                okText: '确定',
                cancelText: '取消',
              });
            }
          });
        }
        
        if (items.length === 0) {
          return <span>-</span>;
        }
        
        return (
          <Dropdown 
            menu={{ items }} 
            placement="bottomRight" 
            trigger={['click']}
          >
            <Button 
              type="text" 
              icon={<MoreOutlined />} 
              size="small"
              style={{ padding: '0 4px' }}
            />
          </Dropdown>
        );
      }
      
      // PC端保持原来的按钮布局，增加查看项目按钮
      return (
        <Space size="small">
          {/* 查看详情 */}
          {permissions.canViewCustomer(record) && (
            <ResponsiveTooltip title="查看详情">
              <Button 
                icon={<EyeOutlined />} 
                size="small" 
                onClick={() => viewCustomerDetail(record._id || '')}
              />
            </ResponsiveTooltip>
          )}

          {/* 查看项目 - 新增 */}
          {permissions.canViewCustomer(record) && (
            <ResponsiveTooltip title="查看项目">
              <Button 
                icon={<ProjectOutlined />} 
                size="small" 
                onClick={() => viewCustomerProjects(record._id || '')}
                style={{ color: '#722ed1' }}
              />
            </ResponsiveTooltip>
          )}
          
          {/* 编辑客户 */}
          {permissions.canEditCustomer(record) && (
            <ResponsiveTooltip title="编辑客户">
              <Button 
                icon={<EditOutlined />} 
                size="small" 
                onClick={() => showModal(record)}
              />
            </ResponsiveTooltip>
          )}
          
          {/* 分配功能 */}
          {permissions.canAssignCustomer(record) && (
            <ResponsiveTooltip title="分配客户">
              <Button 
                icon={<UserSwitchOutlined />} 
                size="small" 
                onClick={() => showAssignModal(record)}
              />
            </ResponsiveTooltip>
          )}
          
          {/* 移入公海 */}
          {permissions.canMoveToPublicPool(record) && (
            <ResponsiveTooltip title="移入公海">
              <Popconfirm
                title="确定要将该客户移入公海吗?"
                onConfirm={() => moveToPublicPool(record._id || '')}
                okText="确定"
                cancelText="取消"
              >
                <Button 
                  icon={<GlobalOutlined />} 
                  size="small" 
                  danger
                />
              </Popconfirm>
            </ResponsiveTooltip>
          )}
          
          {/* 删除客户 */}
          {permissions.canDeleteCustomer(record) && (
            <ResponsiveTooltip title="删除客户">
              <Popconfirm
                title="确定要删除该客户吗?"
                onConfirm={() => handleDelete(record._id || '')}
                okText="确定"
                cancelText="取消"
              >
                <Button 
                  icon={<DeleteOutlined />} 
                  size="small" 
                  danger
                />
              </Popconfirm>
            </ResponsiveTooltip>
          )}
        </Space>
      );
    }
  };
};

// 获取移动端列配置
export const getMobileColumns = (baseColumns: any[]) => {
  // 确保索引安全访问
  const nameColumn = baseColumns[0]; // 客户名称
  const importanceColumn = baseColumns[2]; // 重要程度
  const relatedSalesColumn = baseColumns[6]; // 关联销售

  return [
    nameColumn,
    importanceColumn,
    relatedSalesColumn
  ].filter(Boolean); // 过滤掉任何undefined值
};