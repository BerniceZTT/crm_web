/**
 * 产品管理工具函数
 * 包含数据格式化、表格列配置等功能函数
 */
import React, { useState } from 'react';
import { Tag, Button, Space, Badge, Popconfirm } from 'antd';
import { 
  EyeOutlined, 
  EditOutlined, 
  ImportOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  InfoCircleOutlined,
  DownOutlined,
  UpOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { Product, PricingTier } from '../shared/types';
import ResponsiveTooltip from '../components/common/ResponsiveTooltip';

// 标准化阶梯定价显示
export const PRICING_TIERS = [
  { min: 1, max: 1000, display: '1-1k', value: 1 },
  { min: 1000, max: 10000, display: '1k-10k', value: 1000 },
  { min: 10000, max: 50000, display: '10k-50k', value: 10000 },
  { min: 50000, max: 100000, display: '50k-100k', value: 50000 },
  { min: 100000, max: 500000, display: '500k-1M', value: 100000 },
  { min: 500000, max: 1000000, display: '1M-5M', value: 500000 },
  { min: 1000000, max: null, display: '大于5M', value: 1000000 }
];

// 格式化数字为k/M表示
export const formatNumber = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
};

// 渲染库存标签
export const renderStockTag = (stock: number) => {
  let color = 'green';
  if (stock < 50) {
    color = 'red';
  } else if (stock < 200) {
    color = 'orange';
  }

  return <Tag color={color}>{stock}</Tag>;
};

