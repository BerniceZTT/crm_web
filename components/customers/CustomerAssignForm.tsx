/**
 * 客户分配表单组件
 * 用于分配客户给销售和代理商
 */
import React from 'react';
import { Form, Select, Alert } from 'antd';
import { 
  Customer,
  UserBrief,
  AgentBrief, 
  UserRole
} from '../../shared/types';

const { Option } = Select;

interface CustomerAssignFormProps {
  form: any;
  currentCustomer: Partial<Customer> | null;
  salesUsers: UserBrief[];
  availableAgents: AgentBrief[];
  userRole: UserRole | undefined;
  onSalesChange: (salesId: string) => void;
}

const CustomerAssignForm: React.FC<CustomerAssignFormProps> = ({
  form,
  currentCustomer,
  salesUsers,
  availableAgents,
  userRole,
  onSalesChange
}) => {
  // 判断用户角色
  const isFactorySales = userRole === UserRole.FACTORY_SALES;
  const isAgent = userRole === UserRole.AGENT;

  return (
    <Form
      form={form}
      layout="vertical"
      name="assignForm"
      requiredMark={true}
    >
      <Alert 
        message="请选择要分配的销售" 
        type="info" 
        showIcon 
        style={{ marginBottom: '16px' }} 
      />
      
      <Form.Item
        name="salesId"
        label="关联销售"
        rules={[{ required: true, message: '请选择关联销售' }]}
      >
        <Select 
          placeholder="请选择关联销售"
          disabled={isFactorySales || isAgent} // 如果是销售角色，不能更改关联销售
          onChange={(value: string) => {
            form.setFieldValue('salesId', value);
            form.setFieldValue('agentId', null);
            onSalesChange(value);
          }}
        >
          {salesUsers.map((sale: UserBrief) => (
            <Option key={sale._id} value={sale._id}>{sale.username}</Option>
          ))}
        </Select>
      </Form.Item>
      
      <Form.Item
        name="agentId"
        label="关联代理商"
        rules={[{ required: false, message: '请选择关联代理商' }]}
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
      
      {/* 添加一个信息展示，显示当前客户的名称 */}
      {currentCustomer && (
        <div className="text-gray-500 mt-2">
          正在为客户 <strong>{currentCustomer.name}</strong> 分配销售/代理商
        </div>
      )}
    </Form>
  );
};

export default CustomerAssignForm;