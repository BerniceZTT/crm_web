/**
 * 客户自动转移配置页面 - 简化版本
 * 仅超级管理员可见，专注于核心配置管理
 */

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Form, 
  Input, 
  Select, 
  Switch, 
  InputNumber,
  message,
  Typography,
  Row,
  Col,
  Divider,
  Space,
  Spin,
  Tag,
  Alert
} from 'antd';
import { 
  SettingOutlined,
  SaveOutlined,
  CheckCircleOutlined,
  UserOutlined,
  ClockCircleOutlined,
  EditOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import useSWR from 'swr';
import { api } from '../utils/api';
import { 
  SystemConfig, 
  ConfigType, 
  CustomerAutoTransferConfig,
  CreateConfigRequest,
  User,
  ConfigValueItem
} from '../shared/types';
import { useAuth } from '../contexts/AuthContext';
import { useResponsive } from '../hooks/useResponsive';

const { Option } = Select;
const { Title, Text } = Typography;

const SystemConfigManagement: React.FC = () => {
  const { user } = useAuth();
  const { 
    isMobile, 
    getButtonSize, 
    getControlSize,
    getCardPadding,
    getSpaceSize
  } = useResponsive();
  
  const [form] = Form.useForm();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 获取客户自动转移配置
  const { data: configsData, mutate: mutateConfigs } = useSWR<{configs: SystemConfig[], total: number}>(
    `/api/system-configs?configType=${ConfigType.CUSTOMER_AUTO_TRANSFER}`, 
    api.get
  );

  // 获取用户列表用于选择目标销售
  const { data: usersData } = useSWR<{users: User[]}>(
    '/api/users', 
    api.get
  );

  // 获取当前配置（应该只有一个）
  const currentConfig = configsData?.configs?.[0] || null;
  console.log('currentConfig', currentConfig)
  const salesUsers = usersData?.users?.filter(u => u.role === 'FACTORY_SALES') || [];

  // 填充表单数据的函数
  const fillFormData = (config: SystemConfig) => {
    console.log('[配置管理] 填充表单数据:', config);
    const configData = config.configValue.reduce((acc, item: ConfigValueItem) => {
      return { ...acc, [item.Key]: item.Value };
  }, {} as CustomerAutoTransferConfig);
      
    const formValues = {
      configKey: config.configKey,
      isEnabled: config.isEnabled,
      daysWithoutProgress: configData.daysWithoutProgress,
      targetSalesId: configData.targetSalesId,
      targetSalesName: configData.targetSalesName
    };
    
    console.log('[配置管理] 表单值:', formValues);
    form.setFieldsValue(formValues);
  };

  // 当配置数据加载完成后，更新表单
  useEffect(() => {
    console.log('[配置管理] useEffect 触发, currentConfig:', currentConfig);
    
    if (currentConfig) {
      // 有配置时，填充数据并关闭编辑模式
      fillFormData(currentConfig);
      setIsEditing(false);
    } else {
      // 没有配置时，设置默认值并进入编辑模式
      const defaultValues = {
        configKey: '客户自动转移规则',
        isEnabled: true
      };
      
      console.log('[配置管理] 设置默认值:', defaultValues);
      form.setFieldsValue(defaultValues);
      setIsEditing(true);
    }
  }, [currentConfig, form]);

  // 保存配置
  const handleSave = async () => {
    try {
      setIsLoading(true);
      const values = await form.validateFields();
      
      console.log('[配置管理] 保存配置，表单值:', values);
      
      // 构建客户自动转移配置值 - 简化版本
      const configValue: CustomerAutoTransferConfig = {
        daysWithoutProgress: values.daysWithoutProgress,
        targetSalesId: values.targetSalesId,
        targetSalesName: values.targetSalesName
      };
      
      const requestData = {
        configKey: values.configKey,
        isEnabled: values.isEnabled,
        configValue
      };
      
      console.log('[配置管理] 保存请求数据:', requestData);
      
      if (currentConfig?.id) {
        // 更新配置
        await api.put(`/api/system-configs/${currentConfig.id}`, requestData);
        message.success('配置更新成功');
      } else {
        // 创建配置
        const createData: CreateConfigRequest = {
          configType: ConfigType.CUSTOMER_AUTO_TRANSFER,
          description: '客户自动转移规则：当客户在指定天数内没有项目进展时，自动转移到指定销售名下',
          ...requestData
        };
        await api.post('/api/system-configs', createData);
        message.success('配置创建成功');
      }
      
      mutateConfigs();
      setIsEditing(false);
    } catch (error) {
      console.error('[配置管理] 保存失败:', error);
      message.error(`操作失败: ${error.message || '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 切换编辑模式
  const handleEdit = () => {
    console.log('[配置管理] 开始编辑，当前配置:', currentConfig);
    
    if (currentConfig) {
      // 重新填充表单数据，确保显示最新的已保存数据
      fillFormData(currentConfig);
    }
    
    setIsEditing(true);
  };

  // 取消编辑
  const handleCancel = () => {
    if (currentConfig) {
      // 恢复原始值
      console.log('[配置管理] 取消编辑，恢复原始值');
      fillFormData(currentConfig);
    }
    setIsEditing(false);
  };

  // 切换配置状态
  const handleToggleStatus = async (checked: boolean) => {
    if (!currentConfig?.id) return;
    
    try {
      console.log(`[配置管理] 切换配置状态: ${checked ? '启用' : '禁用'}`);
      await api.patch(`/api/system-configs/${currentConfig.id}/toggle`);
      mutateConfigs();
      message.success(`配置已${checked ? '启用' : '禁用'}`);
    } catch (error) {
      console.error('[配置管理] 状态切换失败:', error);
      message.error(`状态切换失败: ${error.message || '未知错误'}`);
    }
  };

  // 渲染配置信息展示
  const renderConfigDisplay = () => {
    if (!currentConfig) return null;    
    const configData = currentConfig.configValue.reduce((acc, item: ConfigValueItem) => {
      return { ...acc, [item.Key]: item.Value };
  }, {} as CustomerAutoTransferConfig);

    return (
      <div style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
              <ClockCircleOutlined style={{ fontSize: 24, color: '#1890ff', marginBottom: 8 }} />
              <div style={{ fontSize: 18, fontWeight: 600, color: '#1890ff' }}>
                {configData.daysWithoutProgress}天
              </div>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>无进展天数</div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f6ffed', borderRadius: '8px' }}>
              <UserOutlined style={{ fontSize: 24, color: '#52c41a', marginBottom: 8 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: '#52c41a' }}>
                {configData.targetSalesName}
              </div>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>目标销售</div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div style={{ textAlign: 'center', padding: '16px', backgroundColor: currentConfig.isEnabled ? '#f6ffed' : '#fff2f0', borderRadius: '8px' }}>
              <CheckCircleOutlined 
                style={{ 
                  fontSize: 24, 
                  color: currentConfig.isEnabled ? '#52c41a' : '#ff4d4f', 
                  marginBottom: 8 
                }} 
              />
              <div style={{ marginBottom: 4 }}>
                <Tag color={currentConfig.isEnabled ? 'green' : 'red'}>
                  {currentConfig.isEnabled ? '已启用' : '已禁用'}
                </Tag>
              </div>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>配置状态</div>
            </div>
          </Col>
        </Row>
        
        <Divider style={{ margin: '24px 0' }} />
        
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ marginRight: 8 }}>配置名称：</Text>
          <Text>{currentConfig.configKey}</Text>
        </div>
        
        <div style={{ fontSize: 12, color: '#8c8c8c' }}>
          <Text>创建人：{currentConfig.creatorName} • </Text>
          <Text>更新时间：{currentConfig.updatedAt ? new Date(currentConfig.updatedAt).toLocaleDateString() : '-'}</Text>
        </div>
      </div>
    );
  };

  // 渲染配置表单 - 简化版本
  const renderConfigForm = () => {
    console.log('[配置管理] 渲染表单，销售用户列表:', salesUsers);
    
    return (
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        onValuesChange={(changedValues, allValues) => {
          console.log('[配置管理] 表单值变化:', changedValues, '全部值:', allValues);
        }}
      >
        <Row gutter={[16, 0]}>
          <Col xs={24} md={12}>
            <Form.Item
              name="configKey"
              label="配置名称"
              rules={[{ required: true, message: '请输入配置名称' }]}
            >
              <Input placeholder="例如：客户自动转移规则" size={getControlSize()} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="daysWithoutProgress"
              label="无进展天数"
              rules={[{ required: true, message: '请输入天数' }]}
            >
              <InputNumber
                min={1}
                max={365}
                placeholder="例如：30"
                addonAfter="天"
                style={{ width: '100%' }}
                size={getControlSize()}
              />
            </Form.Item>
          </Col>
        </Row>
        
        <Row gutter={[16, 0]}>
          <Col xs={24} md={12}>
            <Form.Item
              name="targetSalesId"
              label="目标销售"
              rules={[{ required: true, message: '请选择目标销售' }]}
            >
              <Select
                placeholder="选择客户将转移到的销售"
                size={getControlSize()}
                onChange={(value, option: any) => {
                  console.log('[配置管理] 选择销售:', value, option);
                  form.setFieldsValue({
                    targetSalesName: option.children
                  });
                }}
                loading={!usersData}
                notFoundContent={!usersData ? <Spin size="small" /> : '暂无销售人员'}
              >
                {salesUsers.map(sales => (
                  <Option key={sales._id} value={sales._id}>
                    {sales.username}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="isEnabled"
              label="启用状态"
              valuePropName="checked"
            >
              <Switch 
                checkedChildren="启用" 
                unCheckedChildren="禁用"
                size={isMobile ? 'default' : 'default'}
              />
            </Form.Item>
          </Col>
        </Row>
        
        <Form.Item name="targetSalesName" style={{ display: 'none' }}>
          <Input />
        </Form.Item>
      </Form>
    );
  };

  // 渲染空状态
  const renderEmptyState = () => (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <SettingOutlined style={{ fontSize: 64, color: '#d9d9d9', marginBottom: 16 }} />
      <Title level={4} style={{ color: '#8c8c8c', marginBottom: 8 }}>
        尚未配置客户自动转移规则
      </Title>
      <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
        配置后，系统将根据规则自动处理无进展的客户
      </Text>
    </div>
  );

  // 渲染配置说明
  const renderConfigDescription = () => (
    <Alert
      message="规则说明"
      description="每个人报备的初步接触客户，若在指定天数内没有项目进展进入送样测试，将自动转移到指定销售账户的客户列表中。"
      type="info"
      icon={<InfoCircleOutlined />}
      showIcon
      style={{ marginBottom: 24 }}
    />
  );

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <SettingOutlined className="mr-3 text-blue-600" />
            客户自动转移配置
          </h1>
          <p className="text-gray-600 mt-2">管理客户自动转移规则</p >
        </div>
        {currentConfig && !isEditing && (
          <Button 
            type="primary" 
            icon={<EditOutlined />}
            onClick={handleEdit}
            size={getButtonSize()}
          >
            编辑配置
          </Button>
        )}
      </div>

      {/* 配置说明 */}
      {renderConfigDescription()}

      {/* 主配置卡片 */}
      <Card 
        title={
          <Space>
            <SettingOutlined />
            <span>客户自动转移规则</span>
            {currentConfig && (
              <Switch
                checked={currentConfig.isEnabled}
                onChange={handleToggleStatus}
                checkedChildren="已启用"
                unCheckedChildren="已禁用"
                size="small"
              />
            )}
          </Space>
        }
        style={getCardPadding()}
        loading={!configsData}
      >
        {!currentConfig && !isEditing ? (
          renderEmptyState()
        ) : (
          <div>
            {/* 配置信息展示 */}
            {currentConfig && !isEditing && renderConfigDisplay()}
            
            {/* 配置表单 */}
            {isEditing && (
              <div>
                {renderConfigForm()}
                
                {/* 操作按钮 */}
                <div style={{ marginTop: 24, textAlign: isMobile ? 'center' : 'right' }}>
                  <Space size={getSpaceSize('middle')}>
                    {currentConfig && (
                      <Button 
                        onClick={handleCancel}
                        size={getButtonSize()}
                      >
                        取消
                      </Button>
                    )}
                    <Button 
                      type="primary" 
                      icon={<SaveOutlined />}
                      onClick={handleSave}
                      loading={isLoading}
                      size={getButtonSize()}
                    >
                      保存配置
                    </Button>
                  </Space>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default SystemConfigManagement;