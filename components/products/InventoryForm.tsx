/**
 * 库存操作表单组件
 * 用于产品入库和出库操作
 */
import React from 'react';
import { Form, Input, InputNumber, Radio } from 'antd';
import { Product } from '../../shared/types';

interface InventoryFormProps {
  form: any;
  currentProduct: Product | null;
}

const InventoryForm: React.FC<InventoryFormProps> = ({
  form,
  currentProduct,
}) => {
  return (
    <Form
      form={form}
      layout="vertical"
    >
      <Form.Item
        name="modelName"
        label="产品型号"
      >
        <Input disabled />
      </Form.Item>
      
      <Form.Item
        name="packageType"
        label="封装型号"
      >
        <Input disabled />
      </Form.Item>
      
      <Form.Item
        name="currentStock"
        label="当前库存"
      >
        <InputNumber disabled style={{ width: '100%' }} />
      </Form.Item>
      
      <Form.Item
        name="operation"
        label="操作类型"
        rules={[{ required: true, message: '请选择操作类型' }]}
        initialValue="in"
      >
        <Radio.Group>
          <Radio value="in">入库</Radio>
          <Radio value="out">出库</Radio>
        </Radio.Group>
      </Form.Item>
      
      <Form.Item
        name="quantity"
        label="操作数量"
        rules={[
          { required: true, message: '请输入操作数量' },
          { type: 'number', min: 1, message: '数量必须大于0' },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (getFieldValue('operation') === 'out' && 
                  currentProduct && value > currentProduct.stock) {
                return Promise.reject(new Error(`出库数量不能超过当前库存 (${currentProduct.stock})`));
              }
              return Promise.resolve();
            },
          }),
        ]}
      >
        <InputNumber 
          min={1} 
          style={{ width: '100%' }} 
          max={form.getFieldValue('operation') === 'out' ? 
               form.getFieldValue('currentStock') : undefined}
        />
      </Form.Item>
      
      <Form.Item
        name="remark"
        label="备注"
      >
        <Input.TextArea rows={4} placeholder="请输入备注信息" />
      </Form.Item>
    </Form>
  );
};

export default InventoryForm;