/**
 * 客户名称校验组件
 * 集成公司名称补充和查重功能
 */
import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  Input, 
  Button, 
  List, 
  Alert, 
  Space, 
  Tag, 
  message,
  Divider,
  Card,
  Typography
} from 'antd';
import { 
  SearchOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined
} from '@ant-design/icons';
import { getCompanyNameSuggestions, checkDuplicateCustomers } from '../../utils/api';

const { Text } = Typography;

interface CompanyInfo {
  regNumber: string;
  regType: string;
  companyName: string;
  companyType: string;
  regMoney: string;
  faRen: string;
  issueTime: string;
  creditCode: string;
  provinceName: string;
  businessStatus: string;
}

interface CustomerNameValidatorProps {
  visible: boolean;
  initialName: string;
  onCancel: () => void;
  onConfirm: (validatedName: string) => void;
  readOnly?: boolean; // 新增：只读模式，不显示操作按钮
}

const CustomerNameValidator: React.FC<CustomerNameValidatorProps> = ({
  visible,
  initialName,
  onCancel,
  onConfirm,
  readOnly = false // 默认为false，保持原有行为
}) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'select' | 'duplicate-check' | 'completed'>('input');
  const [searchPrefix, setSearchPrefix] = useState(initialName);
  const [companyList, setCompanyList] = useState<CompanyInfo[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<CompanyInfo | null>(null);
  const [duplicateCheckResult, setDuplicateCheckResult] = useState<any>(null);

  // 监听 initialName 的变化，同步更新搜索框的值
  useEffect(() => {
    console.log('CustomerNameValidator: initialName 变化:', initialName);
    setSearchPrefix(initialName || '');
  }, [initialName]);

  // 监听弹窗显示状态，每次打开时重置状态
  useEffect(() => {
    if (visible) {
      console.log('CustomerNameValidator: 弹窗打开，重置状态，initialName:', initialName);
      setStep('input');
      setSearchPrefix(initialName || '');
      setCompanyList([]);
      setSelectedCompany(null);
      setDuplicateCheckResult(null);
      setLoading(false);
    }
  }, [visible, initialName]);

  // 第一步：搜索公司名称补充
  const handleSearchCompanies = async () => {
    if (!searchPrefix || searchPrefix.trim().length < 1) {
      message.error('请输入公司名称前缀');
      return;
    }

    console.log('开始搜索公司名称:', searchPrefix);
    setLoading(true);
    
    try {
      const response = await getCompanyNameSuggestions(searchPrefix.trim());
      console.log('公司名称补充接口响应:', response);
      
      if (response.error_code === 0 && response.result?.data) {
        setCompanyList(response.result.data);
        setStep('select');
        message.success(`找到 ${response.result.data.length} 个相关公司`);
      } else {
        console.error('公司名称补充接口返回错误:', response);
        message.error(response.reason || '获取公司信息失败');
      }
    } catch (error: any) {
      console.error('搜索公司失败:', error);
      
      // 提供更详细的错误信息
      let errorMessage = '搜索公司失败，请重试';
      if (error.status === 404) {
        errorMessage = '公司名称补充服务暂不可用';
      } else if (error.error) {
        errorMessage = error.error;
      }
      
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 第二步：选择公司并进行查重检查
  const handleSelectCompany = async (company: CompanyInfo) => {
    setSelectedCompany(company);
    setLoading(true);
    setStep('duplicate-check');

    try {
      const duplicateResult = await checkDuplicateCustomers([company.companyName]);
      setDuplicateCheckResult(duplicateResult);
      
      if (!duplicateResult.exists) {
        message.success('查重通过，可以使用此公司名称');
        setStep('completed');
      } else {
        message.error(`发现重复客户，无法使用此名称`);
        setStep('completed');
      }
    } catch (error: any) {
      console.error('查重失败:', error);
      message.error(error.error || '查重失败，请重试');
      setStep('select');
    } finally {
      setLoading(false);
    }
  };

  // 确认使用选择的公司名称 - 修复按钮状态问题
  const handleConfirmName = () => {
    console.log('确认使用名称，当前状态:', { selectedCompany, searchPrefix, duplicateCheckResult });
    
    // 如果存在重复客户，不允许确认
    if (duplicateCheckResult?.exists) {
      message.error('该客户名称已存在，无法重复使用');
      return;
    }
    
    // 优先使用选中的公司名称，如果没有则使用搜索框的值
    const nameToConfirm = selectedCompany?.companyName || searchPrefix.trim();
    
    if (!nameToConfirm) {
      message.error('请先选择或输入客户名称');
      return;
    }
    
    console.log('确认使用的名称:', nameToConfirm);
    onConfirm(nameToConfirm);
    handleReset();
  };

  // 重置组件状态
  const handleReset = () => {
    setStep('input');
    setSearchPrefix(initialName || '');
    setCompanyList([]);
    setSelectedCompany(null);
    setDuplicateCheckResult(null);
    setLoading(false);
  };

  // 关闭弹窗
  const handleClose = () => {
    handleReset();
    onCancel();
  };

  // 只读模式下的完成查看 - 直接关闭，不重置状态
  const handleDone = () => {
    onCancel();
  };

  // 返回上一步
  const handleGoBack = () => {
    if (step === 'select') {
      setStep('input');
    } else if (step === 'duplicate-check' || step === 'completed') {
      setStep('select');
      setSelectedCompany(null);
      setDuplicateCheckResult(null);
    }
  };

  // 检查是否可以确认名称 - 修改逻辑，重复客户时不可确认
  const canConfirmName = () => {
    // 如果存在重复客户，不允许确认
    if (duplicateCheckResult?.exists) {
      return false;
    }
    
    // 有选中的公司名称或有输入的搜索前缀
    return !!(selectedCompany?.companyName || searchPrefix.trim());
  };

  // 获取按钮文本
  const getConfirmButtonText = () => {
    if (duplicateCheckResult?.exists) {
      return '名称已存在，无法使用';
    }
    return canConfirmName() ? '确认使用此名称' : '请先选择名称';
  };

  return (
    <Modal
      title="客户名称校验"
      open={visible}
      onCancel={readOnly ? handleDone : handleClose}
      footer={null}
      width={800}
      maskClosable={false}
      destroyOnClose
    >
      <div className="space-y-4">
        {/* 步骤 1: 输入公司名称前缀 */}
        {step === 'input' && (
          <>
            <Alert
              message="公司名称补充"
              description="请输入公司名称的关键词，我们将为您提供完整的公司名称选项"
              type="info"
              showIcon
            />
            
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="请输入公司名称关键词，如：百度、腾讯等"
                value={searchPrefix}
                onChange={(e) => {
                  console.log('搜索框值变化:', e.target.value);
                  setSearchPrefix(e.target.value);
                }}
                onPressEnter={handleSearchCompanies}
                size="large"
              />
              <Button 
                type="primary" 
                icon={<SearchOutlined />}
                onClick={handleSearchCompanies}
                loading={loading}
                size="large"
              >
                搜索
              </Button>
            </Space.Compact>
          </>
        )}

        {/* 步骤 2: 选择公司 */}
        {step === 'select' && (
          <>
            <div className="flex justify-between items-center">
              <Alert
                message={`找到 ${companyList.length} 个相关公司`}
                description="请选择正确的公司名称"
                type="success"
                showIcon
                className="flex-1"
              />
              <Button onClick={handleGoBack} className="ml-4">
                返回搜索
              </Button>
            </div>
            
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <List
                dataSource={companyList}
                renderItem={(company) => (
                  <List.Item>
                    <Card 
                      hoverable 
                      className="w-full"
                      onClick={() => handleSelectCompany(company)}
                      bodyStyle={{ padding: '12px 16px' }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-lg mb-2">{company.companyName}</div>
                          <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                            <div>法人：{company.faRen}</div>
                            <div>注册资本：{company.regMoney}</div>
                            <div>省份：{company.provinceName}</div>
                            <div>状态：{company.businessStatus}</div>
                          </div>
                          {company.creditCode && (
                            <div className="text-xs text-gray-400 mt-1">
                              统一社会信用代码：{company.creditCode}
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <Tag color={company.businessStatus === '存续' ? 'green' : 'red'}>
                            {company.businessStatus}
                          </Tag>
                        </div>
                      </div>
                    </Card>
                  </List.Item>
                )}
              />
            </div>
          </>
        )}

        {/* 步骤 3: 查重检查中 */}
        {step === 'duplicate-check' && (
          <>
            <Alert
              message="正在进行查重检查"
              description={`正在检查「${selectedCompany?.companyName}」是否已存在...`}
              type="info"
              showIcon
            />
            <div className="flex justify-center py-8">
              <Button loading size="large">
                查重检查中...
              </Button>
            </div>
          </>
        )}

        {/* 步骤 4: 完成 - 根据 readOnly 模式控制操作按钮显示 */}
        {step === 'completed' && selectedCompany && (
          <>
            <Divider>校验结果</Divider>
            
            <Card className="mb-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-lg mb-2">已选择公司</div>
                  <div className="text-xl font-bold text-blue-600">
                    {selectedCompany.companyName}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {selectedCompany.provinceName} · {selectedCompany.faRen} · {selectedCompany.businessStatus}
                  </div>
                </div>
                {!readOnly && (
                  <Button onClick={handleGoBack} type="link">
                    重新选择
                  </Button>
                )}
              </div>
            </Card>

            {/* 查重结果 */}
            {duplicateCheckResult && (
              <>
                {duplicateCheckResult.exists ? (
                  <Alert
                    message={
                      <div className="flex items-center">
                        <CloseCircleOutlined className="text-red-500 mr-2" />
                        客户名称已存在
                      </div>
                    }
                    description={
                      <div>
                        <div className="mb-3 text-red-600 font-medium">
                          发现 {duplicateCheckResult.duplicateCount} 个相同的客户记录，该名称已被使用，无法重复创建
                        </div>
                        {duplicateCheckResult.customers?.map((customer: any, index: number) => (
                          <div key={index} className="bg-red-50 p-2 rounded mb-2 border border-red-200">
                            <div className="font-medium text-red-800">{customer.name}</div>
                            {customer.contactPerson && (
                              <div className="text-sm text-red-600">
                                联系人: {customer.contactPerson}
                              </div>
                            )}
                            {customer.address && (
                              <div className="text-sm text-red-600">
                                地址: {customer.address}
                              </div>
                            )}
                          </div>
                        ))}
                        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                          <strong>提示：</strong>为避免数据重复，请选择其他公司名称或确认是否需要修改现有客户信息。
                        </div>
                      </div>
                    }
                    type="error"
                    showIcon={false}
                    className="mb-4"
                  />
                ) : (
                  <Alert
                    message={
                      <div className="flex items-center">
                        <CheckCircleOutlined className="text-green-500 mr-2" />
                        查重通过
                      </div>
                    }
                    description="没有发现重复的客户，可以安全使用此公司名称"
                    type="success"
                    showIcon={false}
                    className="mb-4"
                  />
                )}
              </>
            )}

            {/* 操作按钮 - 根据 readOnly 模式控制显示 */}
            {!readOnly && (
              <div className="flex justify-end space-x-3">
                <Button onClick={handleClose}>
                  取消
                </Button>
                <Button 
                  type={canConfirmName() ? "primary" : "default"}
                  onClick={handleConfirmName}
                  disabled={!canConfirmName()}
                  danger={duplicateCheckResult?.exists}
                >
                  {getConfirmButtonText()}
                </Button>
              </div>
            )}

            {/* 只读模式的提示 */}
            {readOnly && (
              <div className="flex justify-end">
                <Button onClick={handleDone} type="primary">
                  完成查看
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default CustomerNameValidator;