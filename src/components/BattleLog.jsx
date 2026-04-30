import React, { useRef, useEffect } from 'react';

/**
 * BattleLog Component - 战场简讯日志
 */
function BattleLog({ logs, onReportClick }) {
  const logEndRef = useRef(null);

  // 自动滚动到最新日志
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const getLogIcon = (type) => {
    switch (type) {
      case 'system': return '🎮';
      case 'action': return '🃏';
      case 'combat': return '⚔️';
      case 'combat_report': return '📋';
      case 'loss': return '💔';
      case 'reward': return '🎁';
      default: return '📌';
    }
  };

  const getLogClass = (type) => {
    switch (type) {
      case 'system': return 'log-system';
      case 'action': return 'log-action';
      case 'combat': return 'log-combat';
      case 'combat_report': return 'log-combat-report';
      case 'loss': return 'log-loss';
      case 'reward': return 'log-reward';
      default: return 'log-info';
    }
  };

  return (
    <div className="battle-log">
      <div className="log-header">
        <h3>战场简讯</h3>
        <span className="log-count">{logs.length} 条记录</span>
      </div>
      <div className="log-content">
        {logs.length === 0 ? (
          <div className="log-empty">等待战斗开始...</div>
        ) : (
          <>
            {logs.map((log) => (
              <div key={log.id} className={`log-entry ${getLogClass(log.type)}`}>
                <span className="log-time">[{log.timestamp}]</span>
                <span className="log-turn">回合{log.turn}</span>
                {log.isClickable && log.reportId ? (
                  <span
                    className="log-message log-clickable"
                    onClick={() => onReportClick && onReportClick(log.reportId)}
                  >
                    {log.message} <span className="log-link">→ 查看战斗简报</span>
                  </span>
                ) : (
                  <span className="log-message">{log.message}</span>
                )}
              </div>
            ))}
            <div ref={logEndRef} />
          </>
        )}
      </div>
    </div>
  );
}

export default BattleLog;
