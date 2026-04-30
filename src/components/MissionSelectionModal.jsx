import React, { useState } from 'react';
import Card from './Card';
import BattlefieldConditions from './BattlefieldConditions';

/**
 * MissionSelectionModal Component - 任务选择弹窗
 *
 * 在行动阶段点击"更改任务"按钮时显示，允许玩家切换当前任务
 * 包括：
 * - 所有可用任务列表（主线+支线）
 * - 高亮当前选中的任务
 * - 战场局势
 */
function MissionSelectionModal({
  phaseData,
  missions,
  currentMissionId,
  onSelectMission,
  onClose,
  onCardHover,
  onCardHoverEnd
}) {
  const [hoveredMissionId, setHoveredMissionId] = useState(currentMissionId);

  if (!phaseData || !missions) {
    return null;
  }

  const hoveredMission = missions.find(m => m.id === hoveredMissionId);
  const mainMission = missions.find(m => m.missionType === 'main');
  const sideMissions = missions.filter(m => m.missionType === 'side');

  const handleMissionClick = (missionId) => {
    onSelectMission(missionId);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="mission-selection-modal">
        {/* 阶段信息区域 */}
        <div className="phase-info-header">
          <div className="phase-info-top">
            <h2>{phaseData.name}</h2>
            <span className="phase-turns">剩余 {phaseData.turnLimit} 回合</span>
            <button className="modal-close-inline" onClick={onClose}>×</button>
          </div>
          <div className="phase-context-text">
            {phaseData.historicalContext}
          </div>
        </div>

        {/* 任务选择和详情区域 */}
        <div className="mission-selection-content">
          {/* 左侧：任务列表 */}
          <div className="mission-list-section">
            <h3>选择任务</h3>

            {/* 主线任务 */}
            <div className="mission-row">
              <div className="mission-row-label">主线</div>
              <div className="mission-cards-horizontal">
                <div
                  className={`mission-card-compact ${currentMissionId === mainMission.id ? 'current-selected' : ''}`}
                  onMouseEnter={() => setHoveredMissionId(mainMission.id)}
                  onClick={() => handleMissionClick(mainMission.id)}
                >
                  <Card
                    card={mainMission}
                    onHover={onCardHover}
                    onHoverEnd={onCardHoverEnd}
                  />
                </div>
              </div>
            </div>

            {/* 支线任务 */}
            {sideMissions.length > 0 && (
              <div className="mission-row">
                <div className="mission-row-label">支线</div>
                <div className="mission-cards-horizontal">
                  {sideMissions.map(mission => (
                    <div
                      key={mission.id}
                      className={`mission-card-compact ${currentMissionId === mission.id ? 'current-selected' : ''}`}
                      onMouseEnter={() => setHoveredMissionId(mission.id)}
                      onClick={() => handleMissionClick(mission.id)}
                    >
                      <Card
                        card={mission}
                        onHover={onCardHover}
                        onHoverEnd={onCardHoverEnd}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 右侧：详细信息面板（在模态窗口内） */}
          <div className="mission-detail-panel">
            {hoveredMission && (
              <Card
                card={hoveredMission}
                showDetailed={true}
              />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default MissionSelectionModal;
