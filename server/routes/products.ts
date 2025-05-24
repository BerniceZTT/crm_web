/**
 * 产品管理相关路由
 * 处理产品的CRUD操作和库存管理
 */

import { Hono } from "hono";
import { zValidator } from '@hono/zod-validator';
import { z } from "zod";
import { authMiddleware, permissionMiddleware } from "../utils/auth";
import { Product, UserRole } from "../../shared/types";
import { logDbOperation, log, logInventoryOperation, logError } from "../utils/logger";
import { executeDbOperation, executeInventoryOperation } from "../utils/database";
import { successResponse, errorResponse, inventoryOperationResponse } from "../utils/apiResponse";

const productRouter = new Hono();

// 所有路由都需要认证
productRouter.use('*', authMiddleware);

// 获取产品列表
productRouter.get('/', async (c) => {
  const query = c.req.query();
  const currentUser = c.get('user');
  
  log('info', `产品列表请求 - 用户角色: ${currentUser.role}`, { query });
  
  // 分页参数
  const page = parseInt(query.page || '1');
  const limit = parseInt(query.limit || '20');
  const skip = (page - 1) * limit;
  
  // 搜索条件
  const searchQuery: any = {};
  
  if (query.keyword) {
    searchQuery.$or = [
      { modelName: { $regex: query.keyword, $options: 'i' } },
      { packageType: { $regex: query.keyword, $options: 'i' } }
    ];
  }
  
  try {
    const collection = db.collection('4d2a803d_products');
    
    // 获取总数
    const totalCount = await collection.countDocuments(searchQuery);
    log('info', `产品总数: ${totalCount}`, { searchQuery });
    
    // 检查集合中是否有数据
    const hasData = totalCount > 0;
    if (!hasData) {
      log('warn', '产品集合中没有数据');
      
      // 检查集合是否存在
      const collections = await db.listCollections({ name: '4d2a803d_products' }).toArray();
      if (collections.length === 0) {
        log('error', '产品集合不存在');
      }
    }
    
    // 查询数据
    const products = await collection.find(searchQuery)
      .sort({ modelName: 1, packageType: 1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    
    // 详细记录查询结果
    log('info', `查询到 ${products.length} 个产品`, {
      firstProduct: products.length > 0 ? JSON.stringify(products[0]) : '无数据',
      productIds: products.map(p => p._id).slice(0, 5)
    });
    
    // 检查数据字段是否符合前端期望
    if (products.length > 0) {
      const sampleProduct = products[0];
      const requiredFields = ['_id', 'modelName', 'packageType', 'stock', 'pricing'];
      const missingFields = requiredFields.filter(field => !(field in sampleProduct));
      
      if (missingFields.length > 0) {
        log('warn', `产品数据缺少必要字段: ${missingFields.join(', ')}`, { sampleProduct });
      }
      
      // 检查pricing字段格式
      if ('pricing' in sampleProduct) {
        if (!Array.isArray(sampleProduct.pricing)) {
          log('warn', 'pricing字段不是数组', { pricingType: typeof sampleProduct.pricing });
        } else if (sampleProduct.pricing.length !== 7) {
          log('warn', `pricing数组长度不是7: ${sampleProduct.pricing.length}`);
        }
      }
    }
    
    return c.json({
      products,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    log('error', "获取产品列表出错:", { error: error.message, stack: error.stack });
    return c.json({ error: "获取产品列表失败" }, 500);
  }
});

// 获取单个产品
productRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  
  try {
    const collection = db.collection('4d2a803d_products');
    
    const product = await collection.findOne({ _id: new mongo.ObjectId(id) });
    
    if (!product) {
      return c.json({ error: "产品不存在" }, 404);
    }
    
    return c.json({ product });
  } catch (error) {
    console.error("获取产品出错:", error.message);
    return c.json({ error: "获取产品失败" }, 500);
  }
});

// 创建产品 (仅超级管理员或库存管理员)
const pricingTierSchema = z.object({
  quantity: z.number().int().min(1, "数量必须大于或等于1"),
  price: z.number().positive()
});

const createProductSchema = z.object({
  modelName: z.string().min(1, "型号名称不能为空"),
  packageType: z.string().min(1, "封装型号不能为空"),
  stock: z.number().int().nonnegative(),
  pricing: z.array(pricingTierSchema).length(7, "必须提供7档阶梯定价")
});

productRouter.post('/', 
  zValidator('json', createProductSchema),
  async (c) => {
    const productData = await c.req.json();
    const currentUser = c.get('user');
    
    // 验证权限
    if (currentUser.role !== UserRole.SUPER_ADMIN && 
        currentUser.role !== UserRole.INVENTORY_MANAGER) {
      return c.json({ error: "无权创建产品" }, 403);
    }
    
    try {
      log('info', '开始创建产品', { modelName: productData.modelName, packageType: productData.packageType });
      const collection = db.collection('4d2a803d_products');
      
      // 检查产品是否已存在
      const existingProduct = await collection.findOne({
        modelName: productData.modelName,
        packageType: productData.packageType
      });
      
      if (existingProduct) {
        return c.json({ error: "该型号产品的封装类型已存在" }, 400);
      }
      
      // 创建新产品
      const newProduct: Product = {
        ...productData
      };
      
      const result = await collection.insertOne(newProduct);
      log('info', '产品成功插入数据库', { productId: result.insertedId.toString() });
      
      // 如果有初始库存，创建库存记录
      if (productData.stock > 0) {
        try {
          const recordsCollection = db.collection('4d2a803d_inventory_records');
          await recordsCollection.insertOne({
            productId: result.insertedId.toString(),
            modelName: productData.modelName,
            packageType: productData.packageType,
            operationType: 'in',
            quantity: productData.stock,
            remark: '产品初始库存', // 修正: 由reason改为remark
            operator: currentUser.username,
            operatorId: currentUser._id.toString(),
            operationTime: new Date()
          });
          log('info', '成功创建初始库存记录', { 
            productId: result.insertedId.toString(),
            stock: productData.stock 
          });
        } catch (recordError) {
          // 库存记录创建失败，但产品已创建成功，记录错误但不影响产品创建成功的响应
          log('error', '创建初始库存记录失败，但产品已创建成功', { 
            error: recordError.message,
            stack: recordError.stack,
            productId: result.insertedId.toString()
          });
          // 不抛出异常，继续返回成功响应
        }
      }
      
      return c.json({
        message: "创建产品成功",
        product: {
          ...newProduct,
          _id: result.insertedId
        }
      }, 201);
    } catch (error) {
      log('error', "创建产品出错:", { 
        error: error.message, 
        stack: error.stack,
        productData: JSON.stringify(productData)
      });
      return c.json({ error: "创建产品失败: " + error.message }, 500);
    }
  }
);

// 获取库存记录
productRouter.get('/inventory-records', async (c) => {
  const currentUser = c.get('user');
  
  // 验证权限
  if (currentUser.role !== UserRole.SUPER_ADMIN && 
      currentUser.role !== UserRole.INVENTORY_MANAGER) {
    return c.json({ error: "无权查看库存记录" }, 403);
  }
  
  const query = c.req.query();
  const page = parseInt(query.page || '1');
  const limit = parseInt(query.limit || '20');
  const skip = (page - 1) * limit;
  
  // 筛选条件
  const searchQuery: any = {};
  
  if (query.productId) {
    searchQuery.productId = query.productId;
  }
  
  if (query.operationType) {
    searchQuery.operationType = query.operationType;
  }
  
  // 时间范围筛选
  const days = parseInt(query.days || '30');
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  searchQuery.operationTime = { $gte: fromDate };
  
  try {
    const collection = db.collection('4d2a803d_inventory_records');
    
    // 获取总数
    const totalCount = await collection.countDocuments(searchQuery);
    
    // 查询数据
    const records = await collection.find(searchQuery)
      .sort({ operationTime: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    
    return c.json({
      records,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error("获取库存记录出错:", error.message);
    return c.json({ error: "获取库存记录失败" }, 500);
  }
});

// 批量导入产品 (仅超级管理员或库存管理员)
const bulkImportProductSchema = z.object({
  products: z.array(
    z.object({
      modelName: z.string().min(1, "型号名称不能为空"),
      packageType: z.string().min(1, "封装型号不能为空"),
      stock: z.number().int().nonnegative(),
      pricing: z.array(pricingTierSchema).length(7, "必须提供7档阶梯定价")
    })
  )
});

productRouter.post('/bulk-import', 
  zValidator('json', bulkImportProductSchema),
  async (c) => {
    const { products } = await c.req.json();
    const currentUser = c.get('user');
    
    // 验证权限
    if (currentUser.role !== UserRole.SUPER_ADMIN && 
        currentUser.role !== UserRole.INVENTORY_MANAGER) {
      return c.json({ error: "无权导入产品" }, 403);
    }
    
    try {
      const collection = db.collection('4d2a803d_products');
      
      // 检查产品是否已存在
      const modelPackagePairs = products.map(p => ({
        modelName: p.modelName,
        packageType: p.packageType
      }));
      
      // 构建查询条件来一次性检查所有产品
      const orConditions = modelPackagePairs.map(pair => ({
        modelName: pair.modelName,
        packageType: pair.packageType
      }));
      
      const existingProducts = await collection.find({
        $or: orConditions
      }).toArray();
      
      if (existingProducts.length > 0) {
        // 构建重复产品的消息
        const duplicateProducts = existingProducts.map(p => 
          `${p.modelName}/${p.packageType}`
        );
        
        return c.json({ 
          error: "以下产品型号已存在", 
          duplicateProducts 
        }, 400);
      }
      
      // 插入所有产品
      const result = await collection.insertMany(products);
      
      return c.json({
        message: "批量导入产品成功",
        insertedCount: result.insertedCount
      }, 201);
    } catch (error) {
      console.error("批量导入产品出错:", error.message);
      return c.json({ error: "批量导入产品失败" }, 500);
    }
  }
);

// 更新产品
const updateProductSchema = z.object({
  modelName: z.string().min(1, "型号名称不能为空").optional(),
  packageType: z.string().min(1, "封装型号不能为空").optional(),
  stock: z.number().int().nonnegative().optional(),
  pricing: z.array(pricingTierSchema).length(7, "必须提供7档阶梯定价").optional()
});

productRouter.put('/:id', 
  zValidator('json', updateProductSchema),
  async (c) => {
    const id = c.req.param('id');
    const updateData = await c.req.json();
    const currentUser = c.get('user');
    
    // 验证权限
    if (currentUser.role !== UserRole.SUPER_ADMIN && 
        currentUser.role !== UserRole.INVENTORY_MANAGER) {
      return c.json({ error: "无权更新产品" }, 403);
    }
    
    // 移除库存管理员只能更新库存的限制
    // 但任何角色都不能通过此接口直接修改库存数量（库存只能通过出入库操作修改）
    if (updateData.stock !== undefined) {
      return c.json({ error: "库存数量只能通过入库/出库操作进行修改" }, 403);
    }
    
    try {
      const collection = db.collection('4d2a803d_products');
      
      // 检查产品是否存在
      const product = await collection.findOne({ _id: new mongo.ObjectId(id) });
      if (!product) {
        return c.json({ error: "产品不存在" }, 404);
      }
      
      // 如果更新型号或封装类型，检查是否已存在
      if ((updateData.modelName && updateData.modelName !== product.modelName) || 
          (updateData.packageType && updateData.packageType !== product.packageType)) {
        
        const existingProduct = await collection.findOne({
          modelName: updateData.modelName || product.modelName,
          packageType: updateData.packageType || product.packageType,
          _id: { $ne: new mongo.ObjectId(id) }
        });
        
        if (existingProduct) {
          return c.json({ error: "该型号产品的封装类型已存在" }, 400);
        }
      }
      
      // 更新产品
      const result = await collection.updateOne(
        { _id: new mongo.ObjectId(id) },
        { $set: updateData }
      );
      
      if (result.modifiedCount === 0) {
        return c.json({ message: "产品数据未变更" });
      }
      
      return c.json({ message: "更新产品成功" });
    } catch (error) {
      console.error("更新产品出错:", error.message);
      return c.json({ error: "更新产品失败" }, 500);
    }
  }
);

// 删除产品 (仅超级管理员)
productRouter.delete('/:id', permissionMiddleware('products', 'delete'), async (c) => {
  const id = c.req.param('id');
  
  try {
    const collection = db.collection('4d2a803d_products');
    
    // 检查产品是否存在
    const product = await collection.findOne({ _id: new mongo.ObjectId(id) });
    if (!product) {
      return c.json({ error: "产品不存在" }, 404);
    }
    
    // 检查是否有客户正在使用该产品
    const customersCollection = db.collection('4d2a803d_customers');
    const customerCount = await customersCollection.countDocuments({
      productNeeds: { $elemMatch: { $regex: product.modelName } }
    });
    
    if (customerCount > 0) {
      return c.json({ 
        error: "该产品有关联客户，无法删除", 
        customerCount 
      }, 400);
    }
    
    // 删除产品
    const result = await collection.deleteOne({ _id: new mongo.ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return c.json({ error: "产品不存在或已被删除" }, 404);
    }
    
    return c.json({ message: "删除产品成功" });
  } catch (error) {
    console.error("删除产品出错:", error.message);
    return c.json({ error: "删除产品失败" }, 500);
  }
});

// 入库操作 (库存管理员和超级管理员) - 增强版
const stockOperationSchema = z.object({
  quantity: z.number().int().positive("数量必须是正整数"),
  remark: z.string().optional()
});

productRouter.post('/:id/stock-in', 
  zValidator('json', stockOperationSchema),
  async (c) => {
    const id = c.req.param('id');
    const { quantity, remark } = await c.req.json();
    const currentUser = c.get('user');
    
    // 验证权限
    if (currentUser.role !== UserRole.SUPER_ADMIN && 
        currentUser.role !== UserRole.INVENTORY_MANAGER) {
      return errorResponse(c, "无权执行入库操作", 403);
    }
    
    log('info', `执行入库操作：产品ID=${id}, 数量=${quantity}`, {
      user: currentUser.username,
      userId: currentUser.id,
      remark
    });
    
    try {
      const collection = db.collection('4d2a803d_products');
      
      // 检查产品是否存在
      const product = await collection.findOne({ _id: new mongo.ObjectId(id) });
      if (!product) {
        return errorResponse(c, "产品不存在", 404);
      }
      
      // 创建操作ID用于幂等性检查
      const operationId = `in_${id}_${quantity}_${Date.now()}`;
      
      // 使用增强的库存操作函数
      const operationResult = await executeInventoryOperation(
        // 检查此操作是否已经完成（幂等性检查）
        async () => {
          const recordsCollection = db.collection('4d2a803d_inventory_records');
          const existingRecord = await recordsCollection.findOne({
            productId: id,
            operationType: 'in',
            quantity: quantity,
            operationId: operationId,
            // 添加一个时间窗口，避免检查太多记录
            operationTime: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
          });
          return !!existingRecord;
        },
        // 实际执行的操作逻辑
        async () => {
          // 第一步：更新库存
          const updateResult = await collection.updateOne(
            { _id: new mongo.ObjectId(id) },
            { $inc: { stock: quantity } }
          );
          
          if (updateResult.modifiedCount === 0) {
            throw new Error("库存更新失败");
          }
          
          // 第二步：创建入库记录
          const recordsCollection = db.collection('4d2a803d_inventory_records');
          const recordResult = await recordsCollection.insertOne({
            productId: id,
            modelName: product.modelName,
            packageType: product.packageType,
            operationType: 'in',
            quantity,
            remark,
            operator: currentUser.username,
            operatorId: currentUser.id || currentUser._id.toString(),
            operationTime: new Date(),
            operationId: operationId // 添加操作ID用于幂等性检查
          });
          
          if (!recordResult.insertedId) {
            // 如果记录创建失败但库存已更新，标记为不确定状态
            log('error', '入库记录创建失败，但库存可能已更新', {
              productId: id,
              quantity
            });
            
            // 返回包含状态不确定标记的结果
            return {
              statusUncertain: true,
              inventoryOperation: true,
              message: '入库操作状态不确定，请刷新页面查看最新库存'
            };
          }
          
          // 第三步：重新查询更新后的库存，确认结果
          const updatedProduct = await collection.findOne({ _id: new mongo.ObjectId(id) });
          
          // 记录成功的库存操作
          logInventoryOperation('入库', id, quantity, true);
          
          return {
            success: true,
            message: "入库操作成功",
            newStock: updatedProduct.stock,
            expectedStock: product.stock + quantity
          };
        },
        3 // 重试次数
      );
      
      // 判断操作结果状态
      if (operationResult.statusUncertain) {
        // 状态不确定，返回特殊响应
        return inventoryOperationResponse(c, {
          message: "入库操作状态不确定，请刷新页面查看最新库存",
          productId: id
        }, false);
      } else if (operationResult.success) {
        // 操作成功
        return successResponse(c, {
          message: "入库操作成功",
          newStock: operationResult.newStock
        });
      } else if (operationResult.alreadyCompleted) {
        // 操作已经完成（幂等性检查）
        return successResponse(c, {
          message: "入库操作已完成",
          warning: "此操作可能是重复提交"
        });
      }
      
      // 未预期的结果
      throw new Error("入库操作失败：未知原因");
      
    } catch (error) {
      log('error', "入库操作出错:", { 
        error: error.message, 
        stack: error.stack,
        productId: id,
        quantity
      });
      
      // 对于已标记的库存操作错误，使用不确定状态响应
      if (error.inventoryOperation || error.statusUncertain) {
        return inventoryOperationResponse(c, {
          error: error.message,
          productId: id
        }, false);
      }
      
      // 普通错误
      return errorResponse(c, `入库操作失败: ${error.message}`, 500);
    }
  }
);

// 出库操作 (库存管理员和超级管理员) - 修复版
productRouter.post('/:id/stock-out', 
  zValidator('json', stockOperationSchema),
  async (c) => {
    const id = c.req.param('id');
    const { quantity, remark } = await c.req.json();
    const currentUser = c.get('user');
    
    // 验证权限
    if (currentUser.role !== UserRole.SUPER_ADMIN && 
        currentUser.role !== UserRole.INVENTORY_MANAGER) {
      return errorResponse(c, "无权执行出库操作", 403);
    }
    
    log('info', `执行出库操作：产品ID=${id}, 数量=${quantity}`, {
      user: currentUser.username,
      userId: currentUser.id,
      remark
    });
    
    try {
      const collection = db.collection('4d2a803d_products');
      
      // 检查产品是否存在
      const product = await collection.findOne({ _id: new mongo.ObjectId(id) });
      if (!product) {
        return errorResponse(c, "产品不存在", 404);
      }
      
      // 检查库存是否充足
      if (product.stock < quantity) {
        return errorResponse(c, `库存不足，当前库存: ${product.stock}`, 400);
      }
      
      // 创建操作ID用于幂等性检查
      const operationId = `out_${id}_${quantity}_${Date.now()}`;
      
      // 使用增强的库存操作函数
      const operationResult = await executeInventoryOperation(
        // 检查此操作是否已经完成
        async () => {
          const recordsCollection = db.collection('4d2a803d_inventory_records');
          const existingRecord = await recordsCollection.findOne({
            productId: id,
            operationType: 'out',
            quantity: quantity,
            operationId: operationId,
            operationTime: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
          });
          return !!existingRecord;
        },
        // 实际执行的操作逻辑
        async () => {
          // 第一步：更新库存
          const updateResult = await collection.updateOne(
            { _id: new mongo.ObjectId(id), stock: { $gte: quantity } },
            { $inc: { stock: -quantity } }
          );
          
          if (updateResult.modifiedCount === 0) {
            // 再次检查是否因为库存不足导致的更新失败
            const currentProduct = await collection.findOne({ _id: new mongo.ObjectId(id) });
            if (currentProduct.stock < quantity) {
              throw new Error(`库存不足，当前库存: ${currentProduct.stock}`);
            } else {
              throw new Error("出库操作失败");
            }
          }
          
          // 第二步：创建出库记录
          const recordsCollection = db.collection('4d2a803d_inventory_records');
          const recordResult = await recordsCollection.insertOne({
            productId: id,
            modelName: product.modelName,
            packageType: product.packageType,
            operationType: 'out',
            quantity,
            remark,
            operator: currentUser.username,
            operatorId: currentUser.id || currentUser._id.toString(),
            operationTime: new Date(),
            operationId: operationId
          });
          
          if (!recordResult.insertedId) {
            log('error', '出库记录创建失败，但库存可能已更新', {
              productId: id,
              quantity
            });
            
            return {
              statusUncertain: true,
              inventoryOperation: true,
              message: '出库操作状态不确定，请刷新页面查看最新库存'
            };
          }
          
          // 第三步：重新查询更新后的库存
          const updatedProduct = await collection.findOne({ _id: new mongo.ObjectId(id) });
          
          // 记录成功的库存操作
          logInventoryOperation('出库', id, quantity, true);
          
          return {
            success: true,
            message: "出库操作成功",
            newStock: updatedProduct.stock,
            expectedStock: product.stock - quantity
          };
        },
        3 // 重试次数
      );
      
      // 判断操作结果
      if (operationResult.statusUncertain) {
        return inventoryOperationResponse(c, {
          message: "出库操作状态不确定，请刷新页面查看最新库存",
          productId: id
        }, false);
      } else if (operationResult.success) {
        return successResponse(c, {
          message: "出库操作成功",
          newStock: operationResult.newStock
        });
      } else if (operationResult.alreadyCompleted) {
        return successResponse(c, {
          message: "出库操作已完成",
          warning: "此操作可能是重复提交"
        });
      }
      
      throw new Error("出库操作失败：未知原因");
      
    } catch (error) {
      log('error', "出库操作出错:", { 
        error: error.message, 
        stack: error.stack,
        productId: id,
        quantity
      });
      
      if (error.inventoryOperation || error.statusUncertain) {
        return inventoryOperationResponse(c, {
          error: error.message,
          productId: id
        }, false);
      }
      
      return errorResponse(c, `出库操作失败: ${error.message}`, 500);
    }
  }
);

// 批量库存操作 (库存管理员和超级管理员)
const bulkStockOperationSchema = z.object({
  operations: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().int().min(1, "数量不能为0"),
      type: z.enum(["in", "out"])
    })
  )
});

productRouter.post('/bulk-stock', 
  zValidator('json', bulkStockOperationSchema),
  async (c) => {
    const { operations } = await c.req.json();
    const currentUser = c.get('user');
    
    // 验证权限
    if (currentUser.role !== UserRole.SUPER_ADMIN && 
        currentUser.role !== UserRole.INVENTORY_MANAGER) {
      return c.json({ error: "无权执行批量库存操作" }, 403);
    }
    
    try {
      const collection = db.collection('4d2a803d_products');
      const recordsCollection = db.collection('4d2a803d_inventory_records');
      
      for (const operation of operations) {
        const { productId, quantity, type } = operation;
        
        const product = await collection.findOne({ _id: new mongo.ObjectId(productId) });
        if (!product) {
          return c.json({ error: `产品 ${productId} 不存在` }, 404);
        }
        
        let result;
        if (type === 'in') {
          result = await collection.updateOne(
            { _id: new mongo.ObjectId(productId) },
            { $inc: { stock: quantity } }
          );
        } else if (type === 'out') {
          if (product.stock < quantity) {
            return c.json({ 
              error: `产品 ${productId} 库存不足`, 
              currentStock: product.stock 
            }, 400);
          }
          result = await collection.updateOne(
            { _id: new mongo.ObjectId(productId) },
            { $inc: { stock: -quantity } }
          );
        }
        
        if (result.modifiedCount === 0) {
          return c.json({ message: `操作 ${productId} 未生效` });
        }
        
        await recordsCollection.insertOne({
          productId: productId,
          modelName: product.modelName,
          packageType: product.packageType,
          operationType: type,
          quantity,
          operator: currentUser.username,
          operatorId: currentUser._id.toString(),
          operationTime: new Date()
        });
      }
      
      return c.json({ message: "批量库存操作成功" });
    } catch (error) {
      console.error("批量库存操作出错:", error.message);
      return c.json({ error: "批量库存操作失败" }, 500);
    }
  }
);

// 新增：产品数据导出API端点
productRouter.get('/export', async (c) => {
  const currentUser = c.get('user');
  
  try {
    log('info', '请求产品数据导出 - CSV格式', { 
      user: currentUser.username,
      userId: currentUser._id
    });
    
    const collection = db.collection('4d2a803d_products');
    
    // 获取所有产品数据 - 不分页
    const products = await collection.find({})
      .sort({ modelName: 1, packageType: 1 })
      .toArray();
    
    log('info', `准备导出 ${products.length} 条产品记录`);
    
    // 设置CSV文件头
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="products_export_${new Date().toISOString().split('T')[0]}.csv"`);
    
    // 构建CSV头行 - 优化为展平阶梯价格
    let csv = '产品型号,封装型号,库存数量';
    
    // 添加阶梯定价标题 - 展平阶梯
    csv += ',0-1k价格,1k-10k价格,10k-50k价格,50k-100k价格,100k-500k价格,500k-1M价格,大于1M价格';
    
    // 添加标准阶梯数量 - 便于分析
    csv += ',0-1k数量,1k-10k数量,10k-50k数量,50k-100k数量,100k-500k数量,500k-1M数量,大于1M数量';
    
    // 添加创建和更新时间
    csv += ',创建时间,最后更新时间\n';
    
    // 标准化阶梯数量对应值
    const standardTiers = [0, 1000, 10000, 50000, 100000, 500000, 1000000];
    
    // 添加每条产品数据
    products.forEach(product => {
      // 基础信息
      csv += `"${product.modelName}","${product.packageType}",${product.stock}`;
      
      // 标准化阶梯价格信息
      let pricing = Array(7).fill({ quantity: 0, price: 0 });
      if (product.pricing && Array.isArray(product.pricing)) {
        // 将产品定价映射到标准阶梯
        for (let i = 0; i < 7; i++) {
          const tierMatch = product.pricing.find(p => p.quantity === standardTiers[i]);
          if (tierMatch) {
            pricing[i] = tierMatch;
          } else if (i < product.pricing.length) {
            // 如果没有精确匹配但有数据，使用现有数据
            pricing[i] = product.pricing[i];
          }
        }
      }
      
      // 添加价格信息
      for (let i = 0; i < 7; i++) {
        csv += `,${pricing[i].price || 0}`;
      }
      
      // 添加数量信息
      for (let i = 0; i < 7; i++) {
        csv += `,${pricing[i].quantity || standardTiers[i]}`;
      }
      
      // 添加时间信息
      const createdAt = product.createdAt ? new Date(product.createdAt).toISOString() : '';
      const updatedAt = product.updatedAt ? new Date(product.updatedAt).toISOString() : '';
      csv += `,"${createdAt}","${updatedAt}"\n`;
    });
    
    return c.text(csv);
  } catch (error) {
    log('error', "导出产品数据出错:", { 
      error: error.message, 
      stack: error.stack
    });
    return c.json({ error: "导出产品数据失败: " + error.message }, 500);
  }
});

export default productRouter;