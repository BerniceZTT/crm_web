import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, message, Alert, Spin, Checkbox } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

const Login: React.FC = () => {
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // 组件状态
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);

  // 表单引用
  const [form] = Form.useForm();

  // 初始化时检查是否有登录消息和保存的凭据
  useEffect(() => {
    // 检查sessionStorage中是否有登录消息
    const storedMessage = sessionStorage.getItem('loginMessage');
    if (storedMessage) {
      message.warning(storedMessage);
      sessionStorage.removeItem('loginMessage');
    }

    // 加载保存的凭据
    const savedCredentials = localStorage.getItem('rememberedCredentials');
    if (savedCredentials) {
      try {
        const credentials = JSON.parse(savedCredentials);
        form.setFieldsValue({
          username: credentials.username,
          password: credentials.password,
          remember: true
        });
        setRememberPassword(true);
      } catch (error) {
        console.error('解析保存的凭据时出错:', error);
        localStorage.removeItem('rememberedCredentials');
      }
    }
  }, [form]);

  // 当认证状态改变时处理导航
  useEffect(() => {
    if (isAuthenticated && !loading) {
      setLoginSuccess(true);

      // 显示成功消息
      message.success('登录成功，正在跳转...');

      // 简化的重定向逻辑 - 优先使用来源页面，其次跳转到首页
      setTimeout(() => {
        try {
          // 检查是否有来源路径（从受保护页面跳转而来）
          const from = location.state?.from?.pathname;

          if (from) {
            console.log(`跳转到原始请求页面: ${from}`);
            // 确保使用相对路径 (移除可能的哈希前缀)
            navigate(from.replace(/^\/?#?\/?/, '/'), { replace: true });
          } else {
            // 默认跳转到系统首页
            console.log('跳转到系统首页');
            navigate('/', { replace: true });
          }
        } catch (error) {
          console.error('导航出错，使用备用方案:', error);
          // 出错时强制跳转到首页
          navigate('/', { replace: true });
        }
      }, 800);
    }
  }, [isAuthenticated, loading, navigate, location]);




  // 提交登录表单
  const onFinish = async (values: { username: string; password: string; remember?: boolean }) => {
    if (loading || loginSuccess) return;

    setLoading(true);
    setLoginError(null);

    try {
      console.log(`正在登录用户: ${values.username}`);

      // 登录时不再使用isAgent参数，统一为普通用户登录
      const user = await login(values.username, values.password, false);

      // 处理记住密码功能
      if (values.remember) {
        // 将凭据保存到localStorage
        localStorage.setItem('rememberedCredentials', JSON.stringify({
          username: values.username,
          password: values.password
        }));
      } else {
        // 如果未勾选，清除之前保存的凭据
        localStorage.removeItem('rememberedCredentials');
      }

      if (user) {
        console.log('登录API调用成功，用户:', user.username);
        setLoginSuccess(true);
      } else {
        setLoginError('登录失败：无效的响应数据');
      }
    } catch (error: any) {
      console.error('登录过程中出错:', error);

      // 格式化错误消息
      let errorMessage = '登录失败';
      if (error.error) {
        errorMessage = error.error;
      } else if (error.message) {
        errorMessage = error.message;
      } else {
        errorMessage = '登录失败，请检查用户名和密码';
      }

      setLoginError(errorMessage);
      setLoginSuccess(false);

      // 添加表单反馈
      form.setFields([{
        name: 'password',
        errors: ['密码错误，请重试']
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleRememberChange = (e: any) => {
    setRememberPassword(e.target.checked);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-indigo-50/80 to-blue-100/80">
      <Card
        style={{
          width: 420,
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
          <Title level={2} className="text-indigo-600 mb-2">乾芯CRM系统</Title>
          <Title level={4} className="font-normal text-gray-500 mt-0">账号登录</Title>
        </div>

        {loginError && (
          <Alert
            message="登录错误"
            description={loginError}
            type="error"
            showIcon
            closable
            className="mb-6"
            onClose={() => setLoginError(null)}
          />
        )}

        {loginSuccess && (
          <Alert
            message="登录成功"
            description="正在跳转到系统主页..."
            type="success"
            showIcon
            className="mb-6"
          />
        )}

        <Form
          form={form}
          name="login"
          initialValues={{ remember: rememberPassword }}
          onFinish={onFinish}
          layout="vertical"
          disabled={loginSuccess}
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: '请输入用户名/代理商名' },
              { min: 2, message: '用户名/代理商名至少2个字符' }
            ]}
          >
            <Input
              prefix={<UserOutlined className="text-gray-400" />}
              placeholder="用户名"
              size="large"
              autoComplete="username"
              disabled={loginSuccess}
              style={{ height: '44px' }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 5, message: '密码至少5个字符' }
            ]}
            style={{ marginBottom: '8px' }} // 减少底部间距，使记住密码更靠近
          >
            <Input.Password
              prefix={<LockOutlined className="text-gray-400" />}
              placeholder="密码"
              size="large"
              autoComplete="current-password"
              disabled={loginSuccess}
              style={{ height: '44px' }}
            />
          </Form.Item>

          <Form.Item
            name="remember"
            valuePropName="checked"
            style={{ marginBottom: '16px' }} // 减少顶部间距，更加紧凑
          >
            <Checkbox
              onChange={handleRememberChange}
              disabled={loginSuccess}
              className="text-gray-600"
            >
              记住密码
            </Checkbox>
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
              disabled={loginSuccess}
              style={{
                height: '48px',
                fontSize: '16px',
                background: loginSuccess ? '#52c41a' : 'linear-gradient(to bottom, #5552ff, #4f46e5)',
                borderColor: loginSuccess ? '#52c41a' : '#4338ca',
                boxShadow: '0 4px 10px rgba(79, 70, 229, 0.25)',
                fontWeight: 600,
              }}
              className="hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
            >
              {loginSuccess ? '登录成功' : (loading ? '登录中...' : '登录')}
            </Button>
          </Form.Item>

          {/* 登录按钮下方的链接区域 */}
          <div className="flex justify-between text-sm">
            <div>
              <span className="text-gray-500">还没有账号？</span>
              <Link to="/register" className="text-indigo-600 ml-1 hover:text-indigo-800 transition-colors duration-300">立即注册</Link>
            </div>
          </div>
        </Form>

        {/* 指示全局加载状态 */}
        {authLoading && (
          <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50 backdrop-blur-sm">
            <Spin size="large" tip="正在验证登录状态..." />
          </div>
        )}
      </Card>
    </div>
  );
};

export default Login;