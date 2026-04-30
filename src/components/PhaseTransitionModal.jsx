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
  const [hoveredMissionId, setHoveredMissionId] = useState(phaseData.mainMission);

  if (!phaseData || !missions) {
    return null;
  }

  const hoveredMission = missions.find(m => m.id === hoveredMissionId);
  const mainMission = missions.find(m => m.id === phaseData.mainMission);
  const sideMissions = missions.filter(m => m.missionType === 'side');

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
        {/* 阶段信息区域 */}
        <div className="phase-info-header">
          <div className="phase-info-top">
            <h2>{phaseData.name}</h2>
            <span className="phase-turns">剩余 {phaseData.turnLimit} 回合</span>
            <button className="modal-close-inline" onClick={onClose}>开始行动</button>
          </div>
          <div className="phase-context-text">
            {phaseData.historicalContext}
          </div>
        </div>

        {/* 任务和战场局势区域 */}
        <div className="phase-transition-content">
          <div className="phase-mission-section">
            <h3>阶段任务</h3>

            {/* 所有任务（主线+支线在同一行） */}
            <div className="all-missions-row">
              {/* 主线任务 */}
              <div className="mission-with-label">
                <div className="mission-inline-label">主线</div>
                <div className="mission-card-compact">
                  <Card
                    card={mainMission}
                    onHover={onCardHover}
                    onHoverEnd={onCardHoverEnd}
                  />
                </div>
              </div>

              {/* 支线任务 */}
              {sideMissions.length > 0 && sideMissions.map(mission => (
                <div key={mission.id} className="mission-with-label">
                  <div className="mission-inline-label">支线</div>
                  <div className="mission-card-compact">
                    <Card
                      card={mission}
                      onHover={onCardHover}
                      onHoverEnd={onCardHoverEnd}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* 战场局势 */}
            <BattlefieldConditions conditions={phaseData.battlefieldConditions} />

            {/* 受影响的卡牌 */}
            <div className="affected-cards-info">
              <h4>卡牌变更</h4>
              <p>{getAffectedCardsText()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PhaseTransitionModal;
