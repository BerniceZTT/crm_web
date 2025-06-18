/**
 * 产品维度图表组件
 * 显示产品包装类型、库存等级、客户关联和项目关联分布
 */

import React from 'react';
import { Card, Row, Col, Typography } from 'antd';
import { PieChart, Pie, Tooltip, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { DashboardDataResponse } from '../../shared/types';
import { CHART_COLORS, handlePieClick } from './chartUtils';

const { Text } = Typography;

interface ProductChartsProps {
  data: DashboardDataResponse;
  isMobile: boolean;
  screenWidth: number;
  getCardPadding: () => object;
}

const ProductCharts: React.FC<ProductChartsProps> = ({
  data,
  isMobile,
  getCardPadding
}) => {
  const productPackageTypeData = data?.productPackageType || [];
  const productStockLevelData = data?.productStockLevel || [];
  const productCustomerRelationData = data?.productCustomerRelation || [];
  const productProjectRelationData = data?.productProjectRelation || [];

  return (
    <div className="space-y-6">
      {/* 第一行：包装类型和库存等级 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card 
              title={<Text strong>产品包装类型分布</Text>}
              bordered={false} 
              className="h-full shadow-sm hover:shadow-md transition-all"
              size={isMobile ? "small" : "default"}
              bodyStyle={getCardPadding()}
            >
              {productPackageTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={productPackageTypeData}
                      cx="50%"
                      cy="50%"
                      outerRadius={isMobile ? 60 : 80}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      style={{ cursor: 'pointer' }}
                      onClick={(data) => handlePieClick(data, '产品包装类型')}
                    >
                      {productPackageTypeData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number, name: string) => [`${value} 个产品`, name]} />
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
        
        <Col xs={24} lg={12}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card 
              title={<Text strong>产品库存等级分布</Text>}
              bordered={false} 
              className="h-full shadow-sm hover:shadow-md transition-all"
              size={isMobile ? "small" : "default"}
              bodyStyle={getCardPadding()}
            >
              {productStockLevelData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={productStockLevelData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-15}
                      textAnchor="end"
                      height={70}
                      interval={0}
                      fontSize={isMobile ? 10 : 12}
                    />
                    <YAxis 
                      label={{ value: '产品数量', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${value} 个产品`, '数量']}
                      labelFormatter={(label) => `库存范围: ${label}`}
                    />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
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
      
      {/* 第二行：产品客户关联和产品项目关联 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card 
              title={<Text strong>产品客户关联数量Top10</Text>}
              bordered={false} 
              className="h-full shadow-sm hover:shadow-md transition-all"
              size={isMobile ? "small" : "default"}
              bodyStyle={getCardPadding()}
            >
              {productCustomerRelationData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={productCustomerRelationData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={0}
                      tickFormatter={(value) => value.length > 8 ? `${value.substring(0, 8)}...` : value}
                    />
                    <YAxis 
                      label={{ value: '客户数量', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${value} 个客户`, '关联数量']}
                      labelFormatter={(label) => `产品: ${label}`}
                    />
                    <Bar dataKey="value" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-500">
                  暂无数据
                </div>
              )}
            </Card>
          </motion.div>
        </Col>
        
        <Col xs={24} lg={12}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card 
              title={<Text strong>产品项目关联数量Top10</Text>}
              bordered={false} 
              className="h-full shadow-sm hover:shadow-md transition-all"
              size={isMobile ? "small" : "default"}
              bodyStyle={getCardPadding()}
            >
              {productProjectRelationData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={productProjectRelationData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={0}
                      tickFormatter={(value) => value.length > 8 ? `${value.substring(0, 8)}...` : value}
                    />
                    <YAxis 
                      label={{ value: '项目数量', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${value} 个项目`, '关联数量']}
                      labelFormatter={(label) => `产品: ${label}`}
                    />
                    <Bar dataKey="value" fill="#ff7c7c" />
                  </BarChart>
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

export default ProductCharts;