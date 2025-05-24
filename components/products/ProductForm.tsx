/**
 * 产品表单组件
 * 用于新增和编辑产品信息
 */
import React from 'react';
import { Form, Input, InputNumber, Divider, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { Product } from '../../shared/types';
import { PRICING_TIERS, formatNumber } from '../../utils/productUtils';

interface ProductFormProps {
  form: any;
  currentProduct: Partial<Product> | null;
  viewMode: boolean;
}

const ProductForm: React.FC<ProductFormProps> = ({
  form,
  currentProduct,
  viewMode,
}) => {
  return (
    <Form
      form={form}
      layout="vertical"
      disabled={viewMode}
    >
      {/* 将grid布局改为flex布局，使每个字段独占一行 */}
      <div className="flex flex-col gap-2">
        <Form.Item
          name="modelName"
          label="产品型号名称"
          rules={[{ required: true, message: '请输入产品型号名称' }]}
          className="mb-2"
        >
          <Input placeholder="请输入产品型号名称" />
        </Form.Item>
        
        <Form.Item
          name="packageType"
          label="封装型号"
          rules={[{ required: true, message: '请输入封装型号' }]}
          className="mb-2"
        >
          <Input placeholder="请输入封装型号" />
        </Form.Item>
        
        <Form.Item
          name="stock"
          label={
            <span>
              库存数量
              {!!currentProduct && (
                <Tooltip title="库存数量只能通过入库/出库操作修改">
                  <InfoCircleOutlined className="ml-1 text-gray-400" />
                </Tooltip>
              )}
            </span>
          }
          rules={[{ required: !currentProduct, message: '请输入库存数量' }]}
          className="mb-2"
        >
          {!!currentProduct ? (
            <div>
              <div className="flex items-center">
                <InputNumber 
                  min={0} 
                  style={{ width: '100%' }} 
                  disabled={true}
                  defaultValue={form.getFieldValue('stock') ?? currentProduct?.stock ?? 0}
                />
              </div>
              <div className="text-gray-500 text-xs mt-1">
                库存数量只能通过入库/出库操作进行修改
              </div>
            </div>
          ) : (
            <InputNumber 
              min={0} 
              placeholder="请输入库存数量" 
              style={{ width: '100%' }} 
            />
          )}
        </Form.Item>
      </div>
      
      <Divider orientation="left">阶梯定价</Divider>
      
      {/* 修改这里：从grid布局改为flex布局，确保每个阶梯单独一行 */}
      <div className="flex flex-col gap-2">
        {PRICING_TIERS.map((tier, index) => (
          <div key={index} className="border border-gray-200 rounded p-2 bg-gray-50">
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-700 font-medium">
                {tier.display}
                <Tooltip title={`${formatNumber(tier.min)} - ${tier.max ? formatNumber(tier.max) : '∞'} 片`}>
                  <InfoCircleOutlined className="ml-1 text-gray-400" />
                </Tooltip>
              </span>
              
              <Form.Item
                name={`quantity_${index}`}
                initialValue={tier.value}
                className="m-0"
                hidden={true}
              >
                <InputNumber />
              </Form.Item>
            </div>
            
            <Form.Item
              name={`price_${index}`}
              label="单价(元/片)"
              rules={[{ required: true, message: '请输入单价' }]}
              className="mb-0"
            >
              <InputNumber
                min={0.01}
                step={0.01}
                precision={2}
                placeholder="输入单价"
                style={{ width: '100%' }}
                formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={value => value!.replace(/\¥\s?|(,*)/g, '')}
              />
            </Form.Item>
          </div>
        ))}
      </div>
    </Form>
  );
};

export default ProductForm;