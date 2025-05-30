/**
 * 产品管理页面
 * 展示产品列表，提供产品增删改查和库存管理功能
 * 优化了响应式布局，使整个页面滚动而非表格横向滚动
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Card, 
  Button, 
  Modal, 
  message,
  Tabs,
  Form,
  Upload
} from 'antd';
import { 
  PlusOutlined, 
  FileExcelOutlined,
  UploadOutlined,
  InboxOutlined} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { UserRole, Product } from '../shared/types';
import useSWR from 'swr';
import { api } from '../utils/api';
import * as XLSX from 'xlsx';

// 导入拆分后的组件
import ProductFilters from '../components/products/ProductFilters';
import ProductTable from '../components/products/ProductTable';
import ProductStatistics from '../components/products/ProductStatistics';
import ProductForm from '../components/products/ProductForm';
import InventoryForm from '../components/products/InventoryForm';
import InventoryTable from '../components/products/InventoryTable';
import { useResponsive } from '../hooks/useResponsive';

// 导入工具函数
import { prepareProductFormData, PRICING_TIERS } from '../utils/productUtils';
import { parseProductFile } from '../utils/fileUtils';

const { TabPane } = Tabs;

// 统一的API请求函数
const fetcher = async (url: string) => {
  try {
    console.log(`[SWR] 请求 ${url}`);
    
    // 使用 api 工具类发送请求，它会自动添加认证头
    const data = await api.get(url);
    
    // 详细记录返回的数据结构
    if (url.includes('products') && !url.includes('inventory')) {
      console.log(`[SWR] 响应数据 - 产品数量: ${data?.products?.length || 0}`);
      
      if (data?.products?.length > 0) {
        console.log('[SWR] 首个产品样例:', data.products[0]);
      } else {
        console.warn('[SWR] 返回的产品列表为空');
      }
    } else if (url.includes('inventory')) {
      console.log(`[SWR] 响应数据 - 库存记录数量: ${data?.records?.length || 0}`);
    }
    
    return data;
  } catch (error) {
    console.error('[SWR] 数据获取错误:', error);
    throw error;
  }
};

const ProductManagement: React.FC = () => {
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const isInventoryManager = user?.role === UserRole.INVENTORY_MANAGER;
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
  const isFactorySales = user?.role === UserRole.FACTORY_SALES;
  
  // 检查用户是否有编辑权限（只有超级管理员和库存管理员有）
  const hasEditPermission = isSuperAdmin || isInventoryManager;
  
  // 状态管理
  const [keyword, setKeyword] = useState('');
  const [minStock, setMinStock] = useState<number | null>(null);
  const [maxStock, setMaxStock] = useState<number | null>(null);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [inventoryModalVisible, setInventoryModalVisible] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product> | null>(null);
  const [inventoryStats, setInventoryStats] = useState({
    totalProducts: 0,
    lowStockProducts: 0,
    totalStock: 0
  });

  // 添加保存loading状态
  const [saveLoading, setSaveLoading] = useState(false);
  // 添加导入loading状态
  const [importLoading, setImportLoading] = useState(false);
  // 添加查看模式状态
  const [viewMode, setViewMode] = useState(false);
  
  // 文件上传相关状态
  const [fileList, setFileList] = useState<any[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    successCount?: number;
    errors?: string[];
    duplicateProducts?: string[];
  } | null>(null);
  
  const [form] = Form.useForm();
  const [inventoryForm] = Form.useForm();
  const [importForm] = Form.useForm();
  
  // 使用SWR加载产品数据
  const { data, error, mutate } = useSWR('/api/products', fetcher, {
    onError: (err) => {
      console.error('SWR 产品数据加载错误:', err);
      message.error(`产品数据加载失败: ${err.message}`);
    },
    onSuccess: (data) => {
      console.log(`SWR 产品数据加载成功, 获取到 ${data?.products?.length || 0} 条记录`);
      if (!data?.products) {
        console.warn('API返回数据缺少products字段:', data);
      }
    }
  });
  
  // 显式记录API返回的数据
  useEffect(() => {
    if (data) {
      console.log('产品API返回数据:', data);
      if (!data.products) {
        console.error('产品API返回数据结构异常 - 缺少products字段');
      } else if (data.products.length === 0) {
        console.warn('产品API返回空数组');
      }
    }
  }, [data]);
  
  // 显式记录错误
  useEffect(() => {
    if (error) {
      console.error('产品数据加载错误:', error);
    }
  }, [error]);
  
  const products = data?.products || [];
  const loading = !data && !error;
  
  // 简化库存记录请求，不附加筛选参数，将筛选功能移至组件内部
  const recordsUrl = useMemo(() => {
    // 原厂销售角色不应该请求库存记录
    if (isFactorySales) return null;
    
    return '/api/inventory/records';
  }, [isFactorySales]);
  
  // 只有当recordsUrl不为null时才发起请求
  const { data: recordsData, mutate: mutateRecords } = useSWR(recordsUrl, recordsUrl ? fetcher : null);
  console.log('recordsData',recordsData)
  const inventoryRecords = recordsData || [];
  
  
  // 计算库存统计信息
  useEffect(() => {
    if (products.length > 0) {
      const stats = {
        totalProducts: products.length,
        lowStockProducts: products.filter(p => p.stock <= 5000).length,
        totalStock: products.reduce((sum, p) => sum + p.stock, 0)
      };
      setInventoryStats(stats);
    }
  }, [products]);
  
  // 搜索产品处理函数
  const handleSearch = (value: string) => {
    setKeyword(value);
  };
  
  // 重置筛选条件
  const handleResetFilters = () => {
    setMinStock(null);
    setMaxStock(null);
  };
  
  // 过滤产品 - 使用独立的最小值和最大值
  const filteredProducts = useMemo(() => {
    if (!keyword && minStock === null && maxStock === null) return products;
    
    return products.filter(product => {
      const nameMatch = !keyword || 
        product.modelName.toLowerCase().includes(keyword.toLowerCase()) ||
        product.packageType.toLowerCase().includes(keyword.toLowerCase());
      
      // 检查库存是否在范围内
      const minStockMatch = minStock === null || product.stock >= minStock;
      const maxStockMatch = maxStock === null || product.stock <= maxStock;
      
      return nameMatch && minStockMatch && maxStockMatch;
    });
  }, [products, keyword, minStock, maxStock]);
  
  // 打开新增/编辑产品模态框
  const showModal = (product?: Product, isViewMode = false) => {
    setCurrentProduct(product || null);
    setViewMode(isViewMode);
    form.resetFields();
    
    if (product) {
      // 提取阶梯价格
      const formValues: any = { ...product };
      
      // 设置阶梯价格字段
      if (product.pricing && Array.isArray(product.pricing)) {
        product.pricing.forEach((tier, index) => {
          formValues[`price_${index}`] = tier.price;
        });
      }
      
      form.setFieldsValue(formValues);
    }
    
    setModalVisible(true);
  };
  
  // 打开库存管理模态框
  const showInventoryModal = (product: Product) => {
    setCurrentProduct(product);
    inventoryForm.resetFields();
    
    inventoryForm.setFieldsValue({
      modelName: product.modelName,
      packageType: product.packageType,
      currentStock: product.stock,
      operation: 'in'
    });
    
    setInventoryModalVisible(true);
  };

    // 删除用户
    const handleDelete = async (id: string) => {
      try {
        await api.delete(`/api/products/${id}`);
        message.success('产品删除成功');
        mutate();
      } catch (error) {
        message.error(`删除失败: ${error.message || '未知错误'}`);
      }
    };
  
  // 保存产品
  const handleSave = async () => {
    try {
      setSaveLoading(true);
      
      const values = await form.validateFields();
      const productData = prepareProductFormData(values);
      
      if (currentProduct?._id) {
        // 编辑现有产品时，移除库存字段，防止后端验证错误
        delete productData.stock;
        
        await api.put(`/api/products/${currentProduct._id}`, productData);
        message.success('产品更新成功');
        mutate();
      } else {
        await api.post('/api/products', productData);
        message.success('产品创建成功');
        mutate();
      }
      
      setModalVisible(false);
    } catch (error) {
      console.error('Save failed:', error);
      if (error.error) {
        message.error(error.error);
      }
    } finally {
      setSaveLoading(false);
    }
  };
  
  // 处理库存操作
  const handleInventoryOperation = async () => {
    try {
      const values = await inventoryForm.validateFields();
      const { operation, quantity, remark } = values;
      
      if (!currentProduct?._id) return;
      
      // 出库时进行额外验证
      if (operation === 'out' && quantity > currentProduct.stock) {
        message.error(`出库数量不能超过当前库存 (${currentProduct.stock})`);
        return;
      }
      
      // 调用API进行库存操作
      const endpoint = operation === 'in' ? 'stock-in' : 'stock-out';
      
      await api.post(`/api/products/${currentProduct._id}/${endpoint}`, { 
        quantity, 
        remark 
      });
      
      message.success(`产品${operation === 'in' ? '入库' : '出库'}操作成功`);
      mutate();
      mutateRecords();
      setInventoryModalVisible(false);
    } catch (error) {
      console.error('Inventory operation failed:', error);
      if (error.error) {
        message.error(error.error);
      }
    }
  };
  
  // 下载CSV模板函数
  const downloadTemplate = () => {
    // 创建表头行
    const headers = [
      '产品型号',
      '封装型号',
      '库存数量',
      ...PRICING_TIERS.map(tier => `${tier.display} 价格`)
    ];
    
    // 创建工作簿和工作表
    const wb = XLSX.utils.book_new();
    const wsData = [headers]; // 只需要表头行
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // 设置列宽以提高可读性
    const wscols = headers.map(() => ({ wch: 15 }));
    ws['!cols'] = wscols;
    
    // 添加到工作簿
    XLSX.utils.book_append_sheet(wb, ws, '产品导入模板');
    
    // 生成并下载文件
    XLSX.writeFile(wb, '产品导入模板.xlsx');
  };
  
  // 处理文件变化
  const handleFileChange = (info: any) => {
    let newFileList = [...info.fileList];
    
    // 只保留最后上传的文件
    newFileList = newFileList.slice(-1);
    
    // 更新文件状态
    setFileList(newFileList);
    
    // 重置上传状态
    if (newFileList.length === 0) {
      setUploadStatus('idle');
      setImportResult(null);
    }
  };

  // 准备导入数据
  const prepareImportData = async (file: File) => {
    try {
      // 解析文件
      setUploadProgress(30);
      const result = await parseProductFile(file);
      
      if (!result.isValid) {
        setUploadStatus('error');
        setImportResult({
          success: false,
          message: '文件解析失败，请检查数据格式',
          errors: result.errors
        });
        return null;
      }
      
      setUploadProgress(60);
      
      if (result.products.length === 0) {
        setUploadStatus('error');
        setImportResult({
          success: false,
          message: '没有找到有效的产品数据'
        });
        return null;
      }
      
      return { products: result.products };
    } catch (error: any) {
      console.error('解析产品数据失败:', error);
      setUploadStatus('error');
      setImportResult({
        success: false,
        message: `文件处理失败: ${error.message}`
      });
      return null;
    }
  };

  // 执行批量导入
  const handleImport = async () => {
    if (fileList.length === 0) {
      Modal.warning({
        title: '请先上传文件',
        content: '请选择要导入的产品数据文件',
      });
      return;
    }
    
    setImportLoading(true);
    setUploadStatus('processing');
    setUploadProgress(10);
    setImportResult(null);
    
    try {
      const file = fileList[0]?.originFileObj;
      if (!file) {
        throw new Error('未找到上传文件');
      }
      
      // 解析和准备数据
      const importData = await prepareImportData(file);
      if (!importData) {
        setImportLoading(false);
        return;
      }
      
      setUploadProgress(80);
      
      // 调用API上传数据
      const response = await api.post('/api/products/bulk-import', importData, {
        showSuccessMessage: true,
        showErrorMessage: true
      });
      
      // 处理成功响应
      setUploadProgress(100);
      setUploadStatus('success');
      setImportResult({
        success: true,
        message: response.message || '批量导入成功',
        successCount: response.insertedCount || importData.products.length
      });
      
      // 刷新产品列表
      mutate();
      
      // 延迟关闭导入对话框
      setTimeout(() => {
        setImportModalVisible(false);
        setFileList([]);
        setUploadStatus('idle');
      }, 1500);
      
    } catch (error: any) {
      console.error('导入产品失败:', error);
      
      setUploadProgress(100);
      setUploadStatus('error');
      
      // 处理特定的错误响应格式
      if (error.data?.duplicateProducts) {
        setImportResult({
          success: false,
          message: error.error || '导入失败: 存在重复产品',
          duplicateProducts: error.data.duplicateProducts
        });
      } else {
        setImportResult({
          success: false,
          message: error.error || '导入失败，请稍后重试'
        });
      }
    } finally {
      setImportLoading(false);
    }
  };
    
  // 导出产品数据为XLSX - 修改为导出xlsx格式
  const exportProductsToXLSX = () => {
    try {
      // 准备表格数据
      const exportData = filteredProducts.map(product => {
        // 提取阶梯价格
        const pricingData = {};
        if (product.pricing && Array.isArray(product.pricing)) {
          product.pricing.forEach((tier, index) => {
            // 使用从productUtils导入的PRICING_TIERS
            const tierInfo = PRICING_TIERS[index] || {
              min: 1, max: 1000, display: '1-1k', value: 1 
            };
            const tierName = tierInfo.display || `阶梯${index+1}`;
            pricingData[`${tierName} 价格`] = tier.price;
          });
        }
        if (user?.role == UserRole.FACTORY_SALES) {
          return {
            '产品型号': product.modelName,
            '封装型号': product.packageType,
            '库存数量': product.stock,
            '创建时间': product.createdAt ? new Date(product.createdAt).toLocaleString() : '-',
            '更新时间': product.updatedAt ? new Date(product.updatedAt).toLocaleString() : '-',
            ...pricingData
          };
        }
        if (user?.role == UserRole.INVENTORY_MANAGER) {
          return {
            '产品型号': product.modelName,
            '封装型号': product.packageType,
            '库存数量': product.stock,
            '创建时间': product.createdAt ? new Date(product.createdAt).toLocaleString() : '-',
            '更新时间': product.updatedAt ? new Date(product.updatedAt).toLocaleString() : '-',
          };
        }
        // 合并基本数据和阶梯价格
        return {
          '产品型号': product.modelName,
          '封装型号': product.packageType,
          '库存数量': product.stock,
          '创建时间': product.createdAt ? new Date(product.createdAt).toLocaleString() : '-',
          '更新时间': product.updatedAt ? new Date(product.updatedAt).toLocaleString() : '-',
          ...pricingData
        };
      });
      
      console.log('exportData', exportData)
      // 创建工作簿
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // 设置列宽
      const wscols = Object.keys(exportData[0] || {}).map(() => ({ wch: 15 }));
      ws['!cols'] = wscols;
      
      // 添加到工作簿
      XLSX.utils.book_append_sheet(wb, ws, '产品数据');
      
      // 生成包含时间戳的文件名
      const now = new Date();
      const formattedDate = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日${now.getHours()}点${now.getMinutes()}分`;
      const fileName = `产品_${formattedDate}.xlsx`;
      
      // 生成并下载文件
      XLSX.writeFile(wb, fileName);
      message.success('产品数据已成功导出为Excel文件');
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败，请重试');
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
          <p className="text-green-600">成功导入 <span className="font-bold">{importResult.successCount}</span> 个产品</p>
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
        
        {importResult.duplicateProducts && importResult.duplicateProducts.length > 0 && (
          <div className="mt-2">
            <p className="text-red-700 font-medium">重复的产品:</p>
            <ul className="list-disc pl-5">
              {importResult.duplicateProducts.map((product, index) => (
                <li key={index} className="text-orange-600 text-sm">{product}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };
  
  // 处理关闭导入弹窗
  const handleCloseImportModal = () => {
    setImportModalVisible(false);
    // 重置相关状态
    setImportResult(null);
    setUploadStatus('idle');
    setUploadProgress(0);
    setFileList([]); // 添加这行，确保关闭弹窗时清空文件列表
  };
  
  return (
    <div className="overflow-x-hidden">
      {isInventoryManager && (
        <ProductStatistics
          totalProducts={inventoryStats.totalProducts}
          lowStockProducts={inventoryStats.lowStockProducts}
          totalStock={inventoryStats.totalStock}
        />
      )}
      
      <Tabs defaultActiveKey="products">
        <TabPane 
          tab="产品管理" 
          key="products"
        >
          <Card className="mb-4">
            {/* 优化按钮和搜索区域布局 */}
            <div className="mb-4">
              {/* 操作按钮组 - 移动端按钮在同一行 */}
              <div className={`flex ${isMobile ? 'flex-wrap' : ''} gap-2 mb-3`}>
                {hasEditPermission && (
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => showModal()}
                    size={isMobile ? "middle" : undefined}
                  >
                    {isMobile ? "新增" : "新增产品"}
                  </Button>
                )}
                
                {hasEditPermission && !isMobile && (
                  <Button
                    icon={<UploadOutlined />}
                    onClick={() => setImportModalVisible(true)}
                    size={isMobile ? "middle" : undefined}
                  >
                    {isMobile ? "导入" : "批量导入"}
                  </Button>
                )}

                <Button
                  icon={<FileExcelOutlined />}
                  onClick={exportProductsToXLSX}
                  size={isMobile ? "middle" : undefined}
                >
                  {isMobile ? "导出" : "批量导出"}
                </Button>
              </div>
            </div>
            
            {/* 产品筛选组件 */}
            <ProductFilters
              keyword={keyword}
              minStock={minStock}
              maxStock={maxStock}
              onSearch={handleSearch}
              onMinStockChange={setMinStock}
              onMaxStockChange={setMaxStock}
              onReset={handleResetFilters}
            />
            
            {/* 产品表格组件 */}
            <ProductTable
              products={filteredProducts}
              loading={loading}
              hasEditPermission={hasEditPermission}
              isSuperAdmin={isSuperAdmin}
              showModal={showModal}
              handleDelete={handleDelete}
              showInventoryModal={showInventoryModal}
            />
          </Card>
        </TabPane>
        
        {
          hasEditPermission && <TabPane 
          tab="库存记录" 
          key="inventory"
        >
          <Card>
            {/* 库存记录表格组件 */}
            <InventoryTable
              records={inventoryRecords}
            />
          </Card>
        </TabPane>
        }
      </Tabs>
      
      {/* 添加/编辑产品模态框 */}
      <Modal
        title={viewMode ? '产品详情' : (currentProduct ? '编辑产品' : '新增产品')}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            {viewMode ? '关闭' : '取消'}
          </Button>,
          (!viewMode && hasEditPermission) ? (
            <Button 
              key="submit" 
              type="primary" 
              onClick={handleSave}
              loading={saveLoading}
            >
              保存
            </Button>
          ) : null
        ]}
        width={800}
      >
        <ProductForm
          form={form}
          currentProduct={currentProduct}
          viewMode={viewMode}
        />
      </Modal>
      
      {/* 库存操作模态框 */}
      <Modal
        title="库存操作"
        open={inventoryModalVisible}
        onCancel={() => setInventoryModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setInventoryModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleInventoryOperation}>
            确认
          </Button>
        ]}
      >
        <InventoryForm
          form={inventoryForm}
          currentProduct={currentProduct as Product}
        />
      </Modal>
      
      {/* 批量导入模态框 */}
      <Modal
        title="批量导入产品"
        open={importModalVisible}
        onCancel={handleCloseImportModal}
        footer={[
          <Button key="cancel" onClick={handleCloseImportModal}>
            取消
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            onClick={handleImport}
            loading={importLoading}
            disabled={fileList.length === 0}
          >
            导入
          </Button>
        ]}
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
        
        <div className="flex justify-between items-center mt-4 mb-4">
          <a 
            href="#" 
            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer" 
            onClick={(e) => {
              e.preventDefault();
              downloadTemplate();
            }}
          >
            下载导入模板
          </a>
        </div>
        
        <div className="text-gray-500 text-sm bg-gray-50 p-3 rounded-md">
          <h4 className="mt-0 mb-2 text-gray-700 font-medium">导入说明:</h4>
          <ul className="list-disc pl-5 mb-0">
            <li>请严格按照模板格式填写数据</li>
            <li>产品型号、封装型号为必填项</li>
            <li>价格必须为正数，库存数量必须为非负整数</li>
            <li>所有阶梯价格必须填写完整</li>
            <li>系统会自动检查并拒绝已存在的产品型号与封装型号组合</li>
          </ul>
        </div>
      </Modal>
    </div>
  );
};

export default ProductManagement;