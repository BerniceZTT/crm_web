/**
 * 统计卡片组件
 * 显示客户、产品、代理商、项目的总数统计
 */

import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import { 
  UsergroupAddOutlined, 
  ShoppingOutlined, 
  ShopOutlined,
  ProjectOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { DashboardDataResponse } from '../../shared/types';

interface StatisticCardsProps {
  data: DashboardDataResponse;
  isMobile: boolean;
  getCardPadding: () => object;
}

const StatisticCards: React.FC<StatisticCardsProps> = ({
  data,
  isMobile,
  getCardPadding
}) => {
  const statisticCards = [
    {
      title: "客户总数",
      value: data?.customerCount || 0,
      color: '#3f8600',
      icon: <UsergroupAddOutlined />,
      delay: 0.1
    },
    {
      title: "产品总数", 
      value: data?.productCount || 0,
      color: '#1890ff',
      icon: <ShoppingOutlined />,
      delay: 0.2
    },
    {
      title: "代理商数",
      value: data?.agentCount || 0,
      color: '#722ed1',
      icon: <ShopOutlined />,
      delay: 0.3
    },
    {
      title: "项目总数",
      value: data?.projectCount || 0,
      color: '#fa8c16',
      icon: <ProjectOutlined />,
      delay: 0.4
    }
  ];

  return (
    <Row gutter={[16, 16]} className="mb-6">
      {statisticCards.map((card) => (
        <Col xs={12} sm={6} lg={6} key={card.title}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: card.delay }}
          >
            <Card 
              bordered={false} 
              className="shadow-sm hover:shadow-md transition-all text-center h-full"
              size={isMobile ? "small" : "default"}
              bodyStyle={getCardPadding()}
            >
              <Statistic
                title={card.title}
                value={card.value}
                valueStyle={{ 
                  color: card.color, 
                  fontSize: isMobile ? '18px' : '24px' 
                }}
                prefix={card.icon}
              />
            </Card>
          </motion.div>
        </Col>
      ))}
    </Row>
  );
};

export default StatisticCards;
