import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          background: '#1a202c',
          color: '#fff',
          minHeight: '100vh',
          fontFamily: 'monospace'
        }}>
          <h1 style={{ color: '#ef4444' }}>游戏加载错误</h1>
          <h2>错误信息:</h2>
          <pre style={{
            background: '#2d3748',
            padding: '15px',
            borderRadius: '8px',
            overflow: 'auto',
            color: '#fbbf24'
          }}>
            {this.state.error && this.state.error.toString()}
          </pre>

          <h2>错误堆栈:</h2>
          <pre style={{
            background: '#2d3748',
            padding: '15px',
            borderRadius: '8px',
            overflow: 'auto',
            fontSize: '12px',
            color: '#cbd5e0'
          }}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>

          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: '#3182ce',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            重新加载页面
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
