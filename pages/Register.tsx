import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Select, Card, Typography, Alert } from 'antd';
import { UserOutlined, LockOutlined, PhoneOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../shared/types';

const { Title } = Typography;
const { Option } = Select;

interface RegisterFormValues {
  username: string;
  password: string;
  confirmPassword: string;
  phone: string;
  role: UserRole;
}

const Register: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  
  // 使用Effect在成功后进行导航，避免在异步回调中直接调用navigate
  useEffect(() => {
    if (registrationSuccess && navigate) {
      // 添加短暂延迟，确保状态更新完成
      const timer = setTimeout(() => {
        try {
          navigate('/login');
        } catch (err) {
          console.error('导航失败:', err);
          // 如果导航失败，给用户一个点击链接的机会
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [registrationSuccess, navigate]);
  
  const onFinish = async (values: RegisterFormValues) => {
    setLoading(true);
    setError(null);
    
    try {
      const { confirmPassword, ...userData } = values;
      
      // 普通用户注册
      await register(userData);
      
      // 设置注册成功状态
      setRegistrationSuccess(true);
    } catch (error: any) {
      console.error('注册失败:', error);
      // 只在这一处设置错误信息，错误将通过 Alert 组件显示
      setError(error.error || '注册失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };
  
  // 如果导航失败，提供一个备用方案
  const handleManualNavigate = () => {
    try {
      if (navigate) {
        navigate('/login');
      } else {
        // 如果navigate不可用，尝试使用window.location
        window.location.href = '/#/login';
      }
    } catch (err) {
      console.error('手动导航失败:', err);
      // 最后的备用方案
      window.location.href = '/#/login';
    }
  };
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-indigo-50/80 to-blue-100/80">
      <Card 
        style={{ 
          width: 500, 
          borderRadius: '16px',
          boxShadow: '0 10px 25px rgba(79, 70, 229, 0.15)',
          border: 'none',
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(10px)',
          transition: 'all 0.3s ease',
          transform: 'translateY(0)',
        }}
        className="hover:shadow-xl"
      >
        <div className="text-center mb-8">
          <Title level={2} className="text-indigo-600 mb-2">企业级CRM系统</Title>
          <Title level={4} className="font-normal text-gray-500 mt-0">账号注册</Title>
        </div>
        
        {registrationSuccess ? (
          <Alert
            message="注册成功"
            description={
              <div>
                <p>注册申请已提交，请等待管理员审批。</p>
                <Button type="link" onClick={handleManualNavigate}>
                  点击此处返回登录页面
                </Button>
              </div>
            }
            type="success"
            showIcon
            style={{ marginBottom: 24 }}
          />
        ) : (
          <Alert
            message="注册须知"
            description="注册后需要等待管理员审批，审批通过后方可登录系统。"
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}
        
        {error && (
          <Alert
            message="注册错误"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}
        
        {!registrationSuccess && (
          <Form
            name="register"
            initialValues={{ role: UserRole.FACTORY_SALES }}
            onFinish={onFinish}
            layout="vertical"
          >
            <Form.Item
              name="role"
              label="注册角色"
              rules={[{ required: true, message: '请选择注册角色' }]}
            >
              <Select>
                <Option value={UserRole.FACTORY_SALES}>原厂销售</Option>
                <Option value={UserRole.INVENTORY_MANAGER}>库存管理员</Option>
              </Select>
            </Form.Item>
            
            <Form.Item
              name="username"
              label="用户名"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input prefix={<UserOutlined className="text-gray-400" />} />
            </Form.Item>
            
            <Form.Item
              name="phone"
              label="联系电话"
              rules={[
                { required: true, message: '请输入联系电话' },
                { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号码' }
              ]}
            >
              <Input prefix={<PhoneOutlined className="text-gray-400" />} />
            </Form.Item>
            
            <Form.Item
              name="password"
              label="密码"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码长度不能少于6个字符' }
              ]}
            >
              <Input.Password prefix={<LockOutlined className="text-gray-400" />} />
            </Form.Item>
            
            <Form.Item
              name="confirmPassword"
              label="确认密码"
              dependencies={['password']}
              rules={[
                { required: true, message: '请确认密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined className="text-gray-400" />} />
            </Form.Item>
            
            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
                style={{
                  height: '48px',
                  fontSize: '16px',
                  background: loading ? undefined : '#4f46e5',
                  borderColor: '#4338ca',
                  boxShadow: '0 4px 6px rgba(79, 70, 229, 0.25)',
                }}
                className="hover:bg-indigo-700 transition-all duration-300"
              >
                {loading ? '注册中...' : '注册'}
              </Button>
            </Form.Item>
            
            <div className="text-center">
              <span className="text-gray-500">已有账号？</span>
              <Link to="/login" className="text-indigo-600 ml-1 hover:text-indigo-800 transition-colors duration-300">立即登录</Link>
            </div>
          </Form>
        )}
      </Card>
    </div>
  );
};

export default Register;