/**
 * 产品统计组件
 * 展示产品库存相关统计信息
 */
import React from 'react';
import { Row, Col, Card, Statistic } from 'antd';
import { InfoCircleOutlined, ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';

interface ProductStatisticsProps {
  totalProducts: number;
  lowStockProducts: number;
  totalStock: number;
}

const ProductStatistics: React.FC<ProductStatisticsProps> = ({
  totalProducts,
  lowStockProducts,
  totalStock
}) => {
  return (
    <div className="mb-4">
      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic
              title="总产品数量"
              value={totalProducts}
              prefix={<InfoCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="低库存产品"
              value={lowStockProducts}
              valueStyle={{ color: '#cf1322' }}
              prefix={<ArrowDownOutlined />}
              suffix={`/ ${totalProducts}`}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="总库存量"
              value={totalStock}
              valueStyle={{ color: '#3f8600' }}
              prefix={<ArrowUpOutlined />}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ProductStatistics;