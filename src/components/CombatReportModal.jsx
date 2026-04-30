import React from 'react';
import { getCombatSummary } from '../core/CombatSystem';

/**
 * CombatReportModal Component - 战斗简报模态框
 */
function CombatReportModal({ report, onClose }) {
  if (!report) return null;

  // 使用 getCombatSummary 生成格式化的报告
  const summary = getCombatSummary(report);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content combat-report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📋 战斗简报</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="report-info">
            <div className="report-meta">
              <span className="report-turn">回合 {report.turn}</span>
              <span className="report-time">{report.timestamp}</span>
            </div>
            <div className="report-mission">
              任务：{report.mission.name}
            </div>
          </div>

          <div className="report-content">
            <pre className="report-summary">{summary}</pre>
          </div>

          {report.participatingCards && report.participatingCards.length > 0 && (
            <div className="report-cards">
              <h3>参战单位 ({report.participatingCards.length})</h3>
              <div className="report-card-list">
                {report.participatingCards.map((card) => (
                  <div key={card.instanceId} className="report-card-item">
                    <span className="card-icon">
                      {card.unitType === 'air' ? '✈️' :
                       card.unitType === 'navy' ? '⚓' :
                       card.unitType === 'army' ? '🎖️' : '📦'}
                    </span>
                    <span className="card-name">{card.name.replace(/\n/g, '')}</span>
                    <span className="card-power">
                      {card.groundPower > 0 && `💣${card.groundPower} `}
                      {card.seaPower > 0 && `🌊${card.seaPower} `}
                      {card.airPower > 0 && `✈️${card.airPower}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}

export default CombatReportModal;