// 价格详情可折叠组件
export const PriceDetail: React.FC<{ 
  pricing: PricingTier[], 
  needRed: boolean 
}> = ({ pricing, needRed }) => {
  const [expanded, setExpanded] = useState(true);

  if (!pricing || pricing.length === 0) {
    return <span style={{ color: needRed ? '#ff4d4f' : 'inherit' }}>暂无价格</span>;
  }

  // 计算最低价格
  const minPrice = pricing.reduce((min, tier) => 
    tier.price < min ? tier.price : min, 
    pricing[0]?.price || 0
  );

  // 根据数量排序价格区间
  const sortedPricing = [...pricing].sort((a, b) => a.quantity - b.quantity);

  // 动态文字颜色
  const textStyle = {
    color: needRed ? '#ff4d4f' : 'inherit',
  };

  return (
    <div className="price-detail" style={textStyle}>
      <div className="flex items-center">
        <span className="font-medium mr-2">¥{minPrice.toFixed(2)}</span>
        <Button 
          type="link" 
          size="small" 
          onClick={() => setExpanded(!expanded)} 
          className="p-0"
          icon={expanded ? <UpOutlined /> : <DownOutlined />}
          style={textStyle}
        >
          {expanded ? '收起' : '详情'}
        </Button>
      </div>

      {expanded && (
        <div className="mt-1 border-t pt-1">
          {sortedPricing.map((tier, index) => {
            const tierInfo = PRICING_TIERS.find(t => t.value === tier.quantity);
            const displayText = tierInfo ? tierInfo.display : `${formatNumber(tier.quantity)}+`;

            return (
              <div key={index} className="flex justify-between text-xs py-1">
                <span>¥{displayText}:</span>
                <span className="font-medium">¥{tier.price.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// 获取产品表格列配置
export const getProductColumns = (
  hasEditPermission: boolean,
  isSuperAdmin: boolean,
  showModal: (product?: Product, isViewMode?: boolean) => void,
  showInventoryModal: (product: Product) => void,
  handleDelete: (id: string) => void,
) => {
  const renderRedText = (text: string, record: Product) => {
    return (
      <span style={{ color: record.stock <= 5000 ? '#ff4d4f' : 'inherit' }}>
        {text}
      </span>
    );
  };

  return [
    {
      title: '产品型号',
      dataIndex: 'modelName',
      key: 'modelName',
      render: (text: string, record: Product) => renderRedText(text, record),
      sorter: (a: Product, b: Product) => a.modelName.localeCompare(b.modelName),
    },
    {
      title: '封装型号',
      dataIndex: 'packageType',
      key: 'packageType',
      render: (text: string, record: Product) => renderRedText(text, record),
      sorter: (a: Product, b: Product) => a.packageType.localeCompare(b.packageType)
    },
    {
      title: '库存数量',
      dataIndex: 'stock',
      key: 'stock',
      render: renderStockTag,
      sorter: (a: Product, b: Product) => a.stock - b.stock
    },
    {
      title: '价格详情',
      dataIndex: 'pricing',
      key: 'pricing',
      render: (pricing: PricingTier[], record: Product) => <PriceDetail pricing={pricing} needRed={record.stock<=5000}/>
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Product) => (
        <Space size="small">
          <ResponsiveTooltip title="查看详情">
            <Button 
              icon={<EyeOutlined />} 
              onClick={() => showModal(record, true)} 
              size="small"
              type="link"
            />
          </ResponsiveTooltip>

          {hasEditPermission && (
            <ResponsiveTooltip title="库存管理">
              <Button 
                icon={<ImportOutlined />} 
                onClick={() => showInventoryModal(record)} 
                size="small"
                type="link"
              />
            </ResponsiveTooltip>
          )}

          {hasEditPermission && (
            <ResponsiveTooltip title="编辑">
              <Button 
                icon={<EditOutlined />} 
                onClick={() => showModal(record, false)} 
                size="small"
                type="link"
              />
            </ResponsiveTooltip>
          )}
          {
            isSuperAdmin &&  <Popconfirm
            title="确定要删除此代产品吗？"
            onConfirm={() => handleDelete(record._id!)}
            okText="是"
            cancelText="否"
          >
            <ResponsiveTooltip title="删除">
              <Button 
                icon={<DeleteOutlined />} 
                size="small"
                type="link"
                danger
              />
            </ResponsiveTooltip>
          </Popconfirm>
          }
        </Space>
      )
    }
  ];
};

// 获取库存记录表格列配置
export const getInventoryRecordColumns = () => {
  return [
    {
      title: '产品型号',
      dataIndex: 'modelName',
      key: 'modelName',
      ellipsis: true,
      responsive: ['xs', 'sm', 'md', 'lg'],
      render: (text: string) => (
        <div className="font-medium text-xs md:text-sm">{text}</div>
      ),
      width: 120
    },
    {
      title: '封装型号',
      dataIndex: 'packageType',
      key: 'packageType',
      ellipsis: true,
      responsive: ['xs', 'sm', 'md', 'lg'],
      render: (text: string) => (
        <Tag color="blue" style={{ fontWeight: 'normal' }} className="text-xs md:text-sm">{text}</Tag>
      ),
      width: 80
    },
    {
      title: '类型',
      dataIndex: 'operationType',
      key: 'operationType',
      width: 60,
      responsive: ['xs', 'sm', 'md', 'lg'],
      render: (type: string) => (
        type === 'in' 
          ? <Tag color="green" className="text-xs md:text-sm px-1">入库</Tag>
          : <Tag color="red" className="text-xs md:text-sm px-1">出库</Tag>
      )
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 60,
      responsive: ['xs', 'sm', 'md', 'lg'],
      render: (num: number, record: any) => {
        const color = record.operationType === 'in' ? 'text-green-600' : 'text-red-600';
        const prefix = record.operationType === 'in' ? '+' : '-';
        return <span className={`font-medium ${color} text-xs md:text-sm`}>{prefix}{num}</span>;
      }
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      responsive: ['xs', 'sm', 'md', 'lg'],
      width: 70,
      render: (text: string) => {
        if (!text || text === '-') return <span className="text-gray-400">-</span>;

        return (
          <ResponsiveTooltip title={text} placement="topLeft">
            <div className="flex items-center text-gray-600 text-xs md:text-sm">
              <InfoCircleOutlined className="text-gray-400" />
              {!text || text === '-' ? '' : <span className="ml-1 hidden sm:inline">{text.length > 8 ? `${text.substring(0, 8)}...` : text}</span>}
            </div>
          </ResponsiveTooltip>
        );
      }
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      responsive: ['xs', 'sm', 'md', 'lg'],
      width: 70,
      render: (text: string) => (
        <div className="text-gray-700 text-xs md:text-sm">{text}</div>
      )
    },
    {
      title: '时间',
      dataIndex: 'operationTime',
      key: 'operationTime',
      responsive: ['xs', 'sm', 'md', 'lg'],
      // 增加宽度以适应时间内容
      width: 100,
      ellipsis: true,
      render: (time: string) => {
        const date = new Date(time);
        const today = new Date();
        const isToday = date.toDateString() === today.toDateString();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = date.toDateString() === yesterday.toDateString();

        // 格式化完整时间用于tooltip显示
        const fullTimeDisplay = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;

        // 在移动端使用更紧凑的格式
        if (window.innerWidth < 768) {
          // 对于今天的记录只显示时间
          if (isToday) {
            return (
              <ResponsiveTooltip title={fullTimeDisplay}>
                <span className="text-xs">{date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </ResponsiveTooltip>
            );
          } 
          // 对于昨天的记录显示"昨天"
          else if (isYesterday) {
            return (
              <ResponsiveTooltip title={fullTimeDisplay}>
                <span className="text-xs">昨天 {date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </ResponsiveTooltip>
            );
          }
          // 对于其他日期只显示月/日
          else {
            const monthDay = date.toLocaleDateString().split('/').slice(1).join('/');
            return (
              <ResponsiveTooltip title={fullTimeDisplay}>
                <span className="text-xs">{monthDay}</span>
              </ResponsiveTooltip>
            );
          }
        }

        // 桌面端显示更紧凑的时间
        let displayText;
        if (isToday) {
          displayText = `今天 ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        } else if (isYesterday) {
          displayText = `昨天 ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        } else {
          // 对于年份是当前年的日期，不显示年份
          const currentYear = new Date().getFullYear();
          const recordYear = date.getFullYear();

          if (recordYear === currentYear) {
            const monthDay = date.toLocaleDateString().split('/').slice(1).join('/');
            displayText = `${monthDay} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
          } else {
            displayText = fullTimeDisplay;
          }
        }

        return (
          <ResponsiveTooltip title={fullTimeDisplay}>
            <div className="text-gray-600 text-sm whitespace-nowrap overflow-hidden text-ellipsis">
              {displayText}
            </div>
          </ResponsiveTooltip>
        );
      }
    }
  ];
};

// 整理产品表单数据
export const prepareProductFormData = (values: any) => {
  // 构建阶梯价格
  const pricing: PricingTier[] = [];
  for (let i = 0; i < 7; i++) {
    // 使用固定的阶梯数量值
    const quantity = PRICING_TIERS[i].value;
    const price = values[`price_${i}`];

    if (price !== undefined) {
      pricing.push({ quantity, price });
    }
  }

  // 移除阶梯价格字段
  const productData = { ...values };
  for (let i = 0; i < 7; i++) {
    delete productData[`quantity_${i}`];
    delete productData[`price_${i}`];
  }

  // 添加阶梯价格数组
  productData.pricing = pricing;

  return productData;
};