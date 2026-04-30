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
  const mainMission = missions.find(m => m.type === 'main');
  const sideMissions = missions.filter(m => m.type === 'side');

  const handleMissionClick = (missionId) => {
    onSelectMission(missionId);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="mission-selection-modal">
        {/* 标题区域 */}
        <div className="modal-header">
          <h2>选择任务</h2>
          <div className="phase-info-compact">
            {phaseData.name} - 剩余{phaseData.turnLimit}回合
          </div>
        </div>

        {/* 主要内容区域 */}
        <div className="modal-content-wrapper">
          {/* 左侧：任务列表 */}
          <div className="modal-left-section">
            {/* 主线任务 */}
            <div className="mission-section">
              <h3>主线任务</h3>
              <div
                className={`mission-card-item ${currentMissionId === mainMission.id ? 'current' : ''}`}
                onMouseEnter={() => setHoveredMissionId(mainMission.id)}
                onClick={() => handleMissionClick(mainMission.id)}
              >
                <Card
                  card={mainMission}
                  onHover={onCardHover}
                  onHoverEnd={onCardHoverEnd}
                />
                {currentMissionId === mainMission.id && (
                  <div className="mission-current-badge">当前任务</div>
                )}
              </div>
            </div>

            {/* 支线任务 */}
            {sideMissions.length > 0 && (
              <div className="mission-section">
                <h3>支线任务</h3>
                <div className="mission-grid">
                  {sideMissions.map(mission => (
                    <div
                      key={mission.id}
                      className={`mission-card-item ${currentMissionId === mission.id ? 'current' : ''}`}
                      onMouseEnter={() => setHoveredMissionId(mission.id)}
                      onClick={() => handleMissionClick(mission.id)}
                    >
                      <Card
                        card={mission}
                        onHover={onCardHover}
                        onHoverEnd={onCardHoverEnd}
                      />
                      {currentMissionId === mission.id && (
                        <div className="mission-current-badge">当前任务</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 战场局势 */}
            <BattlefieldConditions conditions={phaseData.battlefieldConditions} />
          </div>

          {/* 右侧：预留给详细信息面板使用 */}
          <div className="modal-right-spacer">
            {/* 空白区域，确保不遮挡右侧详细信息面板 */}
          </div>
        </div>

        {/* 按钮区域 */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

export default MissionSelectionModal;
