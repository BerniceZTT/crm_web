/**
 * 客户筛选条件组件
 * 提供客户列表的筛选功能和搜索功能
 * 增强版 - 同时支持客户管理和公海池筛选
 */
import React, { useEffect, useState } from 'react';
import { Card, Collapse, Select, Input, Row, Col, Button } from 'antd';
import { FilterOutlined, ReloadOutlined } from '@ant-design/icons';
import { CustomerNature, CustomerImportance, UserRole } from '../../shared/types';
import { useResponsive } from '../../hooks/useResponsive';
import { motion } from 'framer-motion';

import { useData } from 'utils/dataFetcher';
import { useAuth } from '../../contexts/AuthContext';

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
  const [sale, setSale] = useState('');
  const { user } = useAuth();

  // 权限检查函数
  const canViewSalesFilter = user?.role === UserRole.SUPER_ADMIN;
  const canViewAgentFilter = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.FACTORY_SALES;
  const canViewStatusFilter = true; // 所有人都可见
  // 获取销售人员列表（仅超级管理员可见）
  const { data: salesData } = useData(
    user?.role === UserRole.SUPER_ADMIN ? '/api/users/sales' : null
  );
  const salesUsers = (salesData as any)?.users || [];

  // 获取代理商列表（超级管理员和销售可见）
  const { data: agentsData } = useData(
    (user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.FACTORY_SALES)
      ? '/api/agents/assignable' : null
  );
  const agents = (agentsData as any)?.agents || [];

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
            placeholder={isPublicPool ? "搜索客户名称" : "搜索客户名称/联系人/应用领域"}
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

              {/* 客户状态筛选 - 所有人可见 */}
              {canViewStatusFilter && (
                <Col xs={24} sm={12} md={8} lg={6}>
                  <div className="mb-1 text-gray-600 text-sm">客户状态</div>
                  <Select
                    placeholder="选择客户状态"
                    style={{ width: '100%' }}
                    allowClear
                    size={getControlSize()}
                    onChange={(value) => onFilterChange('progress', value)}
                  >
                    <Option value={"初步接触"}>初步接触</Option>
                    <Option value={"正常推进"}>正常推进</Option>
                    <Option value={"禁用"}>禁用</Option>
                  </Select>
                </Col>
              )}

              {/* 关联销售筛选 - 仅超级管理员可见 */}
              {canViewSalesFilter && salesUsers.length > 0 && (
                <Col xs={24} sm={12} md={8} lg={6}>
                  <div className="mb-1 text-gray-600 text-sm">关联销售</div>
                  <Select
                    placeholder="选择关联销售"
                    style={{ width: '100%' }}
                    allowClear
                    size={getControlSize()}
                    value={filters.relatedSalesId}
                    onChange={(value) => {
                      setSale(value);
                      onFilterChange('relatedSalesId', value);
                    }}
                    showSearch
                    optionFilterProp="children"
                  >
                    <Option value="">未关联销售</Option>
                    {salesUsers.map((sales: any) => (
                      <Option key={sales._id} value={sales._id}>
                        {sales.username}
                      </Option>
                    ))}
                  </Select>
                </Col>
              )}

              {/* 关联代理商筛选 - 超级管理员和销售可见 */}
              {canViewAgentFilter && agents.length > 0 && (
                <Col xs={24} sm={12} md={8} lg={6}>
                  <div className="mb-1 text-gray-600 text-sm">关联代理商</div>
                  <Select
                    placeholder="选择关联代理商"
                    style={{ width: '100%' }}
                    allowClear
                    size={getControlSize()}
                    value={filters.relatedAgentId}
                    onChange={(value) => onFilterChange('relatedAgentId', value)}
                    showSearch
                    optionFilterProp="children"
                  >
                    <Option value="">未关联代理商</Option>
                    {agents.filter((it: any) => {
                      console.log('it', it);
                      console.log('sale', sale);
                      if(sale != undefined && sale != ""){
                        return sale == it.relatedSalesId
                      }
                      return true;
                    }).map((agent: any) => (
                      <Option key={agent._id} value={agent._id}>
                        {agent.companyName}
                      </Option>
                    ))}
                  </Select>
                </Col>
              )}
            </Row>
          </Panel>
        </Collapse>
      </Card>
    </motion.div>
  );
};

export default CustomerFilters;