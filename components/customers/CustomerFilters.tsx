/**
 * 客户筛选条件组件
 * 提供客户列表的筛选功能和搜索功能
 * 增强版 - 同时支持客户管理和公海池筛选
 */
import React, { useEffect, useState } from 'react';
import { Card, Collapse, Select, Input, Row, Col, Button, Tag } from 'antd';
import { FilterOutlined, ReloadOutlined } from '@ant-design/icons';
import { CustomerNature, CustomerImportance } from '../../shared/types';
import { useResponsive } from '../../hooks/useResponsive';
import { motion } from 'framer-motion';

const { Panel } = Collapse;
const { Option } = Select;
const { Search } = Input;

interface CustomerFiltersProps {
  onFilterChange: (field: string, value: any) => void;
  onSearch: (value: string) => void;
  keyword?: string;
  onReset?: () => void; // 重置回调函数
  filters?: Record<string, any>; // 当前筛选值，用于受控模式
  isPublicPool?: boolean; // 是否用于公海池筛选
}

const CustomerFilters: React.FC<CustomerFiltersProps> = ({ 
  onFilterChange, 
  onSearch,
  keyword,
  onReset,
  filters = {}, // 默认为空对象
  isPublicPool = false // 默认非公海池
}) => {
  const { isMobile, getControlSize, getButtonSize } = useResponsive();
  // 根据设备类型设置默认展开状态
  const [activeKey, setActiveKey] = useState<string[]>(isMobile ? [] : ['1']);
  const [searchValue, setSearchValue] = useState(keyword || '');
  
  // 当父组件提供的筛选值或关键词变化时更新组件状态
  useEffect(() => {
    setSearchValue(keyword || '');
  }, [keyword]);

  // 当设备类型变化时更新折叠状态
  useEffect(() => {
    setActiveKey(isMobile ? [] : ['1']);
  }, [isMobile]);

  // 处理搜索值变化
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
  };

  // 处理重置按钮点击
  const handleReset = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 重置本地UI状态
    setSearchValue('');
    
    // 调用父组件提供的重置函数
    if (onReset) {
      onReset();
    }
  };
  

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card 
        className="mb-4 shadow-sm" 
        bodyStyle={{ padding: isMobile ? '12px' : '16px' }}
        bordered={false}
      >
        {/* 搜索框部分 */}
        <div className="mb-3">
          <Search
            placeholder={isPublicPool? "搜索客户名称": "搜索客户名称/联系人/应用领域"}
            value={searchValue}
            onChange={handleSearchChange}
            onSearch={onSearch}
            enterButton
            allowClear
            size={getControlSize()}
          />
        </div>
        
        <Collapse 
          ghost 
          activeKey={activeKey} 
          onChange={(key) => setActiveKey(key as string[])}
          className="filter-collapse"
        >
          <Panel 
            header={
              <div className="flex items-center text-gray-700 font-medium">
                <FilterOutlined className="mr-2 text-primary-500" /> 
                <span>高级筛选</span>
              </div>
            } 
            key="1"
            className="py-0"
            extra={
              <Button
                icon={<ReloadOutlined />}
                size={getButtonSize()}
                onClick={handleReset}
                className="ml-2 text-gray-500 hover:text-primary-500"
                id="reset-filters-button"
                data-testid="reset-filters-button"
              >
                {!isMobile && "重置筛选"}
              </Button>
            }
          >
            {/* 高级筛选表单内容 */}
            <Row gutter={[16, 16]} className="mb-2">
              {/* 客户性质筛选 */}
              <Col xs={24} sm={12} md={8} lg={6}>
                <div className="mb-1 text-gray-600 text-sm">客户性质</div>
                <Select
                  placeholder="选择客户性质"
                  style={{ width: '100%' }}
                  allowClear
                  size={getControlSize()}
                  value={filters.nature}
                  onChange={(value) => onFilterChange('nature', value)}
                >
                  {Object.entries(CustomerNature).map(([key, value]) => (
                    <Option key={key} value={value}>
                      {value}
                    </Option>
                  ))}
                </Select>
              </Col>
              
              {/* 客户重要性筛选 */}
              <Col xs={24} sm={12} md={8} lg={6}>
                <div className="mb-1 text-gray-600 text-sm">客户重要性</div>
                <Select
                  placeholder="选择客户重要性"
                  style={{ width: '100%' }}
                  allowClear
                  size={getControlSize()}
                  value={filters.importance}
                  onChange={(value) => onFilterChange('importance', value)}
                >
                  {Object.entries(CustomerImportance).map(([key, value]) => (
                    <Option key={key} value={value}>
                      {value}
                    </Option>
                  ))}
                </Select>
              </Col>
            </Row>
          </Panel>
        </Collapse>
      </Card>
    </motion.div>
  );
};

export default CustomerFilters;