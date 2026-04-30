import React, { useState } from 'react';
import Card from './Card';

/**
 * LeaderSelectionModal Component - 领袖选择弹窗
 *
 * 游戏开始时显示，允许玩家选择一位领袖
 */
function LeaderSelectionModal({
  leaders,
  onSelectLeader,
  onCardHover,
  onCardHoverEnd
}) {
  const [selectedLeaderId, setSelectedLeaderId] = useState(null);
  const [hoveredLeaderId, setHoveredLeaderId] = useState(null);

  if (!leaders || leaders.length === 0) {
    return null;
  }

  const selectedLeader = leaders.find(l => l.id === selectedLeaderId);
  const hoveredLeader = leaders.find(l => l.id === hoveredLeaderId) || selectedLeader;

  const handleLeaderClick = (leaderId) => {
    setSelectedLeaderId(leaderId);
  };

  const handleConfirm = () => {
    if (selectedLeaderId) {
      const leader = leaders.find(l => l.id === selectedLeaderId);
      onSelectLeader(leader);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="leader-selection-modal">
        {/* 标题区域 */}
        <div className="leader-selection-header">
          <h2>选择你的领袖</h2>
          <p className="leader-selection-subtitle">领袖将为你的舰队提供独特的战术优势</p>
        </div>

        {/* 选择和详情区域 */}
        <div className="leader-selection-content">
          {/* 左侧：领袖列表 */}
          <div className="leader-list-section">
            <div className="leader-cards-grid">
              {leaders.map(leader => (
                <div
                  key={leader.id}
                  className={`leader-card-compact ${selectedLeaderId === leader.id ? 'leader-selected' : ''}`}
                  onMouseEnter={() => setHoveredLeaderId(leader.id)}
                  onMouseLeave={() => setHoveredLeaderId(null)}
                  onClick={() => handleLeaderClick(leader.id)}
                >
                  <Card
                    card={leader}
                    onHover={onCardHover}
                    onHoverEnd={onCardHoverEnd}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 右侧：详细信息面板 */}
          <div className="leader-detail-panel">
            {hoveredLeader && (
              <Card
                card={hoveredLeader}
                showDetailed={true}
              />
            )}
          </div>
        </div>

        {/* 按钮区域 */}
        <div className="leader-selection-footer">
          <button
            className="btn-primary btn-confirm-leader"
            onClick={handleConfirm}
            disabled={!selectedLeaderId}
          >
            确认选择
          </button>
        </div>
      </div>
    </div>
  );
}

export default LeaderSelectionModal;
