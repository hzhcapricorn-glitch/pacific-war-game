import React from 'react';
import Card from './Card';

/**
 * MissionDisplay Component - 显示当前任务和剩余任务数
 */
function MissionDisplay({ currentMission, remainingMissions, onMissionHover, onMissionHoverEnd }) {
  return (
    <div className="mission-display">
      <div className="mission-header">
        <h3>当前任务</h3>
        <span className="missions-remaining">
          剩余任务: {remainingMissions}
        </span>
      </div>
      <div className="mission-content">
        {currentMission ? (
          <Card
            card={currentMission}
            onHover={onMissionHover}
            onHoverEnd={onMissionHoverEnd}
            className="current-mission"
            showDetailed={true}
          />
        ) : (
          <div className="no-mission">所有任务已完成！</div>
        )}
      </div>
    </div>
  );
}

export default MissionDisplay;
