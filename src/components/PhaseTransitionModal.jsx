import React, { useState } from 'react';
import Card from './Card';
import BattlefieldConditions from './BattlefieldConditions';

/**
 * PhaseTransitionModal Component - 战略阶段过渡弹窗
 *
 * 在进入新的战略阶段时显示，包括：
 * - 阶段名称和历史背景
 * - 主线任务和支线任务（可切换查看）
 * - 战场局势
 * - 受影响的卡牌（新增/退役）
 */
function PhaseTransitionModal({ phaseData, missions, onClose, onCardHover, onCardHoverEnd }) {
  const [selectedMissionId, setSelectedMissionId] = useState(phaseData.mainMission);

  if (!phaseData || !missions) {
    return null;
  }

  const currentMission = missions.find(m => m.id === selectedMissionId);
  const mainMission = missions.find(m => m.id === phaseData.mainMission);
  const sideMissions = missions.filter(m => m.type === 'side');

  // 获取受影响的卡牌信息
  const getAffectedCardsText = () => {
    const retiredCount = phaseData.cardsToRetire?.length || 0;
    const addedCount = phaseData.cardsToAdd?.length || 0;

    if (retiredCount === 0 && addedCount === 0) {
      return '商店卡牌无变化';
    }

    const parts = [];
    if (retiredCount > 0) parts.push(`${retiredCount}种卡牌退役`);
    if (addedCount > 0) parts.push(`${addedCount}种卡牌加入`);
    return parts.join('，');
  };

  return (
    <div className="modal-overlay">
      <div className="phase-transition-modal">
        {/* 标题区域 */}
        <div className="modal-header">
          <h2>{phaseData.name}</h2>
          <div className="phase-turn-limit">
            剩余回合：{phaseData.turnLimit}
          </div>
        </div>

        {/* 历史背景 */}
        <div className="phase-context">
          <p>{phaseData.historicalContext}</p>
        </div>

        {/* 主要内容区域 */}
        <div className="modal-content-wrapper">
          {/* 左侧：任务选择和战场局势 */}
          <div className="modal-left-section">
            {/* 任务标签页 */}
            <div className="mission-tabs">
              <div className="mission-tabs-header">
                <button
                  className={`mission-tab ${selectedMissionId === mainMission.id ? 'active' : ''}`}
                  onClick={() => setSelectedMissionId(mainMission.id)}
                >
                  主线：{mainMission.name}
                </button>
                {sideMissions.map(mission => (
                  <button
                    key={mission.id}
                    className={`mission-tab ${selectedMissionId === mission.id ? 'active' : ''}`}
                    onClick={() => setSelectedMissionId(mission.id)}
                  >
                    支线：{mission.name}
                  </button>
                ))}
              </div>

              {/* 当前选中任务卡牌 */}
              {currentMission && (
                <div className="mission-card-display">
                  <Card
                    card={currentMission}
                    onHover={onCardHover}
                    onHoverEnd={onCardHoverEnd}
                  />
                </div>
              )}
            </div>

            {/* 战场局势 */}
            <BattlefieldConditions conditions={phaseData.battlefieldConditions} />

            {/* 受影响的卡牌 */}
            <div className="affected-cards-info">
              <h4>卡牌变更</h4>
              <p>{getAffectedCardsText()}</p>
            </div>
          </div>

          {/* 右侧：预留给详细信息面板使用 */}
          <div className="modal-right-spacer">
            {/* 空白区域，确保不遮挡右侧详细信息面板 */}
          </div>
        </div>

        {/* 按钮区域 */}
        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>
            开始行动
          </button>
        </div>
      </div>
    </div>
  );
}

export default PhaseTransitionModal;
