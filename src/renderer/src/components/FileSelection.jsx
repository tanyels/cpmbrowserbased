import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStrategy } from '../contexts/StrategyContext';
import { useLicense } from '../contexts/LicenseContext';
import {
  Target, FolderOpen, Sparkles, FileText, BarChart3,
  PenTool, TrendingUp, Settings, ChevronLeft, ChevronRight,
  Play, Layout, Users, PieChart
} from 'lucide-react';

// Screenshot carousel data
const screenshots = [
  {
    id: 1,
    title: 'Strategy Map',
    description: 'Visualize your entire strategy hierarchy from vision to KPIs',
    icon: Layout
  },
  {
    id: 2,
    title: 'Interactive Dashboard',
    description: 'Real-time performance tracking with customizable gauges and charts',
    icon: PieChart
  },
  {
    id: 3,
    title: 'Organization View',
    description: 'See your business units and team structure at a glance',
    icon: Users
  },
  {
    id: 4,
    title: 'Scorecard Analytics',
    description: 'Detailed KPI scorecards with trend analysis and achievements',
    icon: TrendingUp
  }
];

function FileSelection() {
  const navigate = useNavigate();
  const { loadFile, createNewFile, generateSampleFile, isLoading } = useStrategy();
  const { getCompanyInfo } = useLicense();
  const [lastFilePath, setLastFilePath] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const companyInfo = getCompanyInfo();

  useEffect(() => {
    async function getLastFile() {
      const path = await window.electronAPI.getLastFilePath();
      setLastFilePath(path);
    }
    getLastFile();
  }, []);

  // Auto-advance carousel
  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % screenshots.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isAutoPlaying]);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % screenshots.length);
    setIsAutoPlaying(false);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + screenshots.length) % screenshots.length);
    setIsAutoPlaying(false);
  }, []);

  const goToSlide = useCallback((index) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
  }, []);

  const handleOpenFile = async (filePath = null) => {
    setLoadError(null);
    let path = filePath;

    if (!path) {
      path = await window.electronAPI.openFileDialog();
    }

    if (path) {
      const result = await loadFile(path);
      if (result.success) {
        navigate('/main');
      } else {
        setLoadError(result.error);
      }
    }
  };

  const handleCreateNew = async () => {
    setLoadError(null);
    const result = await createNewFile();
    if (result.success) {
      navigate('/main');
    } else if (!result.cancelled) {
      setLoadError(result.error);
    }
  };

  const handleGenerateSample = async () => {
    setLoadError(null);
    const result = await generateSampleFile();
    if (result.success) {
      navigate('/main');
    } else if (!result.cancelled) {
      setLoadError(result.error);
    }
  };

  const CurrentIcon = screenshots[currentSlide].icon;

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-content">
          <div className="hero-branding">
            {companyInfo?.name ? (
              <>
                {companyInfo.logo && (
                  <img
                    src={companyInfo.logo}
                    alt={companyInfo.name}
                    className="hero-logo"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                )}
                <h1 className="hero-title">{companyInfo.name}</h1>
              </>
            ) : (
              <>
                <div className="hero-icon"><Target size={56} /></div>
                <h1 className="hero-title">CPM Strategy Cascade</h1>
              </>
            )}
            <p className="hero-subtitle">Strategy-to-KPI Structuring Platform</p>
            <p className="hero-description">
              Design, structure, and cascade your organization's strategy into measurable KPIs across all business unit levels
            </p>
          </div>

          {loadError && (
            <div className="landing-error">
              {loadError}
            </div>
          )}

          {/* Action Buttons */}
          <div className="hero-actions">
            {lastFilePath && (
              <div
                className="last-file-card"
                onClick={() => handleOpenFile(lastFilePath)}
              >
                <div className="last-file-icon"><FileText size={20} /></div>
                <div className="last-file-info">
                  <span className="last-file-label">Continue where you left off</span>
                  <span className="last-file-path">{lastFilePath.split('/').pop() || lastFilePath.split('\\').pop()}</span>
                </div>
                <ChevronRight size={20} className="last-file-arrow" />
              </div>
            )}

            <div className="hero-buttons">
              <button
                className="btn-hero btn-hero-primary"
                onClick={() => handleOpenFile()}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="spinner-small"></span>
                    Loading...
                  </>
                ) : (
                  <><FolderOpen size={20} /> Open File</>
                )}
              </button>

              <button
                className="btn-hero btn-hero-secondary"
                onClick={handleCreateNew}
                disabled={isLoading}
              >
                <Sparkles size={20} /> New Strategy
              </button>

              <button
                className="btn-hero btn-hero-outline"
                onClick={handleGenerateSample}
                disabled={isLoading}
              >
                <Play size={20} /> Try Demo
              </button>
            </div>
          </div>
        </div>

        {/* Screenshot Carousel */}
        <div className="hero-carousel">
          <div className="carousel-container">
            <div className="carousel-slide">
              <div className="carousel-placeholder">
                <CurrentIcon size={80} strokeWidth={1} />
                <h3>{screenshots[currentSlide].title}</h3>
                <p>{screenshots[currentSlide].description}</p>
              </div>
            </div>

            <button className="carousel-btn carousel-btn-prev" onClick={prevSlide}>
              <ChevronLeft size={24} />
            </button>
            <button className="carousel-btn carousel-btn-next" onClick={nextSlide}>
              <ChevronRight size={24} />
            </button>
          </div>

          <div className="carousel-dots">
            {screenshots.map((_, index) => (
              <button
                key={index}
                className={`carousel-dot ${index === currentSlide ? 'active' : ''}`}
                onClick={() => goToSlide(index)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="landing-features">
        <h2 className="features-title">Everything you need to manage strategy</h2>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-card-header">
              <div className="feature-card-icon"><PenTool size={24} /></div>
              <h3>Design & Structure</h3>
            </div>
            <ul>
              <li>Vision, Mission & Strategic Pillars</li>
              <li>Business Units (L1 → L2 → L3)</li>
              <li>Team Members Hierarchy</li>
              <li>Cascaded Objectives & KPIs</li>
            </ul>
          </div>

          <div className="feature-card">
            <div className="feature-card-header">
              <div className="feature-card-icon"><BarChart3 size={24} /></div>
              <h3>Track & Visualize</h3>
            </div>
            <ul>
              <li>Interactive Strategy Map</li>
              <li>Organization Chart View</li>
              <li>Strategy Cascade Visualization</li>
              <li>Real-time Dashboard</li>
            </ul>
          </div>

          <div className="feature-card">
            <div className="feature-card-header">
              <div className="feature-card-icon"><TrendingUp size={24} /></div>
              <h3>Measure & Analyze</h3>
            </div>
            <ul>
              <li>Formula Builder for Measures</li>
              <li>Monthly Data Entry</li>
              <li>BU Scorecards with Trends</li>
              <li>Employee Scorecards</li>
            </ul>
          </div>

          <div className="feature-card">
            <div className="feature-card-header">
              <div className="feature-card-icon"><Settings size={24} /></div>
              <h3>Configure</h3>
            </div>
            <ul>
              <li>Achievement Thresholds</li>
              <li>Custom Color Schemes</li>
              <li>Monthly Targets</li>
              <li>Overachievement Caps</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>© {new Date().getFullYear()} Transdata Bilgi Islem LTD STI. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default FileSelection;
