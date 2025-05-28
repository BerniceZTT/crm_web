/**
 * 客户表单组件
 * 用于创建和编辑客户信息
 */
import React, { useEffect } from 'react';
import { Form, Input, Select } from 'antd';
import { 
  Customer,
  CustomerNature, 
  CustomerImportance, 
  CustomerProgress,
  Product,
  UserBrief,
  AgentBrief, 
  UserRole
} from '../../shared/types';

const { Option } = Select;

interface CustomerFormProps {
  form: any;
  currentCustomer: Partial<Customer> | null;
  products: Product[];
  salesUsers: UserBrief[];
  availableAgents: AgentBrief[];
  userRole: UserRole | undefined;
  userId: string | undefined;
  onSalesChange: (salesId: string) => void;
}

const CustomerForm: React.FC<CustomerFormProps> = ({
  form,
  currentCustomer,
  products,
  salesUsers,
  availableAgents,
  userRole,
  userId,
  onSalesChange
}) => {
  // 判断用户角色
  const isFactorySales = userRole === UserRole.FACTORY_SALES;
  const isAgent = userRole === UserRole.AGENT;

  return (
    <Form
      form={form}
      layout="vertical"
      name="customerForm"
    >
      <Form.Item
        name="name"
        label="客户名称"
        rules={[{ required: true, message: '请输入客户名称' }]}
      >
        <Input placeholder="请输入客户名称" disabled={currentCustomer? userRole != UserRole.SUPER_ADMIN : false}/>
      </Form.Item>
      
      <Form.Item
        name="nature"
        label="客户性质"
        rules={[{ required: true, message: '请选择客户性质' }]}
      >
        <Select placeholder="请选择客户性质">
          {Object.values(CustomerNature).map(nature => (
            <Option key={nature} value={nature}>{nature}</Option>
          ))}
        </Select>
      </Form.Item>
      
      <Form.Item
        name="importance"
        label="客户重要程度"
        rules={[{ required: true, message: '请选择客户重要程度' }]}
      >
        <Select placeholder="请选择客户重要程度">
          {Object.values(CustomerImportance).map(importance => (
            <Option key={importance} value={importance}>{importance}</Option>
          ))}
        </Select>
      </Form.Item>
      
      <Form.Item
        name="applicationField"
        label="应用领域"
        rules={[{ required: true, message: '请输入应用领域' }]}
      >
        <Input placeholder="请输入应用领域" />
      </Form.Item>
      
      <Form.Item
        name="productNeeds"
        label="产品需求"
        rules={[{ required: true, message: '请选择产品需求' }]}
      >
        <Select
          mode="multiple"
          placeholder="请选择产品需求"
          optionFilterProp="children"
          showSearch
        >
          {products.map((product: Product) => (
            <Option key={product._id} value={product._id}>
              {product.modelName} ({product.packageType})
            </Option>
          ))}
        </Select>
      </Form.Item>
      
      <Form.Item
        name="contactPerson"
        label="联系人"
        rules={[{ required: true, message: '请输入联系人' }]}
      >
        <Input placeholder="请输入联系人" disabled={currentCustomer? userRole != UserRole.SUPER_ADMIN : false}/>
      </Form.Item>
      
      <Form.Item
        name="contactPhone"
        label="联系方式"
        rules={[{ required: true, message: '请输入联系方式' }]}
      >
        <Input placeholder="请输入联系方式" disabled={currentCustomer? userRole != UserRole.SUPER_ADMIN : false}/>
      </Form.Item>
      
      <Form.Item
        name="address"
        label="公司地址"
        rules={[{ required: true, message: '请输入公司地址' }]}
      >
        <Input placeholder="请输入公司地址" disabled={currentCustomer? userRole != UserRole.SUPER_ADMIN : false}/>
      </Form.Item>
      
      <Form.Item
        name="progress"
        label="客户进展"
        rules={[{ required: true, message: '请选择客户进展' }]}
        formatter={(value) => {
          if(value === CustomerProgress.PUBLIC_POOL){
            form.setFieldValue('progress', null);
            return "2323232"
          }
          return value
        }}
      >
        <Select placeholder="请选择客户进展">
          {Object.values(CustomerProgress)
            .filter(progress => progress !== CustomerProgress.PUBLIC_POOL)
            .map(progress => (
              <Option key={progress} value={progress}>{progress}</Option>
            ))
          }
        </Select>
      </Form.Item>
      
      <Form.Item
        name="annualDemand"
        label="年需求量(片)"
        rules={[{ required: true, message: '请输入年需求量' }]}
      >
        <Input 
          type="number" 
          placeholder="请输入年需求量"
          onChange={e => {
            // 确保输入的是数字
            const value = e.target.value;
            form.setFieldsValue({ annualDemand: value ? Number(value) : 0 });
          }}
        />
      </Form.Item>
      
      <Form.Item
        name="relatedSalesId"
        label="关联销售"
        rules={[{ required: true, message: '请选择关联销售' }]}
        formatter={(value) => {
          if(isFactorySales){
              form.setFieldValue('relatedSalesId', value)
              return userId
            } else {
              return value
            }
        }}
      >
        <Select 
          placeholder="请选择关联销售"
          disabled={isFactorySales || isAgent} // 如果是销售角色，不能更改关联销售
          onChange={(value: string | string[]) => {
            form.setFieldValue('relatedSalesId', value);
            form.setFieldValue('relatedAgentId', null);
            onSalesChange(typeof value === 'string' ? value : '');
          }}
        >
          {salesUsers.map((sale: UserBrief) => (
            <Option key={sale._id} value={sale._id}>{sale.username}</Option>
          ))}
        </Select>
      </Form.Item>
      
      <Form.Item
        name="relatedAgentId"
        label="关联代理商"
      >
        <Select 
          placeholder="请选择关联代理商" 
          allowClear
          showSearch 
          optionFilterProp="children"
          disabled={isAgent} 
        >
          {availableAgents.map((agent: AgentBrief) => (
            <Option key={agent._id} value={agent._id}>
              {agent.companyName} ({agent.contactPerson})
            </Option>
          ))}
        </Select>
      </Form.Item>
    </Form>
  );
};

export default CustomerForm;