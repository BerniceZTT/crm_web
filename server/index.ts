/**
 * 服务端入口文件
 * 配置和启动API服务
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import productRouter from "./routes/products";
import userRouter from "./routes/users";
import customerRouter from "./routes/customers";
import agentRouter from "./routes/agents";
import authRouter from "./routes/auth";
import publicPoolRouter from "./routes/publicPool";
import inventoryRouter from "./routes/inventory";
import dashboardRouter from "./routes/dashboard";
import followUpRecordRouter from "./routes/followUpRecords";
import customerAssignmentRouter from "./routes/customerAssignments";
import changeCustomerRouter from './routes/changeCustomers';
import customerProgressHistoryRouter from './routes/customerProgressHistory';
import { errorMiddleware } from "./utils/errorHandler";
import { initializeAdminAccount } from "./utils/initData";
import dashboardStatsRouter from './routes/dashboardStats';

// 创建应用实例
const rootApp = new Hono();

// 配置更详细的CORS中间件
rootApp.use('*', cors({
  origin: ['http://localhost:3001', 'http://localhost:5173'], // Vite 默认端口和自定义端口
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'X-Total-Count'],
  credentials: true, // 允许携带凭证
  maxAge: 86400, // 预检请求结果缓存时间（秒）
}));

// 添加错误处理中间件
rootApp.use('*', errorMiddleware);

// 配置路由
rootApp.route('/api/auth', authRouter);
rootApp.route('/api/users', userRouter);
rootApp.route('/api/products', productRouter);
rootApp.route('/api/customers', customerRouter);
rootApp.route('/api/agents', agentRouter);
rootApp.route('/api/public-pool', publicPoolRouter);
rootApp.route('/api/inventory', inventoryRouter);
// 修改这一行，将路由路径从 '/api/follow-up' 改为 '/api/followUpRecords'
rootApp.route('/api/followUpRecords', followUpRecordRouter);
rootApp.route('/api/customerAssignments', customerAssignmentRouter); // 修改：从 '/api/customer-assignments' 改为 '/api/customerAssignments'
rootApp.route('/api/dashboard', dashboardRouter);
rootApp.route('/api/change_customers', changeCustomerRouter);
rootApp.route('/api/dashboard-stats', dashboardStatsRouter);
rootApp.route('/api/customer-progress', customerProgressHistoryRouter); // 添加客户进展历史记录路由

// 定义健康检查路由
rootApp.get('/api/health', (c) => {
  return c.json({ status: 'ok' });
});

// 初始化数据
// 这里可以在服务启动时初始化数据
try {
  initializeAdminAccount().catch(console.error);
} catch (error) {
  console.error('初始化数据失败:', error);
}

// 导出应用实例
export default rootApp;