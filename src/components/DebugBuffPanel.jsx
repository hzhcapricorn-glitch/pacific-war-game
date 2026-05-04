import React, { useState } from 'react';
import { getAllBuffs, getCategories } from '../data/buffs/BuffRegistry';

/**
 * DebugBuffPanel - Debug UI for buff management
 *
 * Features:
 * - Display all registered buffs from buff_registry.json
 * - Show currently active buffs from battlefieldConditions
 * - Add/remove buffs for testing
 * - Filter by category, scope, buff/debuff
 */
function DebugBuffPanel({ gameState, onAddBuff, onRemoveBuff, onClose }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showBuffsOnly, setShowBuffsOnly] = useState(false);
  const [showDebuffsOnly, setShowDebuffsOnly] = useState(false);

  const allBuffs = getAllBuffs();
  const categories = getCategories();
  const activeBattlefieldConditions = gameState?.battlefieldConditions || [];

  // Filter buffs based on selected criteria
  const filteredBuffs = Object.values(allBuffs).filter(buff => {
    if (selectedCategory !== 'all' && buff.category !== selectedCategory) {
      return false;
    }
    if (showBuffsOnly && !buff.isBuff) {
      return false;
    }
    if (showDebuffsOnly && buff.isBuff) {
      return false;
    }
    return true;
  });

  // Check if buff is currently active
  const isBuffActive = (buffId) => {
    return activeBattlefieldConditions.some(condition => condition.id === buffId);
  };

  // Get active buff instance
  const getActiveBuffInstance = (buffId) => {
    return activeBattlefieldConditions.find(condition => condition.id === buffId);
  };

  return (
    <div className="debug-buff-panel-overlay">
      <div className="debug-buff-panel">
        {/* Header */}
        <div className="debug-buff-panel-header">
          <h2>🐛 Buff Debug Panel</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {/* Active Buffs Section */}
        <div className="debug-section">
          <h3>当前生效的Buff ({activeBattlefieldConditions.length})</h3>
          <div className="active-buffs-list">
            {activeBattlefieldConditions.length === 0 ? (
              <div className="empty-message">没有激活的buff</div>
            ) : (
              activeBattlefieldConditions.map((condition, index) => (
                <div key={`${condition.id}_${index}`} className="active-buff-item">
                  <div className="buff-info">
                    <span className={`buff-badge ${condition.isBuff ? 'buff' : 'debuff'}`}>
                      {condition.isBuff ? 'BUFF' : 'DEBUFF'}
                    </span>
                    <span className="buff-name">{condition.name}</span>
                    {condition.source && (
                      <span className="buff-source">({condition.source})</span>
                    )}
                  </div>
                  <button
                    className="remove-buff-button"
                    onClick={() => onRemoveBuff(index)}
                    title="移除此buff"
                  >
                    移除
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="debug-section">
          <h3>Buff库 ({filteredBuffs.length} / {Object.keys(allBuffs).length})</h3>
          <div className="buff-filters">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="filter-select"
            >
              <option value="all">所有类别</option>
              {Object.keys(categories).map(cat => (
                <option key={cat} value={cat}>{categories[cat]}</option>
              ))}
            </select>

            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={showBuffsOnly}
                onChange={(e) => {
                  setShowBuffsOnly(e.target.checked);
                  if (e.target.checked) setShowDebuffsOnly(false);
                }}
              />
              仅Buff
            </label>

            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={showDebuffsOnly}
                onChange={(e) => {
                  setShowDebuffsOnly(e.target.checked);
                  if (e.target.checked) setShowBuffsOnly(false);
                }}
              />
              仅Debuff
            </label>
          </div>
        </div>

        {/* Buff List */}
        <div className="debug-section buff-registry-list">
          {filteredBuffs.map(buff => {
            const active = isBuffActive(buff.id);
            const activeInstance = getActiveBuffInstance(buff.id);

            return (
              <div key={buff.id} className={`buff-registry-item ${active ? 'active' : ''}`}>
                <div className="buff-registry-header">
                  <div className="buff-title">
                    <span className={`buff-badge ${buff.isBuff ? 'buff' : 'debuff'}`}>
                      {buff.isBuff ? 'BUFF' : 'DEBUFF'}
                    </span>
                    <span className="buff-name">{buff.name}</span>
                    <span className="buff-id">({buff.id})</span>
                  </div>
                  <button
                    className={`add-buff-button ${active ? 'active' : ''}`}
                    onClick={() => active ? null : onAddBuff(buff.id)}
                    disabled={active}
                  >
                    {active ? '✓ 已激活' : '+ 添加'}
                  </button>
                </div>

                <div className="buff-description">{buff.description}</div>

                <div className="buff-effects">
                  {(Array.isArray(buff.effects) ? buff.effects : [buff.effects]).map((effect, idx) => (
                    <div key={idx} className="effect-tag">
                      {effect.description || `${effect.type}: ${effect.value || ''}`}
                    </div>
                  ))}
                </div>

                <div className="buff-meta">
                  <span className="meta-tag category">{buff.category}</span>
                  <span className="meta-tag scope">{buff.scope}</span>
                  {buff.tags && buff.tags.map(tag => (
                    <span key={tag} className="meta-tag tag">{tag}</span>
                  ))}
                </div>

                {active && activeInstance && (
                  <div className="buff-active-info">
                    激活于第 {activeInstance.appliedAt || '?'} 回合
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default DebugBuffPanel;
