/**
 * 图表工具函数
 * 提供图表配置、颜色主题等共用功能
 */

// 更新配色方案 - 更加柔和和现代的色彩
export const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6', '#f97316', '#14b8a6', '#ec4899'];

// 响应式饼图配置
export const getPieConfig = (screenWidth: number) => {
  if (screenWidth < 480) {
    return {
      innerRadius: 0,
      outerRadius: 50,
      showLabelLine: false,
      renderLabel: false
    };
  } else if (screenWidth < 768) {
    return {
      innerRadius: 0,
      outerRadius: 60,
      showLabelLine: false,
      renderLabel: ({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`
    };
  } else {
    return {
      innerRadius: 0,
      outerRadius: 80,
      showLabelLine: true,
      renderLabel: ({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`
    };
  }
};

// 饼图点击处理函数
export const handlePieClick = (data: any, chartType: string) => {
  console.log(`${chartType} 饼图点击:`, {
    标签: data.name,
    数量: data.value,
    类型: chartType
  });
};