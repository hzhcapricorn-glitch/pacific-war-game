import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import Card from './Card';
import gameConfig from '../data/config.json';

/**
 * Shop Component - 显示商店（分为必要卡牌和随机卡牌）
 */
function Shop({
  essentialShopCards,
  randomShopCards,
  onCardClick,
  onCardHover,
  onCardHoverEnd,
  currentSupply,
  maxSupplyRetention,
  allEssentialCardTypes,
  currentPhase,
  isShopPhase,
  onDebugAddSupply,
  onDebugRefreshShop,
  onDebugDrawCard,
  onDebugUntapAll,
  onDebugToggleBuffPanel,
  onDebugSwitchMission,
  onDebugSaveSnapshot,
  onDebugLoadSnapshot,
  onOpenManual,
  onSaveGame,
  onLoadGame,
  allCombatCards,
  gameState
}) {
  // 保存所有见过的必要卡牌种类
  const [knownEssentialTypes, setKnownEssentialTypes] = useState([]);
  // 补给变化动画状态
  const [supplyChangeType, setSupplyChangeType] = useState(null); // 'increase' | 'decrease' | null
  const [prevSupply, setPrevSupply] = useState(currentSupply);
  const [animationKey, setAnimationKey] = useState(0); // Force re-render for animation
  // 文件上传ref
  const fileInputRef = React.createRef();
  // 防止快照双击保存
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  // 防止游戏保存重复
  const [isSavingGame, setIsSavingGame] = useState(false);
  // 库存信息弹窗
  const [showInventoryModal, setShowInventoryModal] = useState(false);

  // 初始化时从所有卡牌中提取必要卡牌种类
  useEffect(() => {
    if (allEssentialCardTypes && allEssentialCardTypes.length > 0) {
      const types = {};
      allEssentialCardTypes.forEach(card => {
        if (!types[card.id]) {
          types[card.id] = card;
        }
      });
      setKnownEssentialTypes(types);
    }
  }, [allEssentialCardTypes]);

  // 监听补给变化，触发动画
  useEffect(() => {
    if (currentSupply !== prevSupply) {
      // 先清除动画状态，确保可以重新触发
      setSupplyChangeType(null);
      setAnimationKey(prev => prev + 1);

      // 下一帧设置新的动画类型
      requestAnimationFrame(() => {
        if (currentSupply > prevSupply) {
          setSupplyChangeType('increase');
        } else {
          setSupplyChangeType('decrease');
        }
      });

      setPrevSupply(currentSupply);

      const timer = setTimeout(() => {
        setSupplyChangeType(null);
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [currentSupply, prevSupply]);

  // 按卡牌种类分组必要卡牌
  const groupedEssentialCards = {};

  // 首先基于已知的所有种类创建空堆
  Object.values(knownEssentialTypes).forEach(cardDef => {
    groupedEssentialCards[cardDef.id] = {
      card: cardDef,
      count: 0,
      actualCards: [] // 存储实际的卡牌实例
    };
  });

  // 然后计算实际数量并保存实例
  essentialShopCards.forEach(card => {
    if (groupedEssentialCards[card.id]) {
      groupedEssentialCards[card.id].count++;
      groupedEssentialCards[card.id].actualCards.push(card);
    }
  });

  const essentialStacks = Object.values(groupedEssentialCards);

  const isDebugEnabled = gameConfig.debug?.enabled || false;

  return (
    <div className={`shop ${!isShopPhase ? 'shop-disabled' : ''}`}>
      <div className="shop-header">
        <h3>商店</h3>
        <div className="shop-header-buttons">
          {onOpenManual && (
            <button onClick={onOpenManual} className="btn-manual-inline" title="游戏手册">
              📖 游戏手册
            </button>
          )}
          {/* 暂时隐藏保存/读取按钮
          {onSaveGame && (
            <button
              onClick={() => {
                if (isSavingGame) return;
                setIsSavingGame(true);
                onSaveGame();
                setTimeout(() => setIsSavingGame(false), 1000);
              }}
              className="btn-save-inline"
              title="保存游戏"
              disabled={isSavingGame}
            >
              💾 保存
            </button>
          )}
          {onLoadGame && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      try {
                        const saveData = JSON.parse(event.target.result);
                        onLoadGame(saveData);
                      } catch (error) {
                        alert('存档加载失败：文件格式错误\n' + error.message);
                      }
                    };
                    reader.onerror = () => {
                      alert('存档加载失败：文件读取错误');
                    };
                    reader.readAsText(file);
                  }
                  e.target.value = '';
                }}
              />
              <button onClick={() => fileInputRef.current?.click()} className="btn-load-inline" title="读取游戏">
                📂 读取
              </button>
            </>
          )}
          */}
          {isDebugEnabled && (onDebugAddSupply || onDebugRefreshShop || onDebugDrawCard || onDebugUntapAll || onDebugToggleBuffPanel || onDebugSwitchMission) && (
            <div className="debug-controls-inline">
            {onDebugAddSupply && (
              <button onClick={onDebugAddSupply} className="btn-debug-inline">
                补给+10
              </button>
            )}
            {onDebugRefreshShop && (
              <button onClick={onDebugRefreshShop} className="btn-debug-inline">
                刷新商店
              </button>
            )}
            {onDebugDrawCard && (
              <button onClick={onDebugDrawCard} className="btn-debug-inline">
                抽一张卡
              </button>
            )}
            {onDebugUntapAll && (
              <button onClick={onDebugUntapAll} className="btn-debug-inline">
                整备所有
              </button>
            )}
            {onDebugSwitchMission && (
              <button onClick={onDebugSwitchMission} className="btn-debug-inline">
                更换任务
              </button>
            )}
            {onDebugSaveSnapshot && (
              <button
                onClick={() => {
                  if (isSavingSnapshot) return;
                  setIsSavingSnapshot(true);
                  onDebugSaveSnapshot();
                  setTimeout(() => setIsSavingSnapshot(false), 1000);
                }}
                className="btn-debug-inline"
                disabled={isSavingSnapshot}
              >
                💾 保存快照
              </button>
            )}
            {onDebugLoadSnapshot && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        try {
                          const snapshot = JSON.parse(event.target.result);

                          // Ask user if they want to reload phase data
                          const reloadPhase = window.confirm(
                            '是否重载阶段数据？\n\n' +
                            '【是】- 重建商店和任务列表（推荐，修复商店不匹配问题）\n' +
                            '【否】- 只恢复卡牌区域，保留当前商店'
                          );

                          onDebugLoadSnapshot(snapshot, reloadPhase);
                        } catch (error) {
                          alert('快照加载失败：文件格式错误\n' + error.message);
                        }
                      };
                      reader.onerror = () => {
                        alert('快照加载失败：文件读取错误');
                      };
                      reader.readAsText(file);
                    }
                    e.target.value = '';
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-debug-inline"
                >
                  📂 加载快照
                </button>
              </>
            )}
            {onDebugToggleBuffPanel && (
              <button onClick={onDebugToggleBuffPanel} className="btn-debug-inline">
                Buff面板
              </button>
            )}
            <button onClick={() => setShowInventoryModal(true)} className="btn-debug-inline">
              📊 库存信息
            </button>
          </div>
          )}
        </div>
        <div className="supply-display">
          补给: <span className="supply-container" key={animationKey}>
            <span className={`supply-value ${supplyChangeType ? `supply-${supplyChangeType}` : ''}`}>
              {currentSupply}
            </span>
            {supplyChangeType === 'increase' && <span className="supply-arrow supply-arrow-up">↑</span>}
            {supplyChangeType === 'decrease' && <span className="supply-arrow supply-arrow-down">↓</span>}
          </span> / {maxSupplyRetention}
        </div>
      </div>
      <div className="shop-content-horizontal">
        <div className="shop-section shop-section-left">
          <h4 className="shop-section-title">必要卡牌</h4>
          <div className="shop-cards essential-shop">
            {essentialStacks.length === 0 ? (
              <div className="shop-empty">暂无必要卡牌</div>
            ) : (
              essentialStacks
                .filter(stack => stack.count > 0) // 只显示有库存的卡牌
                .map((stack) => {
                  const canAfford = stack.card.cost <= currentSupply;
                  const isAvailable = isShopPhase && canAfford;
                  return (
                    <div
                      key={stack.card.id}
                      className={`shop-card-stack ${!canAfford && isShopPhase ? 'unaffordable' : ''}`}
                    >
                      <Card
                        card={stack.card}
                        onClick={isAvailable ? () => onCardClick(stack.actualCards[0], 'essential') : undefined}
                        onHover={onCardHover}
                        onHoverEnd={onCardHoverEnd}
                        className={`shop-card ${!canAfford && isShopPhase ? 'unaffordable' : ''}`}
                      />
                      <div className="card-stack-count">
                        {stack.count}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        <div className="shop-section shop-section-right">
          <h4 className="shop-section-title">随机卡牌</h4>
          <div className="shop-cards random-shop">
            {randomShopCards.length === 0 ? (
              <div className="shop-empty">暂无随机卡牌</div>
            ) : (
              randomShopCards.map((card) => {
                const canAfford = card.cost <= currentSupply;
                const isAvailable = isShopPhase && canAfford;
                return (
                  <div key={card.instanceId} className={`shop-card-single ${!canAfford && isShopPhase ? 'unaffordable' : ''}`}>
                    <Card
                      card={card}
                      onClick={isAvailable ? () => onCardClick(card, 'random') : undefined}
                      onHover={onCardHover}
                      onHoverEnd={onCardHoverEnd}
                      className={`shop-card ${!canAfford && isShopPhase ? 'unaffordable' : ''}`}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 库存信息弹窗 */}
      {showInventoryModal && gameState && allCombatCards && (
        <InventoryModal
          gameState={gameState}
          allCombatCards={allCombatCards}
          currentPhase={currentPhase}
          onClose={() => setShowInventoryModal(false)}
        />
      )}
    </div>
  );
}

// 库存信息弹窗组件
function InventoryModal({ gameState, allCombatCards, currentPhase, onClose }) {
  // 计算库存信息
  const getInventoryInfo = () => {
    const inventory = {};

    // 遍历所有战斗卡牌定义
    allCombatCards.forEach(cardDef => {
      const cardId = cardDef.id;

      // 计算应有数量（essential + random）
      const essentialCopies = cardDef.essentialShopCopies !== undefined
        ? cardDef.essentialShopCopies
        : (cardDef.shopCopies !== undefined ? cardDef.shopCopies : 0);
      const randomCopies = cardDef.randomShopCopies !== undefined
        ? cardDef.randomShopCopies
        : (cardDef.shopCopies !== undefined ? cardDef.shopCopies : 0);
      const totalShould = essentialCopies + randomCopies;

      // 计算当前在商店的数量
      const essentialShopCount = (gameState.zones.essentialShop || []).filter(c => c.id === cardId).length;
      const randomShopCount = (gameState.zones.randomShop || []).filter(c => c.id === cardId).length;
      const randomShopDeckCount = (gameState.zones.randomShopDeck || []).filter(c => c.id === cardId).length;
      const inShop = essentialShopCount + randomShopCount + randomShopDeckCount;

      // 计算玩家拥有的数量（部署区、手牌、牌库、弃牌堆）
      const deployedCount = (gameState.zones.deployed || []).filter(c => c.id === cardId).length;
      const handCount = (gameState.zones.hand || []).filter(c => c.id === cardId).length;
      const deckCount = (gameState.zones.deck || []).filter(c => c.id === cardId).length;
      const discardCount = (gameState.zones.discard || []).filter(c => c.id === cardId).length;
      const owned = deployedCount + handCount + deckCount + discardCount;

      // 总计
      const total = inShop + owned;
      const diff = totalShould - total;

      inventory[cardId] = {
        name: cardDef.name,
        essentialShould: essentialCopies,
        randomShould: randomCopies,
        totalShould,
        essentialShopCount,
        randomShopCount,
        randomShopDeckCount,
        inShop,
        deployedCount,
        handCount,
        deckCount,
        discardCount,
        owned,
        total,
        diff
      };
    });

    return inventory;
  };

  const inventory = getInventoryInfo();

  // 按差值排序（缺少的在前）
  const sortedCards = Object.entries(inventory).sort((a, b) => a[1].diff - b[1].diff);

  return ReactDOM.createPortal(
    <div className="inventory-panel-overlay" onClick={onClose}>
      <div className="inventory-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="inventory-panel-header">
          <h2>📊 商店库存信息</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {/* Inventory Table */}
        <div className="inventory-panel-body">
          <div className="inventory-table-container">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>卡牌</th>
                  <th>应有总数</th>
                  <th>E商店</th>
                  <th>R商店</th>
                  <th>R牌堆</th>
                  <th>商店合计</th>
                  <th>玩家拥有</th>
                  <th>实际总数</th>
                  <th>差值</th>
                </tr>
              </thead>
              <tbody>
                {sortedCards.map(([cardId, info]) => (
                  <tr key={cardId} className={info.diff < 0 ? 'inventory-row-missing' : info.diff > 0 ? 'inventory-row-extra' : ''}>
                    <td>{info.name.replace(/\n/g, '')}</td>
                    <td>{info.totalShould} <span className="inventory-detail">({info.essentialShould}E+{info.randomShould}R)</span></td>
                    <td>{info.essentialShopCount}</td>
                    <td>{info.randomShopCount}</td>
                    <td>{info.randomShopDeckCount}</td>
                    <td><strong>{info.inShop}</strong></td>
                    <td>
                      <div className="inventory-owned">
                        {info.owned}
                        <span className="inventory-detail">
                          {info.deployedCount > 0 && `部署${info.deployedCount} `}
                          {info.handCount > 0 && `手${info.handCount} `}
                          {info.deckCount > 0 && `库${info.deckCount} `}
                          {info.discardCount > 0 && `弃${info.discardCount}`}
                        </span>
                      </div>
                    </td>
                    <td><strong>{info.total}</strong></td>
                    <td className={info.diff < 0 ? 'inventory-diff-negative' : info.diff > 0 ? 'inventory-diff-positive' : ''}>
                      {info.diff > 0 ? '+' : ''}{info.diff}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default Shop;
