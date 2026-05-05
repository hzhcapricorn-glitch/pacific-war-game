import React, { useState } from 'react';
import Card from './Card';
import '../styles/main.css';

/**
 * DebugMissionSwitchModal - Debug功能：强制切换任务
 */
function DebugMissionSwitchModal({
  onClose,
  onSelectMission,
  allMissions,
  currentMissionId
}) {
  const [hoveredCard, setHoveredCard] = useState(null);

  // 按阶段分组任务
  const missionsByPhase = {};
  allMissions.forEach(mission => {
    const phase = mission.phase || 1;
    if (!missionsByPhase[phase]) {
      missionsByPhase[phase] = {
        main: [],
        side: []
      };
    }
    if (mission.missionType === 'main') {
      missionsByPhase[phase].main.push(mission);
    } else {
      missionsByPhase[phase].side.push(mission);
    }
  });

  const handleMissionClick = (mission) => {
    onSelectMission(mission);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content mission-selection-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🐛 Debug: 强制切换任务</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="mission-selection-content">
          <div className="mission-selection-main">
            {Object.keys(missionsByPhase).sort().map(phaseNum => {
              const phase = missionsByPhase[phaseNum];
              const phaseNames = {
                '1': '防御性反击',
                '2': '消耗战地狱',
                '3': '战略大反攻',
                '4': '末日决战'
              };

              return (
                <div key={phaseNum} className="debug-mission-phase-group">
                  <h3 className="debug-phase-title">阶段 {phaseNum}: {phaseNames[phaseNum] || `阶段${phaseNum}`}</h3>

                  {/* 主线任务 */}
                  {phase.main.length > 0 && (
                    <div className="debug-mission-group">
                      <h4 className="debug-mission-group-title">主线任务</h4>
                      <div className="mission-cards-row">
                        {phase.main.map(mission => (
                          <div
                            key={mission.id}
                            className={`mission-card-wrapper ${mission.id === currentMissionId ? 'current-mission' : ''}`}
                            onClick={() => handleMissionClick(mission)}
                            onMouseEnter={() => setHoveredCard(mission)}
                            onMouseLeave={() => setHoveredCard(null)}
                          >
                            <Card
                              card={mission}
                              className="mission-card-thumbnail"
                            />
                            {mission.id === currentMissionId && (
                              <div className="current-mission-badge">当前</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 支线任务 */}
                  {phase.side.length > 0 && (
                    <div className="debug-mission-group">
                      <h4 className="debug-mission-group-title">支线任务</h4>
                      <div className="mission-cards-row">
                        {phase.side.map(mission => (
                          <div
                            key={mission.id}
                            className={`mission-card-wrapper ${mission.id === currentMissionId ? 'current-mission' : ''}`}
                            onClick={() => handleMissionClick(mission)}
                            onMouseEnter={() => setHoveredCard(mission)}
                            onMouseLeave={() => setHoveredCard(null)}
                          >
                            <Card
                              card={mission}
                              className="mission-card-thumbnail"
                            />
                            {mission.id === currentMissionId && (
                              <div className="current-mission-badge">当前</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 右侧详细信息 */}
          <div className="mission-detail-panel">
            {hoveredCard ? (
              <Card card={hoveredCard} showDetailed={true} />
            ) : (
              <div className="empty-detail">
                <p>悬停查看任务详情</p>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

export default DebugMissionSwitchModal;
