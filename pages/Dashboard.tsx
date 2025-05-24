import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Select, Typography, DatePicker, Tabs } from 'antd';
import { 
  ShoppingOutlined, 
  ShopOutlined,
  AppstoreOutlined,
  CalendarOutlined,
  RiseOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { 
  PieChart, 
  Pie, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  RadialBarChart,
  RadialBar
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { DashboardDataResponse } from '../shared/types';
import moment from 'moment';
import { useResponsive } from '../hooks/useResponsive';
import { motion } from 'framer-motion';
import { useData } from '../utils/dataFetcher'; // 引入useData hook

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

// 更新配色方案 - 更加柔和和现代的色彩
const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6', '#f97316', '#14b8a6', '#ec4899'];

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { 
    isMobile, 
    getControlSize, 
    getCardPadding,
    getTitleLevel,
    screenWidth
  } = useResponsive();
  const [timeRange, setTimeRange] = useState<string>('month');
  const [customDateRange, setCustomDateRange] = useState<[moment.Moment, moment.Moment] | null>(null);
  const [activeTab, setActiveTab] = useState<string>('customer');
  
  // 构建请求URL
  const getDashboardUrl = () => {
    let url = `/api/dashboard-stats?timeRange=${timeRange}`;
    
    if (timeRange === 'custom' && customDateRange) {
      const [startDate, endDate] = customDateRange;
      url += `&startDate=${startDate.format('YYYY-MM-DD')}&endDate=${endDate.format('YYYY-MM-DD')}`;
    }
    
    return url;
  };
  
  // 使用useData hook替代直接API调用，添加缓存功能
  const { 
    data: dashboardData, 
    isLoading: loading, 
    error, 
    mutate 
  } = useData<DashboardDataResponse>(
    getDashboardUrl(), 
    { 
      // 缓存5分钟，减少重复请求
      refreshInterval: 300000,
      initialData: {
        customerCount: 0,
        productCount: 0,
        agentCount: 0,
        customerImportance: [],
        customerProgress: [],
        customerNature: [],
        productPackageType: [],
        productStockLevel: [],
        productCustomerRelation: [],
        productProgressDistribution: []
      }
    }
  );
  
  // 处理时间范围变化
  const handleTimeRangeChange = (value: string) => {
    setTimeRange(value);
    if (value !== 'custom') {
      setCustomDateRange(null);
    }
  };
  
  // 处理自定义日期范围变化
  const handleDateRangeChange = (dates: [moment.Moment, moment.Moment] | null) => {
    setCustomDateRange(dates);
    if (dates) {
      setTimeRange('custom');
    }
  };
  
  // 记录错误
  useEffect(() => {
    if (error) {
      console.error('Dashboard data fetch error:', error);
    }
  }, [error]);
  
  // 改进的响应式图表渲染，根据屏幕宽度动态调整图表高度
  const renderResponsiveChart = (chart: React.ReactNode, baseHeight: number = 300) => {
    // 根据屏幕宽度动态计算高度
    // 确保在小屏幕上图表仍有合理的显示高度
    let chartHeight: number;
    
    if (screenWidth < 480) {
      // 极小屏幕 - 手机竖屏
      chartHeight = Math.max(baseHeight * 0.6, 180);
    } else if (screenWidth < 768) {
      // 小屏幕 - 手机横屏或小平板
      chartHeight = Math.max(baseHeight * 0.7, 200);
    } else if (screenWidth < 1024) {
      // 中等屏幕 - 平板
      chartHeight = Math.max(baseHeight * 0.8, 240);
    } else if (screenWidth < 1280) {
      // 较大屏幕 - 小显示器
      chartHeight = Math.max(baseHeight * 0.9, 270);
    } else {
      // 大屏幕 - 标准显示器或更大
      chartHeight = baseHeight;
    }
    
    return (
      <div className="w-full overflow-hidden" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          {chart}
        </ResponsiveContainer>
      </div>
    );
  };
  
  // 处理标签页切换
  const handleTabChange = (key: string) => {
    setActiveTab(key);
  };
  
  // 渲染客户维度图表 - 优化图表大小
  const renderCustomerCharts = () => {
    // 根据屏幕宽度计算Pie图表的配置
    const getPieConfig = () => {
      // 随着屏幕尺寸变化的半径
      let innerRadius: number;
      let outerRadius: number;
      
      if (screenWidth < 480) {
        innerRadius = 30;
        outerRadius = 50;
      } else if (screenWidth < 768) {
        innerRadius = 35;
        outerRadius = 55;
      } else if (screenWidth < 1024) {
        innerRadius = 40;
        outerRadius = 60;
      } else {
        innerRadius = 50;
        outerRadius = 80;
      }
      
      // 控制是否显示标签线
      const showLabelLine = screenWidth >= 768;
      
      // 很窄屏幕上简化标签
      const renderLabel = ({ name, percent }: { name: string; percent: number }) => {
        if (screenWidth < 480) {
          return `${name.length > 3 ? name.substring(0, 3) + '..' : name}`;
        } else if (screenWidth < 768) {
          return `${name.length > 4 ? name.substring(0, 4) + '...' : name}`;
        } else {
          return `${name}: ${(percent * 100).toFixed(0)}%`;
        }
      };
      
      return { innerRadius, outerRadius, showLabelLine, renderLabel };
    };
    
    const { innerRadius, outerRadius, showLabelLine, renderLabel } = getPieConfig();
    
    return (
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={24} md={8}>
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
              {renderResponsiveChart(
                <PieChart>
                  <Pie
                    data={dashboardData?.customerImportance??[]}
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
                  >
                    {(dashboardData?.customerImportance??[]).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} 个客户`, '数量']} />
                </PieChart>,
                isMobile ? 200 : 250
              )}
            </Card>
          </motion.div>
        </Col>
        <Col xs={24} sm={24} md={8}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card 
              title={<Text strong>客户进展状态分布</Text>}
              bordered={false} 
              className="h-full shadow-sm hover:shadow-md transition-all"
              size={isMobile ? "small" : "default"}
              bodyStyle={getCardPadding()}
            >
              {renderResponsiveChart(
                <PieChart>
                  <Pie
                    data={dashboardData?.customerProgress??[]}
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
                  >
                    {(dashboardData?.customerProgress??[]).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} 个客户`, '数量']} />
                </PieChart>,
                isMobile ? 200 : 250
              )}
            </Card>
          </motion.div>
        </Col>
        <Col xs={24} sm={24} md={8}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card 
              title={<Text strong>客户性质分布</Text>}
              bordered={false} 
              className="h-full shadow-sm hover:shadow-md transition-all"
              size={isMobile ? "small" : "default"}
              bodyStyle={getCardPadding()}
            >
              {renderResponsiveChart(
                <PieChart>
                  <Pie
                    data={dashboardData?.customerNature??[]}
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
                  >
                    {(dashboardData?.customerNature??[]).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} 个客户`, '数量']} />
                </PieChart>,
                isMobile ? 200 : 250
              )}
            </Card>
          </motion.div>
        </Col>
      </Row>
    );
  };
  
  // 渲染产品维度图表 - 优化图表大小
  const renderProductCharts = () => {
    // 根据屏幕宽度动态计算RadialBar图表配置
    const getRadialBarConfig = () => {
      // 根据屏幕宽度调整图表尺寸
      let barSize: number;
      
      if (screenWidth < 480) {
        barSize = 10;
      } else if (screenWidth < 768) {
        barSize = 15;
      } else {
        barSize = 20;
      }
      
      return { barSize };
    };
    
    // 根据屏幕宽度计算Bar图表配置
    const getBarConfig = () => {
      // 随着屏幕尺寸变化的条形图大小
      let barSize: number;
      
      if (screenWidth < 480) {
        barSize = 10;
      } else if (screenWidth < 768) {
        barSize = 12;
      } else {
        barSize = 15;
      }
      
      return { barSize };
    };
    
    const { barSize: radialBarSize } = getRadialBarConfig();
    const { barSize } = getBarConfig();
    
    return (
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={24} md={12}>
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
              {renderResponsiveChart(
                <RadialBarChart 
                  cx="50%" 
                  cy="50%" 
                  innerRadius="20%" 
                  outerRadius={screenWidth < 768 ? "80%" : "90%"} 
                  barSize={radialBarSize} 
                  data={dashboardData?.productPackageType}
                >
                  <RadialBar
                    minAngle={15}
                    background
                    clockWise
                    dataKey="value"
                    nameKey="name"
                    cornerRadius={10}
                    label={{ 
                      fill: '#666', 
                      position: 'insideStart',
                      fontSize: screenWidth < 768 ? 10 : 12 
                    }}
                  >
                    {(dashboardData?.productPackageType??[]).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </RadialBar>
                  <Legend 
                    iconSize={screenWidth < 768 ? 8 : 10} 
                    layout="vertical" 
                    verticalAlign="middle" 
                    align={screenWidth < 768 ? "center" : "right"}
                    wrapperStyle={{ 
                      fontSize: screenWidth < 480 ? 8 : screenWidth < 768 ? 10 : 12,
                      paddingLeft: screenWidth < 768 ? 0 : 10
                    }}
                  />
                  <Tooltip formatter={(value: number) => [`${value} 个产品`, '数量']} />
                </RadialBarChart>,
                isMobile ? 250 : 300
              )}
            </Card>
          </motion.div>
        </Col>
        <Col xs={24} sm={24} md={12}>
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
              {renderResponsiveChart(
                <PieChart>
                  <Pie
                    data={dashboardData?.productStockLevel}
                    cx="50%"
                    cy="50%"
                    labelLine={screenWidth >= 768}
                    outerRadius={screenWidth < 480 ? 50 : screenWidth < 768 ? 60 : 80}
                    innerRadius={screenWidth < 480 ? 30 : screenWidth < 768 ? 40 : 50}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    paddingAngle={4}
                    label={({ name, percent }) => {
                      if (screenWidth < 480) {
                        return `${name.length > 3 ? name.substring(0, 3) + '..' : name}`;
                      } else if (screenWidth < 768) {
                        return `${name.length > 4 ? name.substring(0, 4) + '...' : name}`;
                      } else {
                        return `${name}: ${(percent * 100).toFixed(0)}%`;
                      }
                    }}
                  >
                    {dashboardData?.productStockLevel.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} 个产品`, '数量']} />
                </PieChart>,
                isMobile ? 250 : 300
              )}
            </Card>
          </motion.div>
        </Col>
        
        <Col xs={24} sm={24} md={12}>
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
              {renderResponsiveChart(
                <BarChart
                  data={dashboardData?.productCustomerRelation??[]}
                  layout="vertical"
                  margin={{ 
                    top: 5, 
                    right: screenWidth < 768 ? 10 : 30, 
                    left: screenWidth < 768 ? 10 : 20, 
                    bottom: 5 
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis 
                    type="number" 
                    tick={{ fontSize: screenWidth < 768 ? 10 : 12 }}
                    tickCount={screenWidth < 768 ? 5 : 10}
                  />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={screenWidth < 480 ? 60 : screenWidth < 768 ? 80 : 150} 
                    tick={{ 
                      fontSize: screenWidth < 480 ? 9 : screenWidth < 768 ? 10 : 12,
                    }}
                    tickFormatter={(value) => {
                      if (screenWidth < 480 && value.length > 6) {
                        return value.substring(0, 6) + '...';
                      } else if (screenWidth < 768 && value.length > 10) {
                        return value.substring(0, 10) + '...';
                      }
                      return value;
                    }}
                  />
                  <Tooltip />
                  <Bar 
                    dataKey="value" 
                    name="客户数量" 
                    barSize={barSize}
                    radius={[0, 4, 4, 0]}
                  >
                    {(dashboardData?.productCustomerRelation??[]).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>,
                isMobile ? 300 : 400
              )}
            </Card>
          </motion.div>
        </Col>
        
        <Col xs={24} sm={24} md={12}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card 
              title={<Text strong>产品与客户进展阶段关系</Text>}
              bordered={false} 
              className="h-full shadow-sm hover:shadow-md transition-all"
              size={isMobile ? "small" : "default"}
              bodyStyle={getCardPadding()}
            >
              {renderResponsiveChart(
                <BarChart
                  data={dashboardData?.productProgressDistribution}
                  margin={{ 
                    top: 5, 
                    right: screenWidth < 768 ? 10 : 30, 
                    left: screenWidth < 768 ? 10 : 20, 
                    bottom: screenWidth < 768 ? 30 : 5 
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="productName" 
                    tick={{ 
                      fontSize: screenWidth < 480 ? 8 : screenWidth < 768 ? 10 : 12,
                      angle: screenWidth < 768 ? -45 : 0,
                      textAnchor: screenWidth < 768 ? 'end' : 'middle',
                    }}
                    tickLine={false}
                    interval={screenWidth < 768 ? 0 : 'preserveStartEnd'}
                    height={screenWidth < 768 ? 60 : 30}
                    tickFormatter={(value) => {
                      if (screenWidth < 480 && value.length > 5) {
                        return value.substring(0, 5) + '...';
                      } else if (screenWidth < 768 && value.length > 8) {
                        return value.substring(0, 8) + '...';
                      }
                      return value;
                    }}
                  />
                  <YAxis 
                    tick={{ fontSize: screenWidth < 768 ? 10 : 12 }}
                  />
                  <Tooltip />
                  <Legend 
                    wrapperStyle={{ 
                      fontSize: screenWidth < 480 ? 8 : screenWidth < 768 ? 10 : 12,
                      marginTop: screenWidth < 768 ? 5 : 0,
                    }} 
                    layout={screenWidth < 768 ? 'horizontal' : undefined}
                    verticalAlign={screenWidth < 768 ? 'bottom' : undefined}
                    align={screenWidth < 768 ? 'center' : undefined}
                  />
                  <Bar 
                    dataKey="sample" 
                    name="样板评估" 
                    fill={COLORS[0]}
                    radius={[4, 4, 0, 0]}
                    barSize={screenWidth < 480 ? 10 : screenWidth < 768 ? 12 : 15}
                  />
                  <Bar 
                    dataKey="testing" 
                    name="打样测试" 
                    fill={COLORS[1]}
                    radius={[4, 4, 0, 0]}
                    barSize={screenWidth < 480 ? 10 : screenWidth < 768 ? 12 : 15}
                  />
                  <Bar 
                    dataKey="smallBatch" 
                    name="小批量导入" 
                    fill={COLORS[2]}
                    radius={[4, 4, 0, 0]}
                    barSize={screenWidth < 480 ? 10 : screenWidth < 768 ? 12 : 15}
                  />
                  <Bar 
                    dataKey="massProduction" 
                    name="批量出货" 
                    fill={COLORS[3]}
                    radius={[4, 4, 0, 0]}
                    barSize={screenWidth < 480 ? 10 : screenWidth < 768 ? 12 : 15}
                  />
                </BarChart>,
                isMobile ? 300 : 400
              )}
            </Card>
          </motion.div>
        </Col>
      </Row>
    );
  };
  
  // 动画参数
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };
  
  // 手动刷新函数
  
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="overflow-hidden"
    >
      <div className={`flex ${isMobile ? 'flex-col' : 'flex-row justify-between'} items-${isMobile ? 'start' : 'center'} mb-6`}>
        <motion.div variants={itemVariants}>
          <Title level={getTitleLevel(3)} className="m-0 mb-4 text-gray-800">
            <span className="text-gradient">数据看板</span>
          </Title>
        </motion.div>
        
        <div className={`flex ${isMobile ? 'flex-col items-start' : 'flex-row items-center'} mb-4`}>
          <motion.div variants={itemVariants} className="flex items-center mb-2 mr-4">
            <CalendarOutlined className="mr-2 text-primary-500" />
            <Text strong className="text-gray-600">统计周期:</Text>
          </motion.div>
          <motion.div variants={itemVariants} className="flex flex-wrap">
            <Select 
              value={timeRange} 
              style={{ width: 120, marginRight: isMobile ? 0 : 16, marginBottom: isMobile ? 8 : 0 }} 
              onChange={handleTimeRangeChange}
              size={getControlSize()}
              className="mr-2"
            >
              <Option value="week">近7天</Option>
              <Option value="current_week">本周</Option>
              <Option value="month">近30天</Option>
              <Option value="quarter">近3个月</Option>
              <Option value="year">近1年</Option>
              <Option value="custom">自定义</Option>
            </Select>
            
            {timeRange === 'custom' && (
              <RangePicker 
                value={customDateRange} 
                onChange={handleDateRangeChange} 
                allowClear
                size={getControlSize()}
              />
            )}
          </motion.div>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="loading-pulse">
            <div></div>
            <div></div>
          </div>
        </div>
      ) : (
        <>
          <Row gutter={isMobile ? [8, 8] : [16, 16]} className="mb-6">
            <Col xs={24} sm={8} md={8}>
              <motion.div variants={itemVariants}>
                <Card 
                  bordered={false} 
                  className="card-gradient shadow-md hover:shadow-lg transition-all"
                  bodyStyle={{ padding: '20px' }}
                >
                  <div className="flex items-center">
                    <div className="bg-indigo-100 p-3 rounded-lg mr-4">
                      <TeamOutlined style={{ fontSize: 24, color: '#4f46e5' }} />
                    </div>
                    <div>
                      <Text className="text-gray-500 block">客户数量</Text>
                      <Title level={isMobile ? 4 : 3} className="m-0 text-gray-800">
                        {dashboardData?.customerCount??0}
                      </Title>
                      <div className="text-xs text-green-500 mt-1 flex items-center">
                        <RiseOutlined className="mr-1" /> 较上期增长 8%
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </Col>
            <Col xs={24} sm={8} md={8}>
              <motion.div variants={itemVariants}>
                <Card 
                  bordered={false} 
                  className="card-gradient shadow-md hover:shadow-lg transition-all"
                  bodyStyle={{ padding: '20px' }}
                >
                  <div className="flex items-center">
                    <div className="bg-green-100 p-3 rounded-lg mr-4">
                      <ShoppingOutlined style={{ fontSize: 24, color: '#10b981' }} />
                    </div>
                    <div>
                      <Text className="text-gray-500 block">产品数量</Text>
                      <Title level={isMobile ? 4 : 3} className="m-0 text-gray-800">
                        {dashboardData?.productCount}
                      </Title>
                      <div className="text-xs text-green-500 mt-1 flex items-center">
                        <RiseOutlined className="mr-1" /> 较上期增长 5%
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </Col>
            <Col xs={24} sm={8} md={8}>
              <motion.div variants={itemVariants}>
                <Card 
                  bordered={false} 
                  className="card-gradient shadow-md hover:shadow-lg transition-all"
                  bodyStyle={{ padding: '20px' }}
                >
                  <div className="flex items-center">
                    <div className="bg-orange-100 p-3 rounded-lg mr-4">
                      <ShopOutlined style={{ fontSize: 24, color: '#f59e0b' }} />
                    </div>
                    <div>
                      <Text className="text-gray-500 block">代理商数量</Text>
                      <Title level={isMobile ? 4 : 3} className="m-0 text-gray-800">
                        {dashboardData?.agentCount}
                      </Title>
                      <div className="text-xs text-green-500 mt-1 flex items-center">
                        <RiseOutlined className="mr-1" /> 较上期增长 3%
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </Col>
          </Row>
          
          <motion.div variants={itemVariants}>
            <Card 
              bordered={false}
              className="shadow-sm mb-6"
              bodyStyle={{ padding: '0' }}
            >
              <Tabs 
                activeKey={activeTab} 
                onChange={handleTabChange}
                tabBarStyle={{ 
                  marginBottom: 0, 
                  padding: '0 24px',
                  borderBottom: '1px solid #f1f5f9'
                }}
                size={isMobile ? "small" : "default"}
                className="dashboard-tabs"
              >
                <TabPane
                  tab={
                    <span className="flex items-center py-3">
                      <TeamOutlined className="mr-2" />
                      <span className="font-medium">客户维度</span>
                    </span>
                  }
                  key="customer"
                >
                  <div className="p-4">
                    {renderCustomerCharts()}
                  </div>
                </TabPane>
                
                <TabPane
                  tab={
                    <span className="flex items-center py-3">
                      <AppstoreOutlined className="mr-2" />
                      <span className="font-medium">产品维度</span>
                    </span>
                  }
                  key="product"
                >
                  <div className="p-4">
                    {renderProductCharts()}
                  </div>
                </TabPane>
              </Tabs>
            </Card>
          </motion.div>
        </>
      )}
    </motion.div>
  );
};

export default Dashboard;