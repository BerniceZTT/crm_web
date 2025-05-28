/**
 * 产品统计组件
 * 展示产品库存相关统计信息
 */
import React from 'react';
import { Row, Col, Card, Statistic, Tooltip } from 'antd';

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
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title={
                <Tooltip title="库存小于等于5000的产品被定义为低库存产品">
                  <span style={{ cursor: 'pointer' }}>低库存产品</span>
                </Tooltip>
              }
              value={lowStockProducts}
              valueStyle={{ color: '#cf1322' }}
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
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ProductStatistics;