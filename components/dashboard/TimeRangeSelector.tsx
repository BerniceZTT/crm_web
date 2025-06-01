/**
 * 时间范围选择器组件
 * 处理数据看板的时间筛选功能
 */

import React from 'react';
import { Select, DatePicker, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import moment from 'moment';
const { Option } = Select;
const { RangePicker } = DatePicker;

interface TimeRangeSelectorProps {
    timeRange: string;
    customDateRange: [moment.Moment, moment.Moment] | null;
    loading: boolean;
    isMobile: boolean;
    getControlSize: () => 'small' | 'middle' | 'large';
    getButtonSize: () => 'small' | 'middle' | 'large';
    onTimeRangeChange: (value: string) => void;
    onDateRangeChange: (dates: [moment.Moment, moment.Moment] | null) => void;
    onRefresh: () => void;
}

const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
    timeRange,
    customDateRange,
    loading,
    isMobile,
    getControlSize,
    getButtonSize,
    onTimeRangeChange,
    onDateRangeChange,
    onRefresh
}) => {
    return (
        <div className={`flex ${isMobile ? 'flex-col space-y-2' : 'items-center space-x-4'}`}>
            <Select
                value={timeRange}
                onChange={onTimeRangeChange}
                size={getControlSize()}
                style={{ width: isMobile ? '100%' : 120 }}
            >
                <Option value="week">近7天</Option>
                <Option value="current_week">本周</Option>
                <Option value="month">近30天</Option>
                <Option value="quarter">近3个月</Option>
                <Option value="year">近1年</Option>
                <Option value="custom">自定义</Option>
            </Select>

            {timeRange === 'custom' && (
                <RangePicker
                    value={customDateRange}
                    onChange={onDateRangeChange}
                    size={getControlSize()}
                    style={{ width: isMobile ? '100%' : 240 }}
                />
            )}

            <Button
                icon={<ReloadOutlined />}
                onClick={onRefresh}
                loading={loading}
                size={getButtonSize()}
                type="primary"
                className="min-w-0"
            >
                {!isMobile && '刷新'}
            </Button>
        </div>
    );
};

export default TimeRangeSelector;
