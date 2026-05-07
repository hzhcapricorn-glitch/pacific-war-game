import React, { useState } from 'react';
import manualData from '../data/manual.json';
import '../styles/Manual.css';

function Manual({ isOpen, onClose }) {
  const [currentSection, setCurrentSection] = useState('intro');

  if (!isOpen) return null;

  const section = manualData.sections.find(s => s.id === currentSection);

  const renderContent = (item) => {
    switch (item.type) {
      case 'heading':
        return <h3 key={JSON.stringify(item)} className="manual-heading">{item.text}</h3>;

      case 'paragraph':
        return (
          <p key={JSON.stringify(item)} className="manual-paragraph">
            {item.text}
          </p>
        );

      case 'list':
        return (
          <ul key={JSON.stringify(item)} className="manual-list">
            {item.items.map((listItem, idx) => (
              <li key={idx} dangerouslySetInnerHTML={{ __html: listItem }} />
            ))}
          </ul>
        );

      case 'qa':
        return (
          <div key={JSON.stringify(item)} className="manual-qa">
            <div className="manual-question">Q: {item.question}</div>
            <div className="manual-answer">A: {item.answer}</div>
          </div>
        );

      case 'image':
        return (
          <div key={JSON.stringify(item)} className="manual-image-container">
            {item.caption && <p className="manual-image-caption">{item.caption}</p>}
            <img
              src={item.src}
              alt={item.alt || item.caption || '说明图片'}
              className="manual-image"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="manual-overlay" onClick={onClose}>
      <div className="manual-container" onClick={(e) => e.stopPropagation()}>
        <div className="manual-header">
          <h2>{manualData.title}</h2>
          <button className="manual-close" onClick={onClose}>✕</button>
        </div>

        <div className="manual-body">
          <div className="manual-nav">
            {manualData.sections.map(sec => (
              <button
                key={sec.id}
                className={`manual-nav-item ${currentSection === sec.id ? 'active' : ''}`}
                onClick={() => setCurrentSection(sec.id)}
              >
                <span className="manual-nav-icon">{sec.icon}</span>
                <span className="manual-nav-text">{sec.title}</span>
              </button>
            ))}
          </div>

          <div className="manual-content">
            <h2 className="manual-section-title">
              <span className="manual-section-icon">{section.icon}</span>
              {section.title}
            </h2>
            <div className="manual-content-body">
              {section.content.map((item, idx) => (
                <React.Fragment key={idx}>
                  {renderContent(item)}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        <div className="manual-footer">
          <span>版本 {manualData.version}</span>
          <span>使用 ← → 或点击左侧导航切换章节</span>
        </div>
      </div>
    </div>
  );
}

export default Manual;
