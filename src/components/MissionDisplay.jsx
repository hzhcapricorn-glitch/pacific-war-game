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
      <div className="mission-header">
        <h3>当前任务</h3>
        {phaseData ? (
          <span className="missions-remaining">
            {phaseData.name} - 剩余: {turnsRemaining}回合
          </span>
        ) : (
          <span className="missions-remaining">
            剩余任务: {remainingMissions}
          </span>
        )}
      </div>
      <div className="mission-content">
        {currentMission ? (
          <>
            <Card
              card={currentMission}
              onHover={onMissionHover}
              onHoverEnd={onMissionHoverEnd}
              className="current-mission"
            />
            {canChangeMission && (
              <button
                className="btn-change-mission"
                onClick={onChangeMission}
              >
                更改任务
              </button>
            )}
          </>
        ) : (
          <div className="no-mission">所有任务已完成！</div>
        )}
      </div>
    </div>
  );
}

export default MissionDisplay;
