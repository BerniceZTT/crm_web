/**
 * 客户表单组件
 * 用于创建和编辑客户信息
 */
import React, { useEffect, useState } from 'react';
import { Form, Input, Select, Button } from 'antd';
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
import CustomerNameValidator from './CustomerNameValidator';

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

  // 客户名称校验相关状态
  const [nameValidatorVisible, setNameValidatorVisible] = useState(false);
  const [nameValidated, setNameValidated] = useState(false);
  const [originalName, setOriginalName] = useState<string>('');
  const [currentInputName, setCurrentInputName] = useState<string>('');
  const [isValidatorUpdating, setIsValidatorUpdating] = useState(false); // 新增：标记来自校验器的更新

  // 初始化时记录原始客户名称（用于编辑时判断是否需要重新校验）
  useEffect(() => {
    if (currentCustomer?.name) {
      setOriginalName(currentCustomer.name);
      setCurrentInputName(currentCustomer.name);
      setNameValidated(true); // 编辑现有客户时，名称已经是校验过的
    } else {
      setOriginalName('');
      setCurrentInputName('');
      setNameValidated(false); // 新建客户时需要校验
    }
  }, [currentCustomer]);

  // 监听表单字段变化 - 修复校验状态重置问题
  const handleFormValuesChange = (changedValues: any, allValues: any) => {
    if (changedValues.name !== undefined) {
      const newName = changedValues.name || '';
      
      // 如果不是来自校验器的更新，才更新输入状态
      if (!isValidatorUpdating) {
        setCurrentInputName(newName);
      }
      
      console.log('表单name字段变化:', { 
        newName, 
        originalName, 
        currentCustomer: !!currentCustomer,
        isValidatorUpdating
      });
      
      // 如果是来自校验器的更新，跳过校验状态的重置逻辑
      if (isValidatorUpdating) {
        console.log('来自校验器的更新，保持校验状态');
        return;
      }
      
      // 如果是编辑模式且名称发生了变化，需要重新校验
      if (currentCustomer && originalName && newName !== originalName) {
        setNameValidated(false);
        console.log('编辑模式下名称变化，需要重新校验');
      } else if (currentCustomer && newName === originalName) {
        setNameValidated(true); // 恢复到原来的名称，认为已校验
        console.log('名称恢复到原始值，标记为已校验');
      } else if (!currentCustomer) {
        setNameValidated(false); // 新建模式，任何变化都需要校验
        console.log('新建模式，需要校验');
      }
    }
  };

  // 显示名称校验器
  const showNameValidator = () => {
    const currentName = form.getFieldValue('name') || '';
    console.log('点击校验按钮，当前客户名称:', currentName, '输入框名称:', currentInputName);
    
    if (!currentName.trim()) {
      console.log('客户名称为空，触发表单验证');
      form.validateFields(['name']);
      return;
    }
    
    console.log('显示名称校验器');
    setNameValidatorVisible(true);
  };

  // 处理名称校验器取消
  const handleNameValidatorCancel = () => {
    console.log('取消名称校验');
    setNameValidatorVisible(false);
  };

  // 处理名称校验成功 - 修复状态同步问题
  const handleNameValidated = (validatedName: string) => {
    console.log('名称校验成功:', validatedName);
    
    // 标记为校验器更新状态
    setIsValidatorUpdating(true);
    
    // 先更新输入状态
    setCurrentInputName(validatedName);
    
    // 设置表单中的客户名称
    form.setFieldsValue({ name: validatedName });
    
    // 手动触发表单值变化事件（此时 isValidatorUpdating 为 true，会跳过校验状态重置）
    handleFormValuesChange({ name: validatedName }, { ...form.getFieldsValue(), name: validatedName });
    
    // 重置校验器更新标记
    setIsValidatorUpdating(false);
    
    // 设置为已校验状态 - 这里要放在最后，确保不被覆盖
    setNameValidated(true);
    
    // 关闭校验器
    setNameValidatorVisible(false);
    
    // 触发表单验证，清除可能的错误信息
    setTimeout(() => {
      form.validateFields(['name']).catch(() => {
        // 忽略验证错误
      });
    }, 100);
    
    console.log('表单值设置完成，校验状态:', true, '当前name字段值:', form.getFieldValue('name'));
  };

  // 获取校验按钮的状态和文本
  const getValidationButtonProps = () => {
    const currentName = currentInputName.trim();
    
    console.log('获取校验按钮状态:', { currentName, nameValidated, originalName });
    
    if (!currentName) {
      return {
        disabled: true,
        text: '请先输入客户名称',
        type: 'default' as const
      };
    }
    
    if (nameValidated) {
      return {
        disabled: false,
        text: '名称已校验',
        type: 'default' as const
      };
    }
    
    return {
      disabled: false,
      text: '校验名称',
      type: 'primary' as const
    };
  };

  const validationButtonProps = getValidationButtonProps();

  return (
    <>
      <Form
        form={form}
        layout="vertical"
        name="customerForm"
        onValuesChange={handleFormValuesChange}
      >
        <Form.Item
          name="name"
          label="客户名称"
          rules={[
            { required: true, message: '' },
            {
              validator: (_, value) => {
                if (!value || !value.trim()) {
                  return Promise.reject(new Error('请输入客户名称'));
                }
                
                // 如果是新建客户，必须进行名称校验
                if (!currentCustomer && !nameValidated) {
                  return Promise.reject(new Error('请先校验客户名称'));
                }
                
                // 如果是编辑客户且名称发生了变化，必须重新校验
                if (currentCustomer && value !== originalName && !nameValidated) {
                  return Promise.reject(new Error('客户名称已修改，请重新校验'));
                }
                
                return Promise.resolve();
              }
            }
          ]}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <Input
              placeholder="请输入客户名称"
              style={{ flex: 1 }}
              value={currentInputName}
              onChange={(e) => {
                const newValue = e.target.value;
                setCurrentInputName(newValue);
                form.setFieldValue('name', newValue);
                handleFormValuesChange({ name: newValue }, { ...form.getFieldsValue(), name: newValue });
              }}
            />
            <Button
              {...validationButtonProps}
              onClick={showNameValidator}
              style={{ minWidth: '100px' }}
            >
              {validationButtonProps.icon}
              {validationButtonProps.text}
            </Button>
          </div>
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
            disabled={isFactorySales || isAgent} 
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

      {/* 客户名称校验器 */}
      <CustomerNameValidator
        visible={nameValidatorVisible}
        initialName={currentInputName}
        onCancel={handleNameValidatorCancel}
        onConfirm={handleNameValidated}
      />
    </>
  );
};

export default CustomerForm;