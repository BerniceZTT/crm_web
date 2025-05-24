/**
 * 产品筛选条件组件
 * 提供产品搜索和库存范围筛选功能
 * 优化了响应式布局，防止界面元素溢出
 */
import React from 'react';
import { Input, Button, InputNumber, Collapse } from 'antd';
import { FilterOutlined, SearchOutlined, DownOutlined, UpOutlined, ReloadOutlined } from '@ant-design/icons';
import { useResponsive } from '../../hooks/useResponsive';

const { Search } = Input;

interface ProductFiltersProps {
  keyword: string;
  minStock: number | null;
  maxStock: number | null;
  onSearch: (value: string) => void;
  onMinStockChange: (value: number | null) => void;
  onMaxStockChange: (value: number | null) => void;
  onReset: () => void;
}

const ProductFilters: React.FC<ProductFiltersProps> = ({
  keyword,
  minStock,
  maxStock,
  onSearch,
  onMinStockChange,
  onMaxStockChange,
  onReset
}) => {
  const { isMobile, isTablet, screenWidth } = useResponsive();
  
  // 默认不展开筛选区域
  const [filterExpanded, setFilterExpanded] = React.useState<boolean>(false);

  // 处理重置功能
  const handleReset = () => {
    onSearch('');
    onMinStockChange(null);
    onMaxStockChange(null);
    onReset();
  };

  return (
    <div className="mb-4">
      {/* PC端：改进布局以适应不同宽度 */}
      {!isMobile ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-grow max-w-md mr-2">
            <Search
              placeholder="搜索产品型号或封装型号"
              onSearch={onSearch}
              style={{ width: '100%' }}
              defaultValue={keyword}
              allowClear
              enterButton
            />
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-600 whitespace-nowrap">库存范围:</span>
            <InputNumber
              placeholder="最小值"
              value={minStock}
              onChange={onMinStockChange}
              min={0}
              style={{ width: '100px' }}
              className="mr-1"
            />
            <span className="mx-1">-</span>
            <InputNumber
              placeholder="最大值"
              value={maxStock}
              onChange={onMaxStockChange}
              min={0}
              style={{ width: '100px' }}
            />
          </div>
        </div>
      ) : (
        <>
          {/* 移动端：保持搜索框和过滤器分开 */}
          <div className="mb-3 flex items-center">
            <Search
              placeholder="搜索产品型号或封装型号"
              onSearch={onSearch}
              style={{ width: '100%' }}
              defaultValue={keyword}
              allowClear
              enterButton
            />
          </div>
          
          {/* 改进的移动端筛选器 */}
          <div className="border border-gray-200 rounded bg-gray-50 shadow-sm">
            {/* 可点击的筛选器标题 */}
            <div 
              className="flex items-center justify-between px-3 py-2 cursor-pointer"
              onClick={() => setFilterExpanded(!filterExpanded)}
            >
              <span className="flex items-center text-sm font-medium text-gray-700">
                <FilterOutlined className="mr-1.5" /> 
                库存数量范围筛选
              </span>
              <span className="text-gray-500">
                {filterExpanded ? <UpOutlined /> : <DownOutlined />}
              </span>
            </div>
            
            {/* 展开的筛选内容 */}
            {filterExpanded && (
              <div className="px-3 py-2 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center flex-1">
                    <InputNumber
                      placeholder="最小库存"
                      value={minStock}
                      onChange={onMinStockChange}
                      min={0}
                      controls={false}
                      size="small"
                      style={{ width: '40%' }}
                      className="text-xs"
                    />
                    <span className="mx-1 text-xs text-gray-500">-</span>
                    <InputNumber
                      placeholder="最大库存"
                      value={maxStock}
                      onChange={onMaxStockChange}
                      min={0}
                      controls={false}
                      size="small"
                      style={{ width: '40%' }}
                      className="text-xs"
                    />
                  </div>
                  <Button 
                    size="small"
                    onClick={handleReset}
                    className="ml-2"
                    icon={<ReloadOutlined />}
                  >
                    重置
                  </Button>
                </div>
                
                {/* 实时筛选状态显示 */}
                {(minStock !== null || maxStock !== null) && (
                  <div className="text-xs text-gray-500 mt-1">
                    当前筛选: 
                    {minStock !== null && ` 最小库存 ${minStock}`}
                    {minStock !== null && maxStock !== null && ' 至'}
                    {maxStock !== null && ` 最大库存 ${maxStock}`}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ProductFilters;