/**
 * 客户批量导入表单组件
 * 用于批量导入客户数据
 */
import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { Form, Upload, Progress } from 'antd';
import { 
  FileExcelOutlined,
  InboxOutlined 
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { 
  CustomerNature, 
  CustomerImportance, 
  CustomerProgress 
} from '../../shared/types';
import { parseCustomerFile } from '../../utils/fileUtils';
import { api } from '../../utils/api';

// 定义组件实例对外暴露的方法类型
export interface CustomerImportFormRef {
  getParsedCustomers: () => {
    customers: any[];
    isValid: boolean;
    errors: string[];
    duplicateCustomers?: string[];
  };
  setImportResultStatus: (result: any, progress?: number, status?: 'idle' | 'processing' | 'success' | 'error') => void;
  startImportProgress: () => () => void;
}

interface CustomerImportFormProps {
  form: any;
  onImport?: (data: any) => Promise<any>;
}

// 使用forwardRef创建可以接收ref的组件
const CustomerImportForm = forwardRef<CustomerImportFormRef, CustomerImportFormProps>(({ form, onImport }, ref) => {
  // 文件上传相关状态
  const [fileList, setFileList] = useState<any[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    successCount?: number;
    errors?: string[];
    duplicateCustomers?: string[];
  } | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  // 使用ref存储解析的客户数据，以便父组件可以访问
  const parsedCustomersRef = useRef<{
    customers: any[];
    isValid: boolean;
    errors: string[];
    duplicateCustomers?: string[];
  }>({
    customers: [],
    isValid: false,
    errors: []
  });
  
  // 生成并下载客户导入模板
  const downloadTemplate = () => {
    // 创建工作簿和工作表
    const workbook = XLSX.utils.book_new();
    
    // 定义表头
    const headers = [
      '客户名称',
      '客户性质',
      '客户重要程度',
      '应用领域',
      '产品需求(产品名称，用逗号分隔)',
      '联系人',
      '联系方式',
      '公司地址',
      '客户进展',
      '年需求量(片)',
      '关联销售名称',
      '关联代理商名称'
    ];
    
    // 创建示例数据行
    const exampleRow = [
      '示例客户名称',
      '请选择: 民营上市公司 / 民营中小企业 / 科研院所 / 国央企',
      '请选择: A类客户 / B类客户 / C类客户',
      '高精度仪器',
      '产品A,产品B',
      '张三',
      '13800138000',
      '北京市海淀区XX路XX号',
      '请选择: 样板评估 / 打样测试 / 小批量导入 / 批量出货',
      '10000',
      '销售1',
      '代理商1'
    ];
    
    // 组合数据（表头+示例行）
    const data = [headers, exampleRow];
    
    // 创建工作表
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    
    // 设置列宽
    const colWidths = [
      { wch: 20 }, // 客户名称
      { wch: 15 }, // 客户性质
      { wch: 15 }, // 客户重要程度
      { wch: 15 }, // 应用领域
      { wch: 30 }, // 产品需求
      { wch: 10 }, // 联系人
      { wch: 15 }, // 联系方式
      { wch: 30 }, // 公司地址
      { wch: 15 }, // 客户进展
      { wch: 15 }, // 年需求量
      { wch: 15 }, // 关联销售
      { wch: 15 }  // 关联代理商
    ];
    
    worksheet['!cols'] = colWidths;
    
    // 将工作表添加到工作簿
    XLSX.utils.book_append_sheet(workbook, worksheet, '客户导入模板');
    
    // 导出并下载
    XLSX.writeFile(workbook, '客户批量导入模板.xlsx');
  };
  
  // 处理文件变化
  const handleFileChange = async (info: any) => {
    let newFileList = [...info.fileList];
    
    // 只保留最后上传的文件
    newFileList = newFileList.slice(-1);
    
    // 更新文件状态
    setFileList(newFileList);
    
    // 重置上传状态
    if (newFileList.length === 0) {
      setUploadStatus('idle');
      setImportResult(null);
      parsedCustomersRef.current = { customers: [], isValid: false, errors: [] };
    }
    
    // 更新表单值，确保Modal的onOk能获取到文件
    if (newFileList.length > 0) {
      form.setFieldsValue({ file: newFileList });
      
      // 当文件上传后，立即解析文件数据
      try {
        const file = newFileList[0].originFileObj;
        if (file) {
          const parseResult = await parseCustomerFile(file);
          // 存储解析结果到ref，供父组件使用
          parsedCustomersRef.current = parseResult;
          
          // 如果有验证错误，显示结果但不阻止提交按钮点击
          if (!parseResult.isValid) {
            setImportResult({
              success: false,
              message: '文件解析发现以下问题:',
              errors: parseResult.errors,
              duplicateCustomers: parseResult.duplicateCustomers
            });
          } else {
            // 成功解析，清除可能的错误状态
            setImportResult(null);
          }
        }
      } catch (error: any) {
        console.error('解析客户文件失败:', error);
        setImportResult({
          success: false,
          message: '文件解析失败: ' + (error.message || '未知错误'),
          errors: []
        });
        parsedCustomersRef.current = { customers: [], isValid: false, errors: [error.message || '文件解析失败'] };
      }
    } else {
      form.setFieldsValue({ file: undefined });
    }
  };
  
  // 获取解析的客户数据
  const getParsedCustomers = () => {
    return parsedCustomersRef.current;
  };
  
  // 设置导入结果状态
  const setImportResultStatus = (result: any, progress: number = 100, status: 'idle' | 'processing' | 'success' | 'error' = 'success') => {
    setImportResult(result);
    setUploadProgress(progress);
    setUploadStatus(status);
  };
  
  // 开始导入进度显示
  const startImportProgress = () => {
    setUploadStatus('processing');
    setUploadProgress(10);
    return () => setUploadProgress(50); // 返回更新进度的函数
  };
  
  // 执行导入操作
  const handleImport = async () => {
    if (fileList.length === 0 || !fileList[0].originFileObj) {
      return;
    }
    
    setImportLoading(true);
    setUploadStatus('processing');
    setUploadProgress(10);
    
    try {
      // 解析Excel文件
      const file = fileList[0].originFileObj;
      const parseResult = await parseCustomerFile(file);
      
      setUploadProgress(50);
      
      if (!parseResult.isValid) {
        setImportResult({
          success: false,
          message: '导入失败，请检查以下错误:',
          errors: parseResult.errors,
          duplicateCustomers: parseResult.duplicateCustomers
        });
        setUploadStatus('error');
        setImportLoading(false);
        return;
      }
      
      // 增加数据有效性检查
      if (!parseResult.customers || parseResult.customers.length === 0) {
        setImportResult({
          success: false,
          message: '导入失败：解析的客户数据为空',
          errors: ['请确保Excel文件包含有效的客户数据，并且至少有一条记录']
        });
        setUploadStatus('error');
        setImportLoading(false);
        return;
      }
      
      // 打印请求数据进行调试
      console.log('发送的客户数据:', JSON.stringify({
        customers: parseResult.customers
      }));
      
      // 调用服务端API进行批量导入
      const importResponse = await api.post('/api/customers/bulk-import', {
        customers: parseResult.customers
      }, { showSuccessMessage: true });
      
      setUploadProgress(100);
      
      if (importResponse && importResponse.success) {
        setImportResult({
          success: true,
          message: importResponse.message || '客户数据导入成功',
          successCount: importResponse.count || parseResult.customers.length
        });
        setUploadStatus('success');
      } else {
        setImportResult({
          success: false,
          message: importResponse.error || '导入失败，请重试',
          errors: importResponse.errors || []
        });
        setUploadStatus('error');
      }
    } catch (error: any) {
      console.error('客户导入失败:', error);
      
      setImportResult({
        success: false,
        message: '导入失败: ' + (error.message || '未知错误'),
        errors: error.errors || []
      });
      setUploadStatus('error');
    } finally {
      setImportLoading(false);
    }
  };
  
  // 渲染导入结果信息
  const renderImportResult = () => {
    if (!importResult) return null;
    
    if (importResult.success) {
      return (
        <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4">
          <h4 className="text-green-700 font-medium mb-1">导入成功</h4>
          <p className="text-green-600 mb-1">{importResult.message}</p>
          <p className="text-green-600">成功导入 <span className="font-bold">{importResult.successCount}</span> 个客户</p>
        </div>
      );
    }
    
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
        <h4 className="text-red-700 font-medium mb-1">导入失败</h4>
        <p className="text-red-600 mb-1">{importResult.message}</p>
        
        {importResult.errors && importResult.errors.length > 0 && (
          <div className="mt-2">
            <p className="text-red-700 font-medium">错误详情:</p>
            <ul className="list-disc pl-5">
              {importResult.errors.map((error, index) => (
                <li key={index} className="text-red-600 text-sm">{error}</li>
              ))}
            </ul>
          </div>
        )}
        
        {importResult.duplicateCustomers && importResult.duplicateCustomers.length > 0 && (
          <div className="mt-2">
            <p className="text-red-700 font-medium">重复的客户:</p>
            <ul className="list-disc pl-5">
              {importResult.duplicateCustomers.map((customer, index) => (
                <li key={index} className="text-orange-600 text-sm">{customer}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };
  
  // 使用useImperativeHandle正确地暴露方法给父组件
  useImperativeHandle(ref, () => ({
    getParsedCustomers,
    setImportResultStatus,
    startImportProgress
  }));
  
  return (
    <Form
      form={form}
      layout="vertical"
    >
      {renderImportResult()}
      
      {uploadStatus === 'processing' && (
        <div className="mb-4">
          <p className="text-gray-600">正在处理数据，请稍候...</p>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        </div>
      )}
      
      <Form.Item
        name="file"
        rules={[{ required: true, message: '请上传文件' }]}
      >
        <Upload.Dragger
          name="file"
          accept=".xlsx"
          maxCount={1}
          fileList={fileList}
          onChange={handleFileChange}
          beforeUpload={() => false}
          disabled={importLoading}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">仅支持 Excel (.xlsx) 格式文件</p>
        </Upload.Dragger>
      </Form.Item>
      
      <div className="mt-4 mb-4">
        <a 
          href="#" 
          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer" 
          onClick={(e) => {
            e.preventDefault();
            downloadTemplate();
          }}
        >
          <span className="flex items-center">
            <FileExcelOutlined className="mr-1" />
            下载导入模板
          </span>
        </a>
      </div>
      
      <div className="text-gray-500 text-sm bg-gray-50 p-3 rounded-md">
        <h4 className="mt-0 mb-2 text-gray-700 font-medium">导入说明:</h4>
        <ul className="list-disc pl-5 mb-0">
          <li>请严格按照模板格式填写数据</li>
          <li>客户名称、客户性质、客户重要程度为必填项</li>
          <li>客户性质、客户重要程度、客户进展必须使用系统预设的值</li>
          <li>产品需求字段请使用英文逗号或中文逗号分隔多个产品名称</li>
          <li>关联销售和关联代理商请填写系统中已存在的账户名</li>
          <li>系统会自动检查并拒绝重复的客户名称</li>
          <li>第二行如果是示例客户，系统会自动忽略</li>
        </ul>
      </div>
    </Form>
  );
});

export default CustomerImportForm;