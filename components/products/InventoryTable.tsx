/**
 * 库存记录表格组件
 * 展示产品库存变动记录，支持响应式布局和增强的视觉设计
 * 组件内部实现搜索过滤功能，优化响应式布局防止界面溢出
 */
import React, { useMemo, useState, useEffect } from 'react';
import { Table, Typography, Input, Select, Tag, Empty, Dropdown, Button, DatePicker, Space, MenuProps } from 'antd';
import { SearchOutlined, FilterOutlined, DownOutlined, CalendarOutlined, ReloadOutlined } from '@ant-design/icons';
import { getInventoryRecordColumns } from '../../utils/productUtils';
import { useResponsive } from '../../hooks/useResponsive';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

// 加载dayjs插件
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const { RangePicker } = DatePicker;
const { Option } = Select;

interface InventoryRecord {
  _id: string;
  productId: string;
  modelName: string;
  packageType: string;
  operationType: 'in' | 'out';
  quantity: number;
  reason?: string;
  operator: string;
  operatorId: string;
  operationTime: Date;
}

interface InventoryTableProps {
  records: InventoryRecord[];
}

// 时间筛选类型定义
type TimeFilterType = '1day' | '7days' | '30days' | '1year' | 'custom';

// 筛选状态接口
interface FilterState {
  operationType: string;
  modelName: string;
  days?: number;
  dateRange?: [string, string];
}

// 默认筛选状态
const defaultFilterState: FilterState = {
  operationType: 'all',
  modelName: '',
  days: 30, // 默认显示最近30天的记录
  dateRange: undefined
};

