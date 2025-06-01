/**
 * 数据看板主页面 - 重构后的简化版本
 * 通过拆分子组件大幅简化了主文件的复杂度
 */

import React, { useState } from 'react';
import { Typography, Spin, Alert, Tabs } from 'antd';
import { useAuth } from '../contexts/AuthContext';
import { DashboardDataResponse } from '../shared/types';
import moment from 'moment';
import { useResponsive } from '../hooks/useResponsive';
import { useData } from '../utils/dataFetcher';

// 导入子组件
import TimeRangeSelector from '../components/dashboard/TimeRangeSelector';
import StatisticCards from '../components/dashboard/StatisticCards';
import CustomerCharts from '../components/dashboard/CustomerCharts';
import ProductCharts from '../components/dashboard/ProductCharts';
import ProjectCharts from '../components/dashboard/ProjectCharts';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { 
    isMobile, 
    getControlSize, 
    getButtonSize, 
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
  
  // 使用useData hook
  const { 
    data: dashboardData, 
    isLoading: loading, 
    error, 
    mutate 
  } = useData<DashboardDataResponse>(
    getDashboardUrl(), 
    { 
      refreshInterval: 300000,
      initialData: {
        customerCount: 0,
        productCount: 0,
        agentCount: 0,
        projectCount: 0,
        customerImportance: [],
        customerNature: [],
        productPackageType: [],
        productStockLevel: [],
        productCustomerRelation: [],
        productProjectRelation: [],
        projectProgressDistribution: [],
        projectBatchTotalStats: {
          totalAmount: 0,
          totalProjects: 0,
          maxAmount: 0,
          minAmount: 0
        },
        projectSmallBatchTotalStats: {
          totalAmount: 0,
          totalProjects: 0,
          maxAmount: 0,
          minAmount: 0
        },
        projectMonthlyStats: [],
        topProjectsByValue: []
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
  
  // 处理刷新
  const handleRefresh = () => {
    mutate(true);
  };
  
  // 处理标签页切换
  const handleTabChange = (key: string) => {
    setActiveTab(key);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* 标题和控制区域 */}
        <div className={`flex ${isMobile ? 'flex-col space-y-4' : 'justify-between items-center'} mb-6`}>
          <div>
            <Title level={getTitleLevel(1)} className="m-0 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              📊 数据看板
            </Title>
            <Text type="secondary">
              数据洞察，助力决策
            </Text>
          </div>
          
          <TimeRangeSelector
            timeRange={timeRange}
            customDateRange={customDateRange}
            loading={loading}
            isMobile={isMobile}
            getControlSize={getControlSize}
            getButtonSize={getButtonSize}
            onTimeRangeChange={handleTimeRangeChange}
            onDateRangeChange={handleDateRangeChange}
            onRefresh={handleRefresh}
          />
        </div>
        
        {/* 错误提示 */}
        {error && (
          <Alert
            message="数据加载失败"
            description={error.message || '请稍后重试'}
            type="error"
            showIcon
            closable
            className="mb-6"
            action={
              <button onClick={handleRefresh}>重试</button>
            }
          />
        )}
        
        {/* 加载状态 */}
        {loading && (
          <div className="flex justify-center items-center h-64">
            <Spin size="large" tip="加载数据中..." />
          </div>
        )}
        
        {/* 内容区域 */}
        {!loading && dashboardData && (
          <>
            {/* 统计卡片 */}
            <StatisticCards 
              data={dashboardData}
              isMobile={isMobile}
              getCardPadding={getCardPadding}
            />
            
            {/* 分维度图表 */}
            <Tabs
              activeKey={activeTab}
              onChange={handleTabChange}
              size={getControlSize()}
              className="dashboard-tabs"
            >
              <TabPane tab="客户维度" key="customer">
                <CustomerCharts
                  data={dashboardData}
                  isMobile={isMobile}
                  screenWidth={screenWidth}
                  getCardPadding={getCardPadding}
                />
              </TabPane>
              
              <TabPane tab="产品维度" key="product">
                <ProductCharts
                  data={dashboardData}
                  isMobile={isMobile}
                  screenWidth={screenWidth}
                  getCardPadding={getCardPadding}
                />
              </TabPane>
              
              <TabPane tab="项目维度" key="project">
                <ProjectCharts
                  data={dashboardData}
                  isMobile={isMobile}
                  screenWidth={screenWidth}
                  getCardPadding={getCardPadding}
                />
              </TabPane>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;