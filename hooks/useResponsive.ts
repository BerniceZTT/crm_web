/**
 * 响应式布局钩子
 * 提供设备类型状态和表格列响应式处理能力
 * 增强了统一的组件尺寸规范和动态适应屏幕宽度
 */
import { useState, useEffect, useCallback } from 'react';

interface ResponsiveState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
}

interface ColumnConfig {
  responsive?: string[] | string;
  [key: string]: any;
}

export const useResponsive = () => {
  const [state, setState] = useState<ResponsiveState>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    screenWidth: typeof window !== 'undefined' ? window.innerWidth : 1024
  });

  // 处理窗口大小变化
  useEffect(() => {
    const updateState = () => {
      const width = window.innerWidth;
      setState({
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024,
        screenWidth: width
      });
    };

    // 初始化检查
    updateState();

    // 添加防抖处理
    let resizeTimer: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateState, 100);
    };

    window.addEventListener('resize', debouncedResize);

    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  // 根据屏幕宽度获取图表的大小比例
  const getChartScale = useCallback((baseSize: number = 1): number => {
    const { screenWidth } = state;
    
    if (screenWidth < 480) {
      return baseSize * 0.6; // 手机竖屏
    } else if (screenWidth < 768) {
      return baseSize * 0.7; // 大手机
    } else if (screenWidth < 1024) {
      return baseSize * 0.8; // 平板
    } else if (screenWidth < 1280) {
      return baseSize * 0.9; // 小屏电脑
    }
    
    return baseSize; // 全尺寸显示
  }, [state.screenWidth]);

  // 判断是否应该渲染列（基于responsive属性）
  const shouldRenderColumn = useCallback((column: ColumnConfig): boolean => {
    if (!column) return false;
    
    // 如果没有responsive属性，始终显示
    if (!column.responsive) return true;
    
    const { isMobile, isTablet, isDesktop } = state;
    
    // 处理字符串类型的responsive
    if (typeof column.responsive === 'string') {
      if (column.responsive === 'md' && !isMobile) return true;
      if (column.responsive === 'lg' && isDesktop) return true;
      return false;
    }
    
    // 处理数组类型的responsive
    if (Array.isArray(column.responsive)) {
      return column.responsive.some(size => {
        if (size === 'xs') return true;
        if (size === 'sm') return !isMobile || isTablet;
        if (size === 'md') return !isMobile;
        if (size === 'lg') return isDesktop;
        return false;
      });
    }
    
    return true;
  }, [state]);

  // 过滤列配置
  const filterColumnsByDevice = useCallback((columns: ColumnConfig[]) => {
    return columns.filter(shouldRenderColumn);
  }, [shouldRenderColumn]);

  // 获取表格尺寸 - 统一为中等大小，移动端为小尺寸
  const getTableSize = useCallback(() => {
    return state.isMobile ? 'small' : 'middle';
  }, [state.isMobile]);

  // 获取输入控件尺寸 - 移动端为中等尺寸，确保触摸友好
  const getControlSize = useCallback(() => {
    return state.isMobile ? 'middle' : 'middle'; // 统一为middle尺寸，提升移动端可点击区域
  }, [state.isMobile]);

  // 获取按钮尺寸 - 移动端为small，PC端保持middle
  const getButtonSize = useCallback(() => {
    return state.isMobile ? 'small' : 'middle';
  }, [state.isMobile]);

  // 获取主按钮尺寸 - 调整主按钮大小，确保在移动端也足够大
  const getPrimaryButtonSize = useCallback(() => {
    return state.isMobile ? 'middle' : 'large';
  }, [state.isMobile]);

  // 获取按钮内边距 - 根据设备调整按钮内边距
  const getButtonPadding = useCallback(() => {
    if (state.isMobile) {
      return { paddingLeft: '12px', paddingRight: '12px' };
    }
    return { paddingLeft: '16px', paddingRight: '16px' };
  }, [state.isMobile]);

  // 获取按钮字体大小 - 确保在移动端也足够清晰
  const getButtonFontSize = useCallback(() => {
    return state.isMobile ? '15px' : '16px';
  }, [state.isMobile]);

  // 获取按钮组样式 - 针对移动端优化按钮组的间距和换行行为
  const getButtonGroupStyle = useCallback(() => {
    if (state.isMobile) {
      return { 
        gap: '8px', 
        display: 'flex', 
        flexWrap: 'wrap' as const 
      };
    }
    return { gap: '12px' };
  }, [state.isMobile]);

  // 获取描述列表样式
  const getDescriptionsSize = useCallback(() => {
    return state.isMobile ? 'small' : 'default';
  }, [state.isMobile]);

  // 获取描述列表布局
  const getDescriptionsLayout = useCallback(() => {
    return state.isMobile ? 'vertical' : undefined;
  }, [state.isMobile]);

  // 获取移动端描述列表标签样式
  const getMobileDescriptionsLabelStyle = useCallback(() => {
    if (state.isMobile) {
      return { 
        padding: '8px 12px', 
        width: '35%', 
        display: 'inline-block',
        verticalAlign: 'top',
        wordBreak: 'break-word',
        fontWeight: 600,
        color: '#4b5563',
        background: '#f8fafc'
      };
    }
    return {};
  }, [state.isMobile]);

  // 获取移动端描述列表内容样式
  const getMobileDescriptionsContentStyle = useCallback(() => {
    if (state.isMobile) {
      return { 
        padding: '8px 12px', 
        width: '65%', 
        display: 'inline-block',
        wordBreak: 'break-word'
      };
    }
    return {};
  }, [state.isMobile]);

  // 获取卡片内边距 - 统一内边距
  const getCardPadding = useCallback(() => {
    return state.isMobile ? { padding: '12px' } : { padding: '24px' };
  }, [state.isMobile]);

  // 获取标题尺寸 - 统一标题大小
  const getTitleLevel = useCallback((defaultLevel: 1 | 2 | 3 | 4 | 5) => {
    if (state.isMobile) {
      return Math.min(defaultLevel + 1, 5) as 1 | 2 | 3 | 4 | 5;
    }
    return defaultLevel;
  }, [state.isMobile]);

  // 获取表单项间距 - 统一表单间距
  const getFormItemGap = useCallback(() => {
    return state.isMobile ? 12 : 24;
  }, [state.isMobile]);

  // 获取间距大小 - 统一组件间距
  const getSpaceSize = useCallback((defaultSize: 'small' | 'middle' | 'large') => {
    if (state.isMobile) {
      if (defaultSize === 'large') return 'middle';
      if (defaultSize === 'middle') return 'small';
      return 'small';
    }
    return defaultSize;
  }, [state.isMobile]);

  return {
    ...state,
    shouldRenderColumn,
    filterColumnsByDevice,
    getTableSize,
    getControlSize,
    getButtonSize,
    getPrimaryButtonSize,
    getButtonPadding,
    getButtonFontSize,
    getButtonGroupStyle,
    getDescriptionsSize,
    getDescriptionsLayout,
    getMobileDescriptionsLabelStyle,
    getMobileDescriptionsContentStyle,
    getCardPadding,
    getTitleLevel,
    getFormItemGap,
    getSpaceSize,
    getChartScale
  };
};