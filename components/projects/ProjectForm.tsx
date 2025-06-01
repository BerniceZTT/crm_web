/**
 * 项目表单组件
 * 用于创建和编辑项目，支持多文件上传和下载
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Form,
  Input,
  Select,
  InputNumber,
  Upload,
  Button,
  Card,
  Row,
  Col,
  Typography,
  message,
  List,
  Space,
  Tooltip
} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  PlusOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import {
  Project,
  ProjectProgress,
  Product,
  FileAttachment
} from '../../shared/types';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

interface ProjectFormProps {
  form: any;
  currentProject: Partial<Project> | null;
  products: Product[];
  customerId: string;
  mode: 'create' | 'edit';
}

const ProjectForm: React.FC<ProjectFormProps> = ({
  form,
  currentProject,
  products,
  customerId,
  mode
}) => {
  const [projectProgress, setProjectProgress] = useState<ProjectProgress>(
    ProjectProgress.SAMPLE_EVALUATION
  );

  // 文件状态管理
  const [smallBatchFiles, setSmallBatchFiles] = useState<FileAttachment[]>([]);
  const [massProductionFiles, setMassProductionFiles] = useState<FileAttachment[]>([]);

  // 强制重置所有内部状态的函数
  const resetAllInternalState = useCallback(() => {
    console.log('重置ProjectForm所有内部状态...');
    setProjectProgress(ProjectProgress.SAMPLE_EVALUATION);
    setSmallBatchFiles([]);
    setMassProductionFiles([]);

    // 确保表单字段完全重置
    form.resetFields();
    form.setFieldsValue({
      projectProgress: ProjectProgress.SAMPLE_EVALUATION,
      smallBatchAttachments: [],
      massProductionAttachments: []
    });

    console.log('ProjectForm内部状态重置完成');
  }, [form]);

  // 初始化表单状态
  const initializeFormState = useCallback(() => {
    if (!currentProject || mode === 'create') {
      // 新建模式时，完全重置
      resetAllInternalState();

      // 如果有customerId，预填充客户信息
      if (customerId && mode === 'create') {
        form.setFieldsValue({ customerId });
      }
    } else {
      // 编辑模式时，设置项目数据
      console.log('编辑模式，设置项目数据:', currentProject);
      setProjectProgress(currentProject.projectProgress || ProjectProgress.SAMPLE_EVALUATION);
      setSmallBatchFiles(currentProject.smallBatchAttachments || []);
      setMassProductionFiles(currentProject.massProductionAttachments || []);

      // 设置表单值
      form.setFieldsValue({
        ...currentProject,
        smallBatchAttachments: currentProject.smallBatchAttachments || [],
        massProductionAttachments: currentProject.massProductionAttachments || []
      });
    }
  }, [currentProject, mode, customerId, form, resetAllInternalState]);

  // 当组件mount或props变化时，重新初始化状态
  useEffect(() => {
    console.log('ProjectForm组件状态变化 - mode:', mode, 'currentProject:', currentProject?.projectName || 'null');
    initializeFormState();
  }, [initializeFormState]);

  // 监听项目进展变化
  useEffect(() => {
    const progress = form.getFieldValue('projectProgress');
    if (progress) {
      setProjectProgress(progress);

      // 当进展变为批量出货时，清空小批量验证错误
      if (progress === ProjectProgress.MASS_PRODUCTION) {
        // 清除小批量字段的验证错误
        form.setFields([
          { name: 'smallBatchPrice', errors: [] },
          { name: 'smallBatchQuantity', errors: [] },
          { name: 'smallBatchAttachments', errors: [] }
        ]);
      }
    }
  }, [form]);

  // 格式化金额显示
  const formatAmount = (amount: number) => {
    if (amount === 0) return 0;
    const formatted = amount.toString();
    if (formatted.includes('.') && formatted.split('.')[1].length > 6) {
      return Number(amount.toFixed(6));
    }
    return amount;
  };

  // 监听表单字段变化，自动计算总额
  const handleFormValuesChange = (changedValues: any, allValues: any) => {
    // 自动计算小批量总额
    if (changedValues.smallBatchPrice !== undefined || changedValues.smallBatchQuantity !== undefined) {
      const price = allValues.smallBatchPrice || 0;
      const quantity = allValues.smallBatchQuantity || 0;
      const total = (price * quantity) / 10000;
      form.setFieldValue('smallBatchTotal', formatAmount(total));
    }

    // 自动计算批量出货总额
    if (changedValues.massProductionPrice !== undefined || changedValues.massProductionQuantity !== undefined) {
      const price = allValues.massProductionPrice || 0;
      const quantity = allValues.massProductionQuantity || 0;
      const total = (price * quantity) / 10000;
      form.setFieldValue('massProductionTotal', formatAmount(total));
    }

    // 监听项目进展变化
    if (changedValues.projectProgress) {
      setProjectProgress(changedValues.projectProgress);
    }
  };

  // 修正显示逻辑：批量出货时不显示小批量信息
  const shouldShowSmallBatchFields = () => {
    return projectProgress === ProjectProgress.SMALL_BATCH;
  };

  const shouldShowMassProductionFields = () => {
    return projectProgress === ProjectProgress.MASS_PRODUCTION;
  };

  // 判断字段是否应该禁用
  const shouldDisableSmallBatchFields = () => {
    return projectProgress === ProjectProgress.MASS_PRODUCTION;
  };

  // 动态生成小批量字段的验证规则
  const getSmallBatchValidationRules = (fieldName: string) => {
    const shouldValidate = shouldShowSmallBatchFields();

    if (!shouldValidate) {
      return []; // 不显示时不验证
    }

    switch (fieldName) {
      case 'smallBatchPrice':
        return [{ required: true, message: '请输入小批量报价' }];
      case 'smallBatchQuantity':
        return [{ required: true, message: '请输入小批量数量' }];
      case 'smallBatchAttachments':
        return [{ required: true, message: '请上传小批量附件' }];
      default:
        return [];
    }
  };

  // 生成文件ID
  const generateFileId = () => {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 获取文件图标
  const getFileIcon = (fileType: string) => {
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('doc')) return '📝';
    if (fileType.includes('excel') || fileType.includes('sheet')) return '📊';
    return '📎';
  };

  // 将文件转换为base64格式
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // 修复多文件上传处理逻辑
  const handleFileUpload = async (info: any, fieldType: 'small' | 'mass') => {
    const { fileList } = info;

    console.log('开始处理文件列表:', fileList.length, '个文件');

    try {
      const processedFiles: FileAttachment[] = [];

      // 处理所有文件
      for (const file of fileList) {
        if (file.status === 'error') {
          message.error(`${file.name} 处理失败`);
          continue;
        }

        // 检查是否已经处理过
        const existingFiles = fieldType === 'small' ? smallBatchFiles : massProductionFiles;
        const isAlreadyProcessed = existingFiles.some(f => f.originalName === file.name && f.fileSize === file.size);

        if (isAlreadyProcessed) {
          console.log('文件已存在，跳过:', file.name);
          continue;
        }

        console.log('处理新文件:', file.name, '类型:', file.type);

        // 将文件转换为base64用于存储
        const base64Url = await fileToBase64(file.originFileObj || file);

        // 创建新的文件附件对象
        const newFile: FileAttachment = {
          id: generateFileId(),
          fileName: `uploads/${Date.now()}_${file.name}`,
          originalName: file.name,
          fileSize: file.size || 0,
          fileType: file.type || 'application/octet-stream',
          uploadTime: new Date(),
          uploadedBy: '当前用户',
          url: base64Url
        };

        processedFiles.push(newFile);
        console.log('文件处理完成:', newFile.originalName, '大小:', newFile.fileSize);
      }

      if (processedFiles.length > 0) {
        if (fieldType === 'small') {
          const updatedFiles = [...smallBatchFiles, ...processedFiles];
          setSmallBatchFiles(updatedFiles);
          form.setFieldValue('smallBatchAttachments', updatedFiles);
          message.success(`成功添加 ${processedFiles.length} 个文件`);
        } else {
          const updatedFiles = [...massProductionFiles, ...processedFiles];
          setMassProductionFiles(updatedFiles);
          form.setFieldValue('massProductionAttachments', updatedFiles);
          message.success(`成功添加 ${processedFiles.length} 个文件`);
        }
      }
    } catch (error) {
      console.error('文件处理失败:', error);
      message.error('文件处理失败');
    }
  };

  // 删除文件
  const handleFileRemove = (fileId: string, fieldType: 'small' | 'mass') => {
    if (fieldType === 'small') {
      const updatedFiles = smallBatchFiles.filter(file => file.id !== fileId);
      setSmallBatchFiles(updatedFiles);
      form.setFieldValue('smallBatchAttachments', updatedFiles);
    } else {
      const updatedFiles = massProductionFiles.filter(file => file.id !== fileId);
      setMassProductionFiles(updatedFiles);
      form.setFieldValue('massProductionAttachments', updatedFiles);
    }
    message.success('文件已删除');
  };

  // 下载文件 - 增强下载功能
  const handleFileDownload = async (file: FileAttachment) => {
    try {
      console.log('开始下载文件:', file.originalName);

      if (mode === 'create' || !currentProject?._id) {
        // 新建模式下，文件还没有保存到服务器，直接使用本地base64数据
        const link = document.createElement('a');
        link.href = file.url;
        link.download = file.originalName;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success(`开始下载 ${file.originalName}`);
      } else {
        // 编辑模式下，从服务器下载文件
        const response = await fetch(`${process.env.AIPA_API_DOMAIN}/api/projects/download/${currentProject._id}/${file.id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || '下载失败');
        }

        const result = await response.json();

        if (result.success && result.file) {
          // 使用服务器返回的文件信息进行下载
          const link = document.createElement('a');
          link.href = result.file.url;
          link.download = result.file.originalName;

          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          message.success(`开始下载 ${result.file.originalName}`);
        } else {
          throw new Error('文件信息获取失败');
        }
      }
    } catch (error) {
      console.error('下载文件失败:', error);
      message.error(`下载失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 渲染文件列表 - 添加下载功能
  const renderFileList = (files: FileAttachment[], fieldType: 'small' | 'mass', disabled = false) => {
    return (
      <div className="border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto">
        {files.length === 0 ? (
          <div className="text-gray-400 text-center py-4">
            {disabled ? '暂无文件' : '请选择文件'}
          </div>
        ) : (
          <List
            size="small"
            dataSource={files}
            renderItem={(file) => (
              <List.Item
                key={file.id}
                className="!border-b-0 !pb-2 !pt-2"
                actions={[
                  <Tooltip title="下载" key="download">
                    <Button
                      type="text"
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={() => handleFileDownload(file)}
                      className="text-blue-500 hover:text-blue-700"
                    />
                  </Tooltip>,
                  !disabled && (
                    <Tooltip title="删除" key="delete">
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleFileRemove(file.id, fieldType)}
                      />
                    </Tooltip>
                  )
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  avatar={<span className="text-lg">{getFileIcon(file.fileType)}</span>}
                  title={
                    <div className="flex items-center">
                      <Text ellipsis={{ tooltip: file.originalName }} className="max-w-32">
                        {file.originalName}
                      </Text>
                      <Text type="secondary" className="ml-2 text-xs">
                        {formatFileSize(file.fileSize)}
                      </Text>
                    </div>
                  }
                  description={
                    <Text type="secondary" className="text-xs">
                      {new Date(file.uploadTime).toLocaleString()}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>
    );
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onValuesChange={handleFormValuesChange}
      scrollToFirstError
    >
      {/* 基本信息 */}
      <Card title="基本信息" size="small" className="mb-4">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="projectName"
              label="项目名称"
              rules={[{ required: true, message: '请输入项目名称' }]}
            >
              <Input placeholder="请输入项目名称" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="productId"
              label="产品型号"
              rules={[{ required: true, message: '请选择产品型号' }]}
            >
              <Select
                placeholder="请选择产品型号"
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) => {
                  const children = option?.children ?? "";
                  if (typeof children === "string") {
                    return children.toLowerCase().includes(input.toLowerCase());
                  }
                  return false;
                }
                }
              >
                {products.map((product: Product) => (
                  <Option key={product._id} value={product._id}>
                    {product.modelName} - {product.packageType}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="batchNumber"
              label="产品批次号"
              rules={[{ required: true, message: '请输入产品批次号' }]}
            >
              <Input placeholder="请输入产品批次号" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="projectProgress"
              label="项目进展"
              rules={[{ required: true, message: '请选择项目进展' }]}
            >
              <Select placeholder="请选择项目进展">
                {Object.values(ProjectProgress)
                  .filter(progress => progress !== ProjectProgress.ABANDONED || mode === 'edit')
                  .map(progress => (
                    <Option key={progress} value={progress}>{progress}</Option>
                  ))
                }
              </Select>
            </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* 小批量信息 */}
      {shouldShowSmallBatchFields() && (
        <Card title="小批量信息" size="small" className="mb-4">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="smallBatchPrice"
                label="小批量报价(元)"
                rules={getSmallBatchValidationRules('smallBatchPrice')}
              >
                <InputNumber
                  min={0}
                  step={0.01}
                  precision={2}
                  placeholder="请输入报价"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="smallBatchQuantity"
                label="小批量数量(片)"
                rules={getSmallBatchValidationRules('smallBatchQuantity')}
              >
                <InputNumber
                  min={0}
                  placeholder="请输入数量"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="smallBatchTotal"
                label="小批量总额(万元)"
              >
                <InputNumber
                  formatter={value => {
                    if (!value) return '';
                    const num = Number(value);
                    return num.toString();
                  }}
                  parser={value => value ? Number(value) : 0}
                  placeholder="自动计算"
                  style={{ width: '100%' }}
                  disabled
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="smallBatchAttachments"
            label="小批量附件"
            rules={getSmallBatchValidationRules('smallBatchAttachments')}
          >
            <div>
              <div className="mb-3">
                <Upload
                  beforeUpload={() => false}
                  onChange={(info) => handleFileUpload(info, 'small')}
                  disabled={shouldDisableSmallBatchFields()}
                  showUploadList={false}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.bmp,.webp"
                  multiple
                >
                  <Button
                    icon={<PlusOutlined />}
                    disabled={shouldDisableSmallBatchFields()}
                  >
                    选择文件
                  </Button>
                </Upload>
              </div>
              {renderFileList(smallBatchFiles, 'small', shouldDisableSmallBatchFields())}
            </div>
          </Form.Item>
        </Card>
      )}

      {/* 批量出货信息 */}
      {shouldShowMassProductionFields() && (
        <Card title="批量出货信息" size="small" className="mb-4">
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item
                name="massProductionPrice"
                label="批量出货报价(元)"
                rules={[{ required: true, message: '请输入批量出货报价' }]}
              >
                <InputNumber
                  min={0}
                  step={0.01}
                  precision={2}
                  placeholder="请输入报价"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="massProductionQuantity"
                label="批量出货数量(片)"
                rules={[{ required: true, message: '请输入批量出货数量' }]}
              >
                <InputNumber
                  min={0}
                  placeholder="请输入数量"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="massProductionTotal"
                label="批量出货总额(万元)"
              >
                <InputNumber
                  formatter={value => {
                    if (!value) return '';
                    const num = Number(value);
                    return num.toString();
                  }}
                  parser={value => value ? Number(value) : 0}
                  placeholder="自动计算"
                  style={{ width: '100%' }}
                  disabled
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="paymentTerm"
                label="批量出货账期"
                rules={[{ required: true, message: '请输入批量出货账期' }]}
              >
                <Input placeholder="如：30天" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="massProductionAttachments"
            label="批量出货附件"
            rules={[{ required: true, message: '请上传批量出货附件' }]}
          >
            <div>
              <div className="mb-3">
                <Upload
                  beforeUpload={() => false}
                  onChange={(info) => handleFileUpload(info, 'mass')}
                  showUploadList={false}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.bmp,.webp"
                  multiple
                >
                  <Button icon={<PlusOutlined />}>选择文件</Button>
                </Upload>
              </div>
              {renderFileList(massProductionFiles, 'mass')}
            </div>
          </Form.Item>
        </Card>
      )}

      {/* 备注 */}
      <Card title="备注信息" size="small">
        <Form.Item
          name="remark"
          label="备注"
        >
          <TextArea
            rows={4}
            placeholder="请输入备注信息"
          />
        </Form.Item>
      </Card>
    </Form>
  );
};

export default ProjectForm;