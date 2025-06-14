/**
 * 文件操作相关工具函数
 */
import * as XLSX from 'xlsx';
import { PricingTier } from '../shared/types';
import { PRICING_TIERS } from './productUtils';
import { Customer, CustomerNature, CustomerImportance, CustomerProgress } from '../shared/types';
import { api } from './api';

/**
 * 将Excel或CSV文件解析为产品数据
 */
export const parseProductFile = async (file: File): Promise<{
  products: Array<{
    modelName: string;
    packageType: string;
    stock: number;
    pricing: PricingTier[];
  }>,
  isValid: boolean,
  errors: string[]
}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const errors: string[] = [];
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // 将工作表转换为JSON
        const rawProducts = XLSX.utils.sheet_to_json(worksheet);
        
        if (rawProducts.length === 0) {
          resolve({
            products: [],
            isValid: false,
            errors: ['文件不包含任何数据']
          });
          return;
        }
        
        // 验证并转换数据
        const products = [];
        
        for (let i = 0; i < rawProducts.length; i++) {
          const row: any = rawProducts[i];
          const rowIndex = i + 2; // 考虑到标题行和1-索引
          
          // 提取字段 - 处理可能的不同列名
          const modelName = row['产品型号'] || row['型号'] || row['产品名称'] || row['model'] || '';
          const packageType = row['封装型号'] || row['封装'] || row['package'] || '';
          const stockStr = row['库存数量'] || row['库存'] || row['stock'] || '0';
          
          // 验证必填字段
          if (!modelName) {
            errors.push(`第${rowIndex}行: 产品型号不能为空`);
            continue;
          }
          
          if (!packageType) {
            errors.push(`第${rowIndex}行: 封装型号不能为空`);
            continue;
          }
          
          // 解析库存数量
          const stock = parseInt(stockStr.toString());
          if (isNaN(stock) || stock < 0) {
            errors.push(`第${rowIndex}行: 库存数量必须是非负整数`);
            continue;
          }
          
          // 构建阶梯价格
          const pricing: PricingTier[] = [];
          let hasPricingError = false;
          
          for (let j = 0; j < PRICING_TIERS.length; j++) {
            const tier = PRICING_TIERS[j];
            // 尝试提取价格 - 处理可能的不同列名可能
            const priceKey = `${tier.display} 价格` || `${tier.display}价格` || `price_${j}`;
            let price = row[priceKey];
            
            // 如果没有找到价格，尝试第二种可能的命名方式
            if (price === undefined) {
              price = row[`${tier.display.replace('-', '至')} 价格`];
            }
            
            // 尝试第三种可能方式
            if (price === undefined) {
              price = row[`价格${j+1}`];
            }
            
            if (price === undefined) {
              errors.push(`第${rowIndex}行: 缺少${tier.display}价格区间`);
              hasPricingError = true;
              break;
            }
            
            const priceValue = parseFloat(price.toString());
            if (isNaN(priceValue) || priceValue <= 0) {
              errors.push(`第${rowIndex}行: ${tier.display}价格必须是正数`);
              hasPricingError = true;
              break;
            }
            
            pricing.push({
              quantity: tier.value,
              price: priceValue
            });
          }
          
          if (hasPricingError) {
            continue;
          }
          
          // 添加有效的产品数据
          products.push({
            modelName,
            packageType,
            stock,
            pricing
          });
        }
        
        resolve({
          products,
          isValid: products.length > 0 && errors.length === 0,
          errors
        });
      } catch (error) {
        console.error('文件解析错误:', error);
        reject(new Error('文件格式错误，请确保上传的是有效的Excel或CSV文件'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('文件读取错误'));
    };
    
    // 将文件读取为二进制字符串
    reader.readAsBinaryString(file);
  });
};

/**
 * 将Excel文件解析为客户数据
 */
export const parseCustomerFile = async (file: File): Promise<{
  customers: Partial<Customer>[];
  isValid: boolean;
  errors: string[];
  duplicateCustomers?: string[];
}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const errors: string[] = [];
    
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // 将工作表转换为JSON
        const rawCustomers = XLSX.utils.sheet_to_json(worksheet);
        
        if (rawCustomers.length === 0) {
          resolve({
            customers: [],
            isValid: false,
            errors: ['文件不包含任何数据']
          });
          return;
        }
        
        // 验证并转换数据
        const customers: Partial<Customer>[] = [];
        const customerNames: string[] = []; // 用于检查重复
        
        for (let i = 0; i < rawCustomers.length; i++) {
          const row: any = rawCustomers[i];
          const rowIndex = i + 2; // 考虑到标题行和1-索引
          
          // 提取字段 - 处理可能的不同列名
          const name = row['客户名称'] || '';
          
          // 特殊处理：如果是第二行(rowIndex为2)且客户名称为"示例客户"，则跳过
          if (name === '示例客户名称') {
            console.log('跳过示例客户数据行');
            continue;
          }
          
          const natureStr = safeExtractAndTrim(row['客户性质']) || '';
          const importanceStr = safeExtractAndTrim(row['客户重要程度']) || '';
          const applicationField = row['应用领域'] || '';
          const productNeedsStr = row['产品需求(产品名称，用逗号分隔)'] || row['产品需求'] || '';
          const contactPerson = row['联系人'] || '';
          const contactPhone = `${row['联系方式'] || ''}`;
          const address = row['公司地址'] || '';
          const progressStr = row['客户进展'] || CustomerProgress.InitialContact;
          const annualDemandStr = row['年需求量(片)'] || row['年需求量'] || '0';
          const relatedSalesName = row['关联销售名称'] || '';
          const relatedAgentName = row['关联代理商名称'] || '';
          
          // 验证必填字段
          if (!name) {
            errors.push(`第${rowIndex}行: 客户名称不能为空`);
            continue;
          }
          
          // 检查重复的客户名称
          if (customerNames.includes(name)) {
            errors.push(`第${rowIndex}行: 客户名称 "${name}" 在表格中重复`);
            continue;
          }
          customerNames.push(name);
          
          // 验证客户性质
          let nature: CustomerNature | undefined = undefined;
          if (!natureStr) {
            errors.push(`第${rowIndex}行: 客户性质不能为空`);
            continue;
          } else {
            const validNatures = Object.values(CustomerNature);
            nature = validNatures.find(n => n === natureStr) as CustomerNature;
            
            if (!nature) {
              errors.push(`第${rowIndex}行: 客户性质 "${natureStr}" 无效，有效值为: ${validNatures.join(', ')}`);
              continue;
            }
          }
          
          // 验证客户重要程度
          let importance: CustomerImportance | undefined = undefined;
          if (!importanceStr) {
            errors.push(`第${rowIndex}行: 客户重要程度不能为空`);
            continue;
          } else {
            const validImportances = Object.values(CustomerImportance);
            importance = validImportances.find(i => i === importanceStr) as CustomerImportance;
            
            if (!importance) {
              errors.push(`第${rowIndex}行: 客户重要程度 "${importanceStr}" 无效，有效值为: ${validImportances.join(', ')}`);
              continue;
            }
          }
          
          // 验证客户进展
          let progress: CustomerProgress = CustomerProgress.InitialContact; // 默认值
          if (progressStr) {
            const validProgresses = Object.values(CustomerProgress)
              .filter(p => p !== CustomerProgress.PUBLIC_POOL); // 过滤掉不能直接设置的公海状态
            
            progress = validProgresses.find(p => p === progressStr) as CustomerProgress;
            
            if (!progress) {
              errors.push(`第${rowIndex}行: 客户进展 "${progressStr}" 无效，有效值为: ${validProgresses.join(', ')}`);
              continue;
            }
          }
          
          // 解析年需求量
          const annualDemand = parseInt(annualDemandStr.toString());
          if (isNaN(annualDemand) || annualDemand < 0) {
            errors.push(`第${rowIndex}行: 年需求量必须是非负整数`);
            continue;
          }
          
          // 解析产品需求 - 将逗号分隔的字符串转换为数组
          const productNeeds = productNeedsStr 
          ? productNeedsStr.toString().split(/[,，]/) // 使用正则表达式匹配中文或英文逗号
            .map((p: string) => p.trim())
            .filter((p: any) => p)
          : [];
          
          // 构建客户对象
          const customer: Partial<Customer> = {
            name,
            nature,
            importance,
            applicationField,
            productNeeds,
            contactPerson,
            contactPhone,
            address,
            progress,
            annualDemand,
            relatedSalesName,
            relatedAgentName,
            isInPublicPool: false // 默认不在公海池中
          };
          
          customers.push(customer);
        }
        
        // 验证是否有任何客户被成功解析
        if (customers.length === 0) {
          resolve({
            customers: [],
            isValid: false,
            errors: errors.length > 0 ? errors : ['无法解析任何有效客户数据']
          });
          return;
        }
        
        // 检查服务器端是否有重复客户名称
        try {
          // 收集所有客户名称
          const customerNamesToCheck = customers.map(c => c.name);
          
          // 调用API检查重复客户名称
          const duplicateResponse = await api.post('/api/customers/check-duplicates', {
            customerNames: customerNamesToCheck
          });
          
          if (duplicateResponse && duplicateResponse.duplicates && duplicateResponse.duplicates.length > 0) {
            const duplicateCustomers = duplicateResponse.duplicates;
            
            resolve({
              customers,
              isValid: false,
              errors: ['文件中包含与系统中已存在的客户重名，请修改后重新上传'],
              duplicateCustomers
            });
            return;
          }
        } catch (error) {
          console.error('检查重复客户失败:', error);
          // 继续处理，不阻止导入
        }
        
        resolve({
          customers,
          isValid: customers.length > 0 && errors.length === 0,
          errors
        });
      } catch (error) {
        console.error('文件解析错误:', error);
        reject(new Error('文件格式错误，请确保上传的是有效的Excel文件'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('文件读取错误'));
    };
    
    // 将文件读取为二进制字符串
    reader.readAsBinaryString(file);
  });
};

/**
 * 安全地提取并去除前后空格的字符串值
 */
const safeExtractAndTrim = (value: any): string => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
};