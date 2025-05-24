/**
 * 响应式Tooltip组件
 * 在移动端设备上不显示Tooltip，在桌面端显示
 */
import React from 'react';
import { Tooltip, TooltipProps } from 'antd';
import { useResponsive } from '../../hooks/useResponsive';

interface ResponsiveTooltipProps extends Omit<TooltipProps, 'visible'> {
  children: React.ReactNode;
}

const ResponsiveTooltip: React.FC<ResponsiveTooltipProps> = ({ 
  children, 
  ...props 
}) => {
  const { isMobile } = useResponsive();

  // 在移动端直接返回子元素，不包装Tooltip
  if (isMobile) {
    return <>{children}</>;
  }

  // 在桌面端显示Tooltip
  return <Tooltip {...props}>{children}</Tooltip>;
};

export default ResponsiveTooltip;