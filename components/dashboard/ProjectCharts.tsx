/**
 * 项目维度图表组件
 * 显示项目总额统计、项目进展分布和项目价值排行表格
 */

import React from 'react';
import { Card, Row, Col, Typography, Statistic, Table } from 'antd';
import { 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { RiseOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { DashboardDataResponse } from '../../shared/types';
import { CHART_COLORS, handlePieClick } from './chartUtils';

const { Text } = Typography;

interface ProjectChartsProps {
  data: DashboardDataResponse;
  isMobile: boolean;
  screenWidth: number;
  getCardPadding: () => object;
}

const ProjectCharts: React.FC<ProjectChartsProps> = ({
  data,
  isMobile,
  screenWidth,
  getCardPadding
}) => {
  const projectProgressData = data?.projectProgressDistribution || [];
  const topProjectsData = data?.topProjectsByValue || [];
  const batchStats = data?.projectBatchTotalStats;
  const smallBatchStats = data?.projectSmallBatchTotalStats;
  const monthlyStats = data?.projectMonthlyStats || [];

  // 数字格式化函数 - 确保显示精确值
  const formatNumber = (value: number): string => {
    if (value === 0) return '0';
    if (value < 0.001) return value.toFixed(6);
    if (value < 1) return value.toFixed(3);
    return value.toFixed(2);
  };

  // 响应式图表高度计算
  const getChartHeight = () => {
    if (screenWidth < 480) return 300;
    if (screenWidth < 768) return 350;
    return 400;
  };

  // 自定义Tooltip渲染函数
  const renderCustomTooltip = (props: any) => {
    const { active, payload, label } = props;
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid #d9d9d9',
          borderRadius: '6px',
          padding: '8px',
          fontSize: isMobile ? '12px' : '14px'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{`时间: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ margin: '4px 0', color: entry.color }}>
              {`${entry.name}: ${formatNumber(entry.value)} 万元`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // 项目价值排行表格列定义 - 修复精度显示
  const projectValueColumns = [
    {
      title: '项目名称',
      dataIndex: 'projectName',
      key: 'projectName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '产品',
      dataIndex: 'productName',
      key: 'productName',
      width: 120,
      ellipsis: true,
    },
    {
      title: '客户',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 120,
      ellipsis: true,
    },
    {
      title: '小批量总额',
      dataIndex: 'smallBatchTotal',
      key: 'smallBatchTotal',
      width: 100,
      align: 'right' as const,
      render: (value: number) => `${formatNumber(value || 0)} 万元`,
      sorter: (a: any, b: any) => (a.smallBatchTotal || 0) - (b.smallBatchTotal || 0),
    },
    {
      title: '批量总额',
      dataIndex: 'massProductionTotal',
      key: 'massProductionTotal',
      width: 100,
      align: 'right' as const,
      render: (value: number) => `${formatNumber(value || 0)} 万元`,
      sorter: (a: any, b: any) => (a.massProductionTotal || 0) - (b.massProductionTotal || 0),
    },
    {
      title: '总项目价值',
      dataIndex: 'totalValue',
      key: 'totalValue',
      width: 110,
      align: 'right' as const,
      render: (value: number) => (
        <Text strong style={{ color: '#722ed1' }}>
          {formatNumber(value || 0)} 万元
        </Text>
      ),
      sorter: (a: any, b: any) => (a.totalValue || 0) - (b.totalValue || 0),
      defaultSortOrder: 'descend' as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 项目总额统计卡片 - 使用精确格式化 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card 
              bordered={false} 
              className="shadow-sm hover:shadow-md transition-all text-center"
              size={isMobile ? "small" : "default"}
              bodyStyle={getCardPadding()}
            >
              <Statistic
                title="批量总额"
                value={formatNumber(batchStats?.totalAmount || 0)}
                suffix="万元"
                valueStyle={{ color: '#3f8600' }}
                prefix={<RiseOutlined />}
              />
              <div className="text-xs text-gray-500 mt-2">
                {batchStats?.totalProjects || 0} 个项目
              </div>
            </Card>
          </motion.div>
        </Col>
        
        <Col xs={24} sm={12} lg={8}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card 
              bordered={false} 
              className="shadow-sm hover:shadow-md transition-all text-center"
              size={isMobile ? "small" : "default"}
              bodyStyle={getCardPadding()}
            >
              <Statistic
                title="小批量总额"
                value={formatNumber(smallBatchStats?.totalAmount || 0)}
                suffix="万元"
                valueStyle={{ color: '#1890ff' }}
                prefix={<RiseOutlined />}
              />
              <div className="text-xs text-gray-500 mt-2">
                {smallBatchStats?.totalProjects || 0} 个项目
              </div>
            </Card>
          </motion.div>
        </Col>
        
        <Col xs={24} sm={12} lg={8}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card 
              bordered={false} 
              className="shadow-sm hover:shadow-md transition-all text-center"
              size={isMobile ? "small" : "default"}
              bodyStyle={getCardPadding()}
            >
              <Statistic
                title="总项目价值"
                value={formatNumber((batchStats?.totalAmount || 0) + (smallBatchStats?.totalAmount || 0))}
                suffix="万元"
                valueStyle={{ color: '#722ed1' }}
                prefix={<RiseOutlined />}
              />
              <div className="text-xs text-gray-500 mt-2">
                小批量 + 批量总额
              </div>
            </Card>
          </motion.div>
        </Col>
      </Row>
      
      {/* 新增：总项目价值趋势折线图 */}
      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Card 
              title={<Text strong>总项目价值趋势（近一年）</Text>}
              bordered={false} 
              className="shadow-sm hover:shadow-md transition-all"
              size={isMobile ? "small" : "default"}
              bodyStyle={getCardPadding()}
            >
              {monthlyStats.length > 0 ? (
                <ResponsiveContainer width="100%" height={getChartHeight()}>
                  <LineChart
                    data={monthlyStats}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: isMobile ? 60 : 30
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: isMobile ? 10 : 12, fill: '#666' }}
                      angle={isMobile ? -45 : 0}
                      textAnchor={isMobile ? 'end' : 'middle'}
                      height={isMobile ? 60 : 30}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: isMobile ? 10 : 12, fill: '#666' }}
                      tickFormatter={(value) => `${formatNumber(value)}`}
                    />
                    <Tooltip content={renderCustomTooltip} />
                    <Legend 
                      wrapperStyle={{ fontSize: isMobile ? '12px' : '14px' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="totalAmount" 
                      stroke="#722ed1" 
                      strokeWidth={3}
                      dot={{ fill: '#722ed1', strokeWidth: 2, r: isMobile ? 3 : 4 }}
                      activeDot={{ r: isMobile ? 5 : 6, stroke: '#722ed1', strokeWidth: 2 }}
                      name="总项目价值"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="batchAmount" 
                      stroke="#3f8600" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ fill: '#3f8600', strokeWidth: 1, r: isMobile ? 2 : 3 }}
                      name="批量总额"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="smallBatchAmount" 
                      stroke="#1890ff" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ fill: '#1890ff', strokeWidth: 1, r: isMobile ? 2 : 3 }}
                      name="小批量总额"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-96 text-gray-500">
                  暂无数据
                </div>
              )}
            </Card>
          </motion.div>
        </Col>
      </Row>
      
      {/* 项目进展分布和项目价值排行表格 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card 
              title={<Text strong>项目进展分布</Text>}
              bordered={false} 
              className="h-full shadow-sm hover:shadow-md transition-all"
              size={isMobile ? "small" : "default"}
              bodyStyle={getCardPadding()}
            >
              {projectProgressData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={projectProgressData}
                      cx="50%"
                      cy="50%"
                      outerRadius={isMobile ? 60 : 80}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      style={{ cursor: 'pointer' }}
                      onClick={(data) => handlePieClick(data, '项目进展')}
                    >
                      {projectProgressData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number, name: string) => [`${value} 个项目`, name]} />
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
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card 
              title={<Text strong>项目价值排行 Top10 (总项目价值 = 小批量总额 + 批量总额)</Text>}
              bordered={false} 
              className="h-full shadow-sm hover:shadow-md transition-all"
              size={isMobile ? "small" : "default"}
              bodyStyle={getCardPadding()}
            >
              {topProjectsData.length > 0 ? (
                <Table
                  dataSource={topProjectsData}
                  columns={projectValueColumns}
                  pagination={false}
                  size={isMobile ? "small" : "middle"}
                  scroll={{ x: 700, y: 350 }}
                  rowKey="projectName"
                  className="ant-table-striped"
                  rowClassName={(_record, index) => 
                    index % 2 === 0 ? 'table-row-light' : 'table-row-dark'
                  }
                />
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

export default ProjectCharts;