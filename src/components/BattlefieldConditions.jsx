import React, { useState } from 'react';

/**
 * BattlefieldConditions Component - 显示战场局势（buff/debuff）
 *
 * 用于显示当前阶段的战场状况，包括各种增益和减益效果
 * 分为两个区域：
 * - 上方：悬停时显示详细描述
 * - 下方：紧凑列表显示所有条件
 */
function BattlefieldConditions({ conditions = [] }) {
  const [hoveredCondition, setHoveredCondition] = useState(null);

  if (!conditions || conditions.length === 0) {
    return null;
  }

  return (
    <div className="battlefield-conditions">
      <div className="conditions-header">
        <h4>战场局势</h4>
      </div>

      {/* 详细描述区域（悬停时显示） */}
      <div className="condition-detail-area">
        {hoveredCondition ? (
          <div className="condition-detail">
            <div className="condition-detail-name">{hoveredCondition.name}</div>
            <div className="condition-detail-description">{hoveredCondition.description}</div>
          </div>
        ) : (
          <div className="condition-detail-placeholder">
            悬停查看详情
          </div>
        )}
      </div>

      {/* 紧凑列表区域 */}
      <div className="conditions-list">
        {conditions.map((condition, index) => (
          <div
            key={condition.id || index}
            className="condition-item"
            onMouseEnter={() => setHoveredCondition(condition)}
            onMouseLeave={() => setHoveredCondition(null)}
          >
            {condition.name}
          </div>
        ))}
      </div>
    </div>
  );
}

export default BattlefieldConditions;