const InventoryTable: React.FC<InventoryTableProps> = ({
  records
}) => {
  const { isMobile, isTablet, filterColumnsByDevice, getTableSize, screenWidth } = useResponsive();
  
  // 筛选状态
  const [filters, setFilters] = useState<FilterState>(defaultFilterState);
  
  // 时间筛选状态
  const [timeFilterType, setTimeFilterType] = useState<TimeFilterType>('30days');
  const [customDateRange, setCustomDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  
  const columns = useMemo(() => {
    return getInventoryRecordColumns();
  }, []);

  // 过滤后的记录数据
  const filteredRecords = useMemo(() => {
    console.log('筛选条件变化，重新过滤记录:', filters);
    
    return records.filter(record => {
      // 1. 型号筛选
      const modelNameMatch = !filters.modelName || 
        record.modelName.toLowerCase().includes(filters.modelName.toLowerCase());
      
      // 2. 操作类型筛选
      const operationTypeMatch = filters.operationType === 'all' || 
        record.operationType === filters.operationType;
      
      // 3. 时间筛选
      let timeMatch = true;
      
      try {
        // 创建记录日期对象
        const recordDate = dayjs(record.operationTime);
        
        // 如果记录日期无效，则记录日志并跳过该记录
        if (!recordDate.isValid()) {
          console.warn('无效的记录日期:', record.operationTime);
          return false;
        }
        
        // 如果有自定义日期范围
        if (filters.dateRange && filters.dateRange.length === 2) {
          const startDate = dayjs(filters.dateRange[0]).startOf('day');
          const endDate = dayjs(filters.dateRange[1]).endOf('day'); // 设为当天结束时间 (23:59:59)
          
          // 使用 isSameOrAfter 和 isSameOrBefore 来包含边界值
          timeMatch = recordDate.isSameOrAfter(startDate) && recordDate.isSameOrBefore(endDate);
        } 
        // 否则使用天数筛选
        else if (filters.days !== undefined) {
          const cutoffDate = dayjs().subtract(filters.days, 'day').startOf('day');
          
          // 使用 isSameOrAfter 来包含边界日期
          timeMatch = recordDate.isSameOrAfter(cutoffDate);
        }
      } catch (error) {
        console.error('日期过滤发生错误:', error);
        timeMatch = true; // 错误时不过滤
      }
      
      return modelNameMatch && operationTypeMatch && timeMatch;
    });
  }, [records, filters]);

  // 处理产品型号搜索
  const handleRecordSearch = (value: string) => {
    setFilters(prev => ({
      ...prev,
      modelName: value
    }));
  };

  // 处理操作类型筛选
  const handleOperationTypeChange = (value: string) => {
    setFilters(prev => ({
      ...prev,
      operationType: value
    }));
  };

  // 统一的时间筛选处理函数 - 同时处理PC端和移动端
  const handleTimeFilterChange = (type: TimeFilterType) => {
    console.log(`切换时间筛选类型: ${type}`);
    
    // 更新本地状态
    setTimeFilterType(type);
    
    // 根据类型更新筛选状态
    if (type === 'custom') {
      // 如果已有自定义日期范围且有效，使用它
      if (customDateRange && customDateRange.length === 2 && 
          customDateRange[0].isValid() && customDateRange[1].isValid()) {
        setFilters(prev => ({
          ...prev,
          dateRange: [
            customDateRange[0].format('YYYY-MM-DD'),
            customDateRange[1].format('YYYY-MM-DD')
          ],
          days: undefined
        }));
      }
      // 否则不触发筛选，等待用户选择日期
      return;
    }
    
    // 对于预设的时间范围，清除自定义日期筛选
    const daysMap: Record<TimeFilterType, number> = {
      '1day': 1,
      '7days': 7,
      '30days': 30,
      '1year': 365,
      'custom': 0  // 自定义时间不应该走这个分支
    };
    
    const days = daysMap[type];
    
    setFilters(prev => ({
      ...prev,
      days,
      dateRange: undefined
    }));
  };

  // 处理自定义日期变化
  const handleCustomDateChange = (dates: any) => {
    if (!dates || !dates[0] || !dates[1]) {
      console.log('自定义日期无效:', dates);
      return;
    }
    
    console.log('自定义日期变化:', dates.map((d: dayjs.Dayjs) => d.format('YYYY-MM-DD')));
    
    // 更新本地状态
    setCustomDateRange(dates);
    setTimeFilterType('custom');
    
    // 更新筛选状态
    setFilters(prev => ({
      ...prev,
      dateRange: [
        dates[0].format('YYYY-MM-DD'),
        dates[1].format('YYYY-MM-DD')
      ],
      days: undefined
    }));
  };

  // 重置所有筛选条件
  const handleResetAllFilters = () => {
    setFilters(defaultFilterState);
    setTimeFilterType('30days');
    setCustomDateRange(null);
  };

  // 预设时间选项配置
  const timeFilterOptions = [
    { key: '1day', label: '最近1天', days: 1 },
    { key: '7days', label: '最近1周', days: 7 },
    { key: '30days', label: '最近30天', days: 30 },
    { key: '1year', label: '最近1年', days: 365 },
  ];

  // 移动端时间筛选菜单项
  const timeFilterItems: MenuProps['items'] = timeFilterOptions.map(option => ({
    key: option.key,
    label: option.label
  }));

  // 移动端菜单点击事件处理
  const handleTimeMenuClick: MenuProps['onClick'] = (e) => {
    handleTimeFilterChange(e.key as TimeFilterType);
  };
  
  // 移动端操作类型筛选菜单项
  const operationTypeItems: MenuProps['items'] = [
    {
      key: 'all',
      label: '全部操作'
    },
    {
      key: 'in',
      label: <span><Tag color="green" className="m-0">入库</Tag></span>
    },
    {
      key: 'out',
      label: <span><Tag color="red" className="m-0">出库</Tag></span>
    }
  ];
  
  // 移动端操作类型菜单点击事件处理
  const handleOperationTypeMenuClick: MenuProps['onClick'] = (e) => {
    handleOperationTypeChange(e.key);
  };

  // 获取显示的时间筛选文本
  const renderTimeRangeText = () => {
    // 对于自定义日期范围，显示日期范围
    if (timeFilterType === 'custom' && customDateRange && 
        customDateRange.length === 2 && 
        customDateRange[0].isValid() && 
        customDateRange[1].isValid()) {
      return `${customDateRange[0].format('YYYY/MM/DD')} - ${customDateRange[1].format('YYYY/MM/DD')}`;
    }
    
    // 对于预设选项，显示对应文本
    const optionMap: Record<Exclude<TimeFilterType, 'custom'>, string> = {
      '1day': '最近1天',
      '7days': '最近1周',
      '30days': '最近30天',
      '1year': '最近1年'
    };
    
    return optionMap[timeFilterType as Exclude<TimeFilterType, 'custom'>] || '最近30天';
  };

  // 获取操作类型筛选按钮文本
  const getFilterButtonText = () => {
    if (filters.operationType === 'in') return '入库';
    if (filters.operationType === 'out') return '出库';
    return '全部操作';
  };

  // 空状态组件
  const customEmpty = (
    <Empty 
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description="暂无库存记录" 
    />
  );

  // PC端渲染改进版的筛选组件 - 优化为单行布局
  const renderPCFilters = () => {
    const defaultFilterWidth = 140;
    
    return (
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-grow mr-2" style={{ maxWidth: '260px' }}>
          <Input
            prefix={<SearchOutlined className="text-gray-400" />}
            placeholder="搜索型号"
            value={filters.modelName}
            onChange={(e) => handleRecordSearch(e.target.value)}
            allowClear
            size="middle"
          />
        </div>
        
        <div className="flex items-center mr-2">
          <Select 
            value={filters.operationType}
            onChange={handleOperationTypeChange}
            size="middle"
            style={{ width: defaultFilterWidth }}
          >
            <Option value="all">全部操作</Option>
            <Option value="in">
              <Tag color="green" className="m-0">入库</Tag>
            </Option>
            <Option value="out">
              <Tag color="red" className="m-0">出库</Tag>
            </Option>
          </Select>
        </div>
        
        <div className="flex items-center mr-2">
          <Select
            value={timeFilterType}
            onChange={(value) => handleTimeFilterChange(value as TimeFilterType)}
            style={{ width: defaultFilterWidth }}
            size="middle"
            dropdownMatchSelectWidth={false}
            suffixIcon={<CalendarOutlined />}
          >
            {timeFilterOptions.map(option => (
              <Option key={option.key} value={option.key}>
                {option.label}
              </Option>
            ))}
            <Option value="custom">自定义时间</Option>
          </Select>
        </div>
        
        {timeFilterType === 'custom' && (
          <div className="mr-2" style={{ minWidth: '220px' }}>
            <RangePicker
              value={customDateRange}
              onChange={handleCustomDateChange}
              format="YYYY/MM/DD"
              allowClear={false}
              size="middle"
              placeholder={['开始日期', '结束日期']}
              style={{ width: '100%' }}
              // 设置弹出层在容器内定位，避免超出屏幕
              getPopupContainer={(trigger) => trigger.parentElement || document.body}
              // 确保弹出层不超出窗口边界
              popupStyle={{ zIndex: 1050 }}
            />
          </div>
        )}
        
        <Button 
          icon={<ReloadOutlined />}
          onClick={handleResetAllFilters}
          type="default"
        >
          重置筛选
        </Button>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-2 md:p-4 overflow-hidden">
      <div className="mb-4">
        {isMobile ? (
          <div className="flex flex-col w-full">
            <div className="flex items-center">
              <Input
                prefix={<SearchOutlined className="text-gray-400" />}
                placeholder="搜索型号"
                value={filters.modelName}
                onChange={(e) => handleRecordSearch(e.target.value)}
                allowClear
                size="middle"
                className="flex-1"
              />
              <Dropdown
                menu={{
                  items: operationTypeItems,
                  onClick: handleOperationTypeMenuClick
                }}
                trigger={['click']}
              >
                <Button 
                  type="default"
                  size="middle"
                  className={`ml-1 px-3 ${filters.operationType !== 'all' ? 'bg-blue-50' : ''}`}
                  icon={<FilterOutlined />}
                >
                  <span className="ml-1">{getFilterButtonText()}</span>
                  <DownOutlined className="ml-1" />
                </Button>
              </Dropdown>
            </div>

            <Dropdown
              menu={{
                items: timeFilterItems,
                onClick: handleTimeMenuClick
              }}
              trigger={['click']}
            >
              <Button 
                type="default"
                size="middle"
                className="w-full mt-2"
                icon={<CalendarOutlined />}
              >
                <span className="ml-1">{renderTimeRangeText()}</span>
                <DownOutlined className="ml-1" />
              </Button>
            </Dropdown>
            
            <Button 
              icon={<ReloadOutlined />}
              onClick={handleResetAllFilters}
              className="mt-2"
              type="default"
              block
            >
              重置全部筛选
            </Button>
          </div>
        ) : (
          renderPCFilters()
        )}
      </div>
      
      <div className="w-full overflow-x-auto">
        <Table
          columns={columns}
          dataSource={filteredRecords}
          rowKey="_id"
          locale={{ emptyText: customEmpty }}
          className="inventory-record-table"
          pagination={{
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            defaultPageSize: 10,
            showTotal: (total) => `共 ${total} 条记录`,
            size: isMobile ? "small" : "default",
            className: "mt-4",
          }}
          size={getTableSize()}
          scroll={undefined}
        />
      </div>
      
      <style jsx global>{`
        .inventory-record-table .ant-table-thead > tr > th {
          background-color: #f5f7fa;
          font-weight: 600;
          padding: 8px 4px;
          white-space: nowrap;
        }
        
        .inventory-record-table .ant-table-tbody > tr > td {
          padding: 6px 4px;
          white-space: nowrap;
        }
        
        .inventory-record-table .ant-table-tbody > tr:hover > td {
          background-color: #f0f7ff;
        }
        
        .inventory-record-table .ant-table-row-even {
          background-color: #fafbfc;
        }
        
        @media (max-width: 767px) {
          .inventory-record-table .ant-table-thead > tr > th {
            padding: 8px 4px;
            font-size: 14px;
          }
          
          .inventory-record-table .ant-table-tbody > tr > td {
            padding: 8px 4px;
            font-size: 14px;
          }
          
          .ant-picker-input > input {
            font-size: 14px !important;
          }
          
          .ant-picker-range-separator {
            padding: 0 4px !important;
          }
          
          .ant-btn, .ant-input, .ant-select {
            font-size: 14px !important;
          }
          
          .ant-btn > .anticon + span, 
          .ant-btn > span + .anticon {
            margin-left: 6px;
            vertical-align: middle;
          }
        }
      `}</style>
    </div>
  );
};

export default InventoryTable;