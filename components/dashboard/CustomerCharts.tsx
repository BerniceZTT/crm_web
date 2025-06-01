/**
 * 客户维度图表组件
 * 显示客户重要程度分布和客户性质分布
 */

import React from 'react';
import { Card, Row, Col, Typography } from 'antd';
import { PieChart, Pie, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { DashboardDataResponse } from '../../shared/types';
import { CHART_COLORS, getPieConfig, handlePieClick } from './chartUtils';

const { Text } = Typography;

interface CustomerChartsProps {
  data: DashboardDataResponse;
  isMobile: boolean;
  screenWidth: number;
  getCardPadding: () => object;
}

const CustomerCharts: React.FC<CustomerChartsProps> = ({
  data,
  isMobile,
  screenWidth,
  getCardPadding
}) => {
  const { innerRadius, outerRadius, showLabelLine, renderLabel } = getPieConfig(screenWidth);
  
  const customerImportanceData = data?.customerImportance || [];
  const customerNatureData = data?.customerNature || [];

  return (
    <div className="space-y-6">
      {/* 客户重要程度分布 */}
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card 
              title={<Text strong>客户重要程度分布</Text>}
              bordered={false} 
              className="h-full shadow-sm hover:shadow-md transition-all"
              size={isMobile ? "small" : "default"}
              bodyStyle={getCardPadding()}
            >
              {customerImportanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={customerImportanceData}
                      cx="50%"
                      cy="50%"
                      labelLine={showLabelLine}
                      outerRadius={outerRadius}
                      innerRadius={innerRadius}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      paddingAngle={4}
                      label={renderLabel}
                      style={{ cursor: 'pointer' }}
                      onClick={(data) => handlePieClick(data, '客户重要程度')}
                    >
                      {customerImportanceData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number, name: string) => [`${value} 个客户`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-500">
                  暂无数据
                </div>
              )}
            </Card>
          </motion.div>
        </Col>
      </Row>
      
      {/* 客户性质分布 */}
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card 
              title={<Text strong>客户性质分布</Text>}
              bordered={false} 
              className="h-full shadow-sm hover:shadow-md transition-all"
              size={isMobile ? "small" : "default"}
              bodyStyle={getCardPadding()}
            >
              {customerNatureData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={customerNatureData}
                      cx="50%"
                      cy="50%"
                      labelLine={showLabelLine}
                      outerRadius={outerRadius}
                      innerRadius={innerRadius}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      paddingAngle={4}
                      label={renderLabel}
                      style={{ cursor: 'pointer' }}
                      onClick={(data) => handlePieClick(data, '客户性质')}
                    >
                      {customerNatureData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number, name: string) => [`${value} 个客户`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-500">
                  暂无数据
                </div>
              )}
            </Card>
          </motion.div>
        </Col>
      </Row>
    </div>
  );
};

export default CustomerCharts;