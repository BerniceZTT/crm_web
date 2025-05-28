/**
 * 客户查重组件
 * 用于在新增客户前检查是否存在重复客户
 * 简化版本：只需输入客户名称
 */
import React, { useState } from 'react';
import { 
  Form, 
  Input, 
  Button, 
  Alert, 
  Card, 
  Space, 
  Tag, 
  message,
  Divider
} from 'antd';
import { 
  SearchOutlined, 
  PlusOutlined, 
  ExclamationCircleOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { api } from '../../utils/api';

interface CustomerDuplicateCheckProps {
  onCreateNew: (initialData?: any) => void;
  onCancel: () => void;
}

interface DuplicateCheckResult {
  duplicateCount: number;
  customers: any[];
}

const CustomerDuplicateCheck: React.FC<CustomerDuplicateCheckProps> = ({
  onCreateNew,
  onCancel
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [checkResult, setCheckResult] = useState<DuplicateCheckResult | null>(null);
  const [hasChecked, setHasChecked] = useState(false);

  // 执行查重检查 - 使用新的API调用方式
  const handleCheck = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // 使用新的API调用方式
      const customerNames = [values.name.trim()];
      const result = await api.post('/api/customers/check-duplicates/for_customer', { customerNames });

      setCheckResult(result);
      setHasChecked(true);

      if (result.duplicateCount == 0) {
        message.success('查重通过，可以创建新客户');
      } 
    } catch (error: any) {
      console.error('查重失败:', error);
      message.error(error.error || error.message || '查重失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 继续创建新客户
  const handleCreateNew = () => {
    const formValues = form.getFieldsValue();

    // 准备初始数据
    const initialData: any = {
      name: formValues.name
    };

    onCreateNew(initialData);
  };

  // 重新检查
  const handleRecheck = () => {
    setCheckResult(null);
    setHasChecked(false);
  };

  return (
    <div className="space-y-4">
      <Alert
        message="客户查重检查"
        description="输入客户名称，检查是否已存在相同或相似的客户，避免数据重复。"
        type="info"
        showIcon
      />

      <Form
        form={form}
        layout="vertical"
        name="duplicateCheckForm"
      >
        <Form.Item
          name="name"
          label="客户名称"
          rules={[
            { required: true, message: '请输入客户名称' },
            { min: 2, message: '客户名称至少2个字符' },
            { max: 100, message: '客户名称不能超过100个字符' }
          ]}
        >
          <Input 
            placeholder="请输入要检查的客户名称" 
            disabled={loading}
            size="large"
          />
        </Form.Item>
      </Form>

      {/* 操作按钮 */}
      <div className="flex justify-between">
        <Button onClick={onCancel} size="large">
          取消
        </Button>

        <Space>
          {hasChecked && (
            <Button onClick={handleRecheck} size="large">
              重新检查
            </Button>
          )}

          <Button 
            type="primary" 
            icon={<SearchOutlined />}
            onClick={handleCheck}
            loading={loading}
            size="large"
          >
            开始查重
          </Button>
        </Space>
      </div>

      {/* 查重结果 */}
      {checkResult && (
        <div className="mt-6">
          <Divider>查重结果</Divider>

          {/* 客户重复检查结果 */}
          {checkResult.duplicateCount > 0 ? (
            <Alert
              message={`发现 ${checkResult.duplicateCount} 个重复客户`}
              description={
                <div className="mt-2">
                  {checkResult.customers.map((customer, index) => (
                    <Card key={index} size="small" className="mb-2 border-orange-200">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-800">{customer.name}</div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              }
              type="warning"
              showIcon
              icon={<ExclamationCircleOutlined />}
              className="mb-4"
            />
          ) : (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-green-800 font-medium">
                    <CheckCircleOutlined className="mr-2" />
                    查重通过，可以创建新客户
                  </div>
                  <div className="text-green-600 text-sm mt-1">
                    没有发现重复的客户名称
                  </div>
                </div>

                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  onClick={handleCreateNew}
                  className="bg-green-600 hover:bg-green-700"
                  size="large"
                >
                  创建新客户
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerDuplicateCheck;