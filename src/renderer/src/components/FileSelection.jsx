import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStrategy } from '../contexts/StrategyContext';
import { useLicense } from '../contexts/LicenseContext';
import { useCloud } from '../contexts/CloudContext';
import CloudFileBrowser from './CloudFileBrowser';
import {
  Target, Sparkles, BarChart3,
  PenTool, TrendingUp, Settings, ChevronLeft, ChevronRight,
  Layout, Users, PieChart, Cloud, X
} from 'lucide-react';
import transdataLogo from '../assets/transdata-logo.jpg';

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
  const { loadFile, createNewFile, isLoading } = useStrategy();
  const { getCompanyInfo } = useLicense();
  const { isConfigured: isCloudConfigured } = useCloud();
  const [loadError, setLoadError] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [showCloudPanel, setShowCloudPanel] = useState(false);

  const companyInfo = getCompanyInfo();

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

  const handleOpenFile = async (filePath) => {
    if (!filePath) return;
    setLoadError(null);
    const result = await loadFile(filePath);
    if (result.success) {
      navigate('/main');
    } else {
      setLoadError(result.error);
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

  const CurrentIcon = screenshots[currentSlide].icon;

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-content">
          <div className="hero-branding">
            <img
              src={transdataLogo}
              alt="Transdata"
              className="hero-logo"
            />
            <p className="hero-founded">Established 1991</p>
            <p className="hero-subtitle">CPM Strategy Cascade Platform</p>
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
            <div className="hero-buttons">
              <button
                className="btn-hero btn-hero-primary"
                onClick={handleCreateNew}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="spinner-small"></span>
                    Loading...
                  </>
                ) : (
                  <><Sparkles size={20} /> New Strategy</>
                )}
              </button>

              {isCloudConfigured && (
                <button
                  className="btn-hero btn-hero-cloud"
                  onClick={() => setShowCloudPanel(true)}
                  disabled={isLoading}
                >
                  <Cloud size={20} /> Cloud Storage
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Cloud Panel Overlay */}
        {showCloudPanel && (
          <div className="cloud-panel-overlay">
            <div className="cloud-panel-container">
              <button
                className="cloud-panel-close"
                onClick={() => setShowCloudPanel(false)}
              >
                <X size={24} />
              </button>
              <CloudFileBrowser onFileOpened={(filePath) => {
                setShowCloudPanel(false);
                handleOpenFile(filePath);
              }} />
            </div>
          </div>
        )}

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
