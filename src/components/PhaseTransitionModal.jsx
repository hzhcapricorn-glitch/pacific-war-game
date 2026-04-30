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

        {/* 任务选择和详情区域 */}
        <div className="phase-transition-content">
          {/* 左侧：任务列表和战场局势 */}
          <div className="phase-mission-section">
            <h3>阶段任务</h3>

            {/* 主线任务 */}
            <div className="mission-row">
              <div className="mission-row-label">主线</div>
              <div className="mission-cards-horizontal">
                <div
                  className="mission-card-compact"
                  onMouseEnter={() => setHoveredMissionId(mainMission.id)}
                  onMouseLeave={() => setHoveredMissionId(null)}
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
                      className="mission-card-compact"
                      onMouseEnter={() => setHoveredMissionId(mission.id)}
                      onMouseLeave={() => setHoveredMissionId(null)}
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

            {/* 战场局势 */}
            <BattlefieldConditions conditions={phaseData.battlefieldConditions} />

            {/* 受影响的卡牌 */}
            <div className="affected-cards-info">
              <h4>卡牌变更</h4>
              <p>{getAffectedCardsText()}</p>
            </div>
          </div>

          {/* 右侧：详细信息面板 */}
          <div className="phase-detail-panel">
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

export default PhaseTransitionModal;
