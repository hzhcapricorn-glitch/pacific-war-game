import React from 'react';
import Card from './Card';

/**
 * MissionDisplay Component - 显示当前任务和剩余任务数
 */
function MissionDisplay({
  currentMission,
  remainingMissions,
  turnsRemaining,
  phaseData,
  onMissionHover,
  onMissionHoverEnd,
  onChangeMission,
  canChangeMission = false
}) {
  return (
    <div className="mission-display">
      {/* 战略阶段名称 */}
      {phaseData && (
        <div className="phase-name-large">
          {phaseData.name}
        </div>
      )}

      {/* 剩余回合 */}
      {phaseData && (
        <div className="turns-remaining">
          剩余 {turnsRemaining} 回合
        </div>
      )}

      {/* 当前任务标题和按钮 */}
      <div className="mission-title-row">
        <span className="mission-label">当前任务</span>
        {canChangeMission && (
          <button
            className="btn-change-mission-inline"
            onClick={onChangeMission}
          >
            更改任务
          </button>
        )}
      </div>

      {/* 分割线 */}
      <div className="mission-divider"></div>

      {/* 任务卡牌 */}
      <div className="mission-content">
        {currentMission ? (
          <Card
            card={currentMission}
            onHover={onMissionHover}
            onHoverEnd={onMissionHoverEnd}
            className="current-mission"
          />
        ) : (
          <div className="no-mission">所有任务已完成！</div>
        )}
      </div>
    </div>
  );
}

export default MissionDisplay;
