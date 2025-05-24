/**
 * 客户表格组件
 * 用于展示客户列表数据
 */
import React from 'react';
import { Table, Spin, Empty, Card } from 'antd';
import { Customer } from '../../shared/types';
import { useResponsive } from '../../hooks/useResponsive';
import { getBaseColumns, getActionColumn, getMobileColumns } from '../../utils/customerUtils';
import { useCustomerPermissions } from '../../hooks/useCustomerPermissions';

interface CustomerTableProps {
  customers: Customer[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  isLoading: boolean;
  error: Error | null;
  onPageChange: (page: number, pageSize?: number) => void;
  viewCustomerDetail: (id: string) => void;
  showModal: (customer?: Customer) => void;
  showAssignModal: (customer: Customer) => void;
  moveToPublicPool: (id: string) => void;
  handleDelete: (id: string) => void;
}

const CustomerTable: React.FC<CustomerTableProps> = ({
  customers,
  pagination,
  isLoading,
  error,
  onPageChange,
  viewCustomerDetail,
  showModal,
  showAssignModal,
  moveToPublicPool,
  handleDelete
}) => {
  const { isMobile, getTableSize } = useResponsive();
  const permissions = useCustomerPermissions();
  
  // 获取基础列
  const baseColumns = getBaseColumns(viewCustomerDetail);
  
  // 获取操作列
  const actionColumn = getActionColumn(
    isMobile,
    viewCustomerDetail,
    showModal,
    showAssignModal,
    moveToPublicPool,
    handleDelete,
    permissions
  );
  
  // 根据设备类型选择要显示的列
  const columns = isMobile 
    ? [...getMobileColumns(baseColumns), actionColumn]
    : [...baseColumns, actionColumn];

  return (
    <Card bodyStyle={{ padding: isMobile ? '8px' : '24px' }}>
      <Spin spinning={isLoading}>
        {error ? (
          <div className="text-center text-red-500 py-4">
            加载失败: {error.message}
          </div>
        ) : customers.length > 0 ? (
          <div className="w-full overflow-x-auto">
            <Table
              columns={columns}
              dataSource={customers}
              rowKey="_id"
              pagination={{
                current: pagination.page,
                pageSize: pagination.limit,
                total: pagination.total,
                onChange: onPageChange,
                simple: isMobile // 移动端使用简化分页
              }}
              scroll={undefined} // 移除表格自身的横向滚动
              size={getTableSize()}
              className={isMobile ? 'mobile-customer-table' : ''}
            />
          </div>
        ) : (
          <Empty description="暂无客户数据" />
        )}
      </Spin>
    </Card>
  );
};

export default CustomerTable;