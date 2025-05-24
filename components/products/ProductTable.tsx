/**
 * 产品表格组件
 * 展示产品列表数据
 * 改为整页滚动而非表格横向滚动
 */
import React from 'react';
import { Table } from 'antd';
import { Product } from '../../shared/types';
import { getProductColumns } from '../../utils/productUtils';
import { useResponsive } from '../../hooks/useResponsive';

interface ProductTableProps {
  products: Product[];
  loading: boolean;
  hasEditPermission: boolean;
  showModal: (product?: Product, isViewMode?: boolean) => void;
  showInventoryModal: (product: Product) => void;
}

const ProductTable: React.FC<ProductTableProps> = ({
  products,
  loading,
  hasEditPermission,
  showModal,
  showInventoryModal,
}) => {
  const { isMobile, getTableSize } = useResponsive();
  
  // 获取产品表格列配置
  const columns = getProductColumns(
    hasEditPermission,
    showModal,
    showInventoryModal
  );

  return (
    <div className="w-full overflow-x-auto">
      <Table
        columns={columns}
        dataSource={products}
        rowKey="_id"
        loading={loading}
        pagination={{
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条记录`,
          pageSizeOptions: ['10', '20', '50', '100'],
          defaultPageSize: 20
        }}
        size={getTableSize()}
        // 移除表格自身的横向滚动，改为包裹容器滚动
        scroll={undefined}
        className="product-table"
      />
      
      <style jsx global>{`
        .product-table .ant-table-cell {
          white-space: nowrap;
          padding: 8px;
        }
        
        @media (max-width: 768px) {
          .product-table .ant-table-cell {
            padding: 8px 4px;
          }
        }
      `}</style>
    </div>
  );
};

export default ProductTable;