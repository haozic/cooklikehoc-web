import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect, useCallback } from 'react';
import { getCategories, getFeaturedRecipes, getRecipesByCategory, getRecipeById, searchRecipes, recipes, getFlavorTypes, getCookingMethods, getProcessingLevels, filterRecipes } from './data/recipes';
import './App.css';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function BackButton() {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(-1)} className="back-btn">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
      返回
    </button>
  );
}

const CatIcon = ({ name, className }) => {
  const icons = {
    '炒菜': <path d="M3 2v6l3 3v7h4v-7l3-3V2H3zm2 2h2v2H5V4zm4 0h2v2H9V4zM5 8h6v2H5V8z" fill="currentColor"/>,
    '炸品': <path d="M4 3C2.9 3 2 3.9 2 5v2h12V5c0-1.1-.9-2-2-2H4zm0 6v7c0 1.1.9 2 2 2h4c1.1 0 2-.9 2-2V9H4z" fill="currentColor"/>,
    '主食': <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-4-4 1.41-1.41L11 14.17l5.59-5.59L18 10l-7 7z" fill="currentColor"/>,
    '早餐': <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z" fill="currentColor"/>,
    '饮品': <path d="M3 2l1.5 14h11L17 2H3zm4 16h6l-1 2H8l-1-2z" fill="currentColor"/>,
    '其他': <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>,
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {icons[name] || icons['其他']}
    </svg>
  );
};

const catColors = {
  '炒菜': '#FDF3EF',
  '炸品': '#FDF8F0',
  '主食': '#F2F7F0',
  '早餐': '#F0F5FA',
  '饮品': '#F8F0FA',
  '其他': '#F5F2ED',
};

const catIconColors = {
  '炒菜': '#C44D34',
  '炸品': '#D4912E',
  '主食': '#4A7C59',
  '早餐': '#5B7FA5',
  '饮品': '#8B5BA5',
  '其他': '#8B7355',
};

function RecipeImage({ src, alt, className }) {
  const [error, setError] = useState(false);
  if (error) {
    return <div className={className} style={{ background: 'var(--cream-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />;
  }
  return <img className={className} src={src} alt={alt} loading="lazy" onError={() => setError(true)} />;
}

function Home() {
  const categories = getCategories();
  const featured = getFeaturedRecipes();
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerRef = useRef(null);
  const totalBanners = featured.length;

  const scrollToBanner = useCallback((index) => {
    if (bannerRef.current) {
      const cardWidth = bannerRef.current.children[0]?.offsetWidth || 0;
      const gap = 16;
      bannerRef.current.scrollTo({ left: index * (cardWidth + gap), behavior: 'smooth' });
    }
    setBannerIndex(index);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setBannerIndex(prev => {
        const next = (prev + 1) % totalBanners;
        scrollToBanner(next);
        return next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [totalBanners, scrollToBanner]);

  const handleBannerScroll = () => {
    if (bannerRef.current) {
      const cardWidth = bannerRef.current.children[0]?.offsetWidth || 1;
      const gap = 16;
      const idx = Math.round(bannerRef.current.scrollLeft / (cardWidth + gap));
      if (idx !== bannerIndex && idx >= 0 && idx < totalBanners) {
        setBannerIndex(idx);
      }
    }
  };

  return (
    <div className="page home-page">
      <div className="home-hero">
        <h1 className="hero-title">像老乡鸡那样做饭</h1>
        <p className="hero-subtitle">老乡鸡菜品溯源报告 · {recipes.length} 道家常菜谱</p>
      </div>

      <section className="section banner-section">
        <div className="banner-container">
          <div className="banner-track" ref={bannerRef} onScroll={handleBannerScroll}>
            {featured.map(recipe => (
              <Link to={`/recipe/${recipe.id}`} key={recipe.id} className="banner-card">
                <div className="banner-img">
                  <RecipeImage src={recipe.image} alt={recipe.title} />
                </div>
                <div className="banner-overlay" />
                <div className="banner-content">
                  <span className="banner-badge">{recipe.category}</span>
                  <h3 className="banner-title">{recipe.title}</h3>
                  <div className="banner-meta">
                    {recipe.flavorType && <span className="banner-tag">{recipe.flavorType}</span>}
                    {recipe.cookingMethod && <span className="banner-tag">{recipe.cookingMethod}</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="banner-dots">
            {featured.map((_, i) => (
              <button
                key={i}
                className={`banner-dot ${i === bannerIndex ? 'active' : ''}`}
                onClick={() => scrollToBanner(i)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="section category-section">
        <div className="section-header">
          <h2 className="section-title">菜谱分类</h2>
        </div>
        <div className="category-grid">
          {categories.map(cat => (
            <Link to={`/category/${cat.id}`} key={cat.id} className="category-card">
              <div className="cat-icon" style={{ background: catColors[cat.name] || catColors['其他'], color: catIconColors[cat.name] || catIconColors['其他'] }}>
                <CatIcon name={cat.name} />
              </div>
              <div className="cat-info">
                <span className="cat-name">{cat.name}</span>
                <span className="cat-count">{getRecipesByCategory(cat.id).length} 道</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section all-section">
        <div className="section-header">
          <h2 className="section-title">全部菜谱</h2>
          <Link to="/all" className="section-more">{recipes.length} 道 →</Link>
        </div>
        <div className="recipe-grid">
          {recipes.slice(0, 8).map(recipe => (
            <Link to={`/recipe/${recipe.id}`} key={recipe.id} className="recipe-card">
              <div className="recipe-card-img">
                <RecipeImage src={recipe.image} alt={recipe.title} />
              </div>
              <div className="recipe-card-body">
                <h4>{recipe.title}</h4>
                <div className="recipe-card-meta">
                  <span className="meta-tag">{recipe.category}</span>
                  {recipe.flavorType && <span className="meta-tag flavor">{recipe.flavorType}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function CategoryPage() {
  const { id } = useParams();
  const categories = getCategories();
  const cat = categories.find(c => c.id === id);
  const categoryRecipes = getRecipesByCategory(id);

  return (
    <div className="page category-page">
      <header className="app-header">
        <div className="header-content">
          <BackButton />
          <h1>{cat?.name || '分类'}</h1>
        </div>
      </header>

      <div className="category-recipe-list">
        <p className="list-title">
          {cat?.name} <span className="count">({categoryRecipes.length} 道菜)</span>
        </p>
        {categoryRecipes.map(recipe => (
          <Link to={`/recipe/${recipe.id}`} key={recipe.id} className="recipe-row">
            <div className="recipe-row-img">
              <RecipeImage src={recipe.image} alt={recipe.title} />
            </div>
            <div className="recipe-row-info">
              <h4>{recipe.title}</h4>
              <div className="recipe-row-tags">
                {recipe.flavorType && <span className="meta-tag flavor">{recipe.flavorType}</span>}
              </div>
              <p className="ingredients-preview">
                {recipe.ingredients.slice(0, 4).join('、')}{recipe.ingredients.length > 4 ? '...' : ''}
              </p>
            </div>
            <svg className="recipe-row-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
          </Link>
        ))}
      </div>
    </div>
  );
}

function RecipeDetailPage() {
  const { id } = useParams();
  const recipe = getRecipeById(id);
  const categories = getCategories();
  const sameCategoryRecipes = recipe ? getRecipesByCategory(recipe.categoryDir).filter(r => r.id !== id) : [];

  if (!recipe) {
    return (
      <div className="page not-found">
        <header className="app-header">
          <div className="header-content">
            <Link to="/" className="back-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
              返回
            </Link>
          </div>
        </header>
        <div className="not-found-content">
          <h2>未找到该菜谱</h2>
          <Link to="/" className="btn-primary">返回首页</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page recipe-detail-page">
      <header className="app-header">
        <div className="header-content">
          <BackButton />
          <h1>菜谱详情</h1>
          <Link to={`/share/${recipe.id}`} className="share-btn" title="分享">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </Link>
        </div>
      </header>

      <div className="recipe-hero">
        <RecipeImage src={recipe.image} alt={recipe.title} />
        <div className="hero-overlay">
          <h2>{recipe.title}</h2>
          <div className="hero-tags">
            <span className="tag">{recipe.category}</span>
            {recipe.flavorType && <span className="tag">{recipe.flavorType}</span>}
            {recipe.cookingMethod && <span className="tag">{recipe.cookingMethod}</span>}
          </div>
        </div>
      </div>

      <div className="recipe-content">
        <div className="recipe-meta">
          {recipe.processingLevel && (
            <div className="meta-item">
              <span className="meta-label">加工等级</span>
              <span className="meta-value">{recipe.processingLevel}</span>
            </div>
          )}
          {recipe.bestFlavorPeriod && (
            <div className="meta-item">
              <span className="meta-label">最佳风味期</span>
              <span className="meta-value">{recipe.bestFlavorPeriod}</span>
            </div>
          )}
        </div>

        <section className="recipe-section">
          <h3 className="recipe-section-title">食材</h3>
          <ul className="ingredients-list">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="ingredient-item">
                <span className="ingredient-dot" />
                <span>{ing}</span>
              </li>
            ))}
          </ul>
        </section>

        {recipe.steps.length > 0 && (
          <section className="recipe-section">
            <h3 className="recipe-section-title">做法</h3>
            <div className="steps-list">
              {(() => {
                let stepNum = 0;
                return recipe.steps.map((step, i) => {
                  if (typeof step === 'object' && step.section) {
                    stepNum = 0;
                    return <h4 key={i} className="step-section-title">{step.section}</h4>;
                  }
                  stepNum++;
                  return (
                    <div key={i} className="step-item">
                      <div className="step-number">{stepNum}</div>
                      <div className="step-text">{step}</div>
                    </div>
                  );
                });
              })()}
            </div>
          </section>
        )}

        {sameCategoryRecipes.length > 0 && (
          <section className="recipe-section">
            <h3 className="recipe-section-title">更多{ categories.find(c => c.id === recipe.categoryDir)?.name }</h3>
            <div className="related-grid">
              {sameCategoryRecipes.slice(0, 6).map(r => (
                <Link to={`/recipe/${r.id}`} key={r.id} className="related-card">
                  <div className="related-img">
                    <RecipeImage src={r.image} alt={r.title} />
                  </div>
                  <div className="related-info">
                    <h4>{r.title}</h4>
                    {r.flavorType && <span className="meta-tag flavor">{r.flavorType}</span>}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function SearchPage() {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const results = query.trim() ? searchRecipes(query.trim()) : [];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="page search-page">
      <header className="app-header">
        <div className="header-content">
          <BackButton />
          <h1>搜索菜谱</h1>
        </div>
      </header>

      <div className="search-input-area">
        <div className="search-input-wrap">
          <svg className="search-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="搜索菜谱、味型、食材..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button className="search-clear" onClick={() => { setQuery(''); inputRef.current?.focus(); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>
      </div>

      {query.trim() ? (
        <>
          <div className="search-info">找到 {results.length} 个结果</div>
          {results.length > 0 ? (
            <div className="category-recipe-list">
              {results.map(recipe => (
                <Link to={`/recipe/${recipe.id}`} key={recipe.id} className="recipe-row">
                  <div className="recipe-row-img">
                    <RecipeImage src={recipe.image} alt={recipe.title} />
                  </div>
                  <div className="recipe-row-info">
                    <h4>{recipe.title}</h4>
                    <div className="recipe-row-tags">
                      <span className="meta-tag">{recipe.category}</span>
                      {recipe.flavorType && <span className="meta-tag flavor">{recipe.flavorType}</span>}
                    </div>
                    <p className="ingredients-preview">
                      {recipe.ingredients.slice(0, 4).join('、')}{recipe.ingredients.length > 4 ? '...' : ''}
                    </p>
                  </div>
                  <svg className="recipe-row-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>没有找到相关菜谱</p>
              <p style={{ fontSize: 13, marginTop: 8 }}>试试其他关键词</p>
            </div>
          )}
        </>
      ) : (
        <div className="search-hints">
          <p className="hint-label">试试搜索</p>
          <div className="hint-chips">
            {['红烧', '清炒', '炖', '麻辣', '蒜蓉', '糖醋'].map(hint => (
              <button key={hint} className="hint-chip" onClick={() => setQuery(hint)}>{hint}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AllRecipesPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeFlavor, setActiveFlavor] = useState('');
  const [activeMethod, setActiveMethod] = useState('');
  const [activeLevel, setActiveLevel] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const categories = getCategories();
  const flavorTypes = getFlavorTypes();
  const cookingMethods = getCookingMethods();
  const processingLevels = getProcessingLevels();

  const filteredRecipes = filterRecipes({
    category: activeCategory,
    flavorType: activeFlavor || undefined,
    cookingMethod: activeMethod || undefined,
    processingLevel: activeLevel || undefined,
  });

  const hasActiveFilters = activeFlavor || activeMethod || activeLevel;

  return (
    <div className="page all-recipes-page">
      <header className="app-header">
        <div className="header-content">
          <BackButton />
          <h1>全部菜谱</h1>
        </div>
      </header>

      <div className="category-tabs">
        <button className={`cat-tab ${activeCategory === 'all' ? 'active' : ''}`} onClick={() => setActiveCategory('all')}>全部</button>
        {categories.map(cat => (
          <button key={cat.id} className={`cat-tab ${activeCategory === cat.id ? 'active' : ''}`} onClick={() => setActiveCategory(cat.id)}>
            {cat.name}
          </button>
        ))}
      </div>

      <div className="filter-bar">
        <button
          className={`filter-toggle ${showFilters ? 'active' : ''} ${hasActiveFilters ? 'has-filters' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          筛选 {hasActiveFilters ? `(${[activeFlavor, activeMethod, activeLevel].filter(Boolean).length})` : ''}
        </button>
        {hasActiveFilters && (
          <button className="filter-clear" onClick={() => { setActiveFlavor(''); setActiveMethod(''); setActiveLevel(''); }}>
            清除
          </button>
        )}
      </div>

      {showFilters && (
        <div className="filter-panel">
          <div className="filter-group">
            <span className="filter-label">味型</span>
            <div className="filter-chips">
              {flavorTypes.slice(0, 12).map(ft => (
                <button
                  key={ft.name}
                  className={`filter-chip ${activeFlavor === ft.name ? 'active' : ''}`}
                  onClick={() => setActiveFlavor(activeFlavor === ft.name ? '' : ft.name)}
                >
                  {ft.name} ({ft.count})
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-label">烹饪方式</span>
            <div className="filter-chips">
              {cookingMethods.slice(0, 12).map(cm => (
                <button
                  key={cm.name}
                  className={`filter-chip ${activeMethod === cm.name ? 'active' : ''}`}
                  onClick={() => setActiveMethod(activeMethod === cm.name ? '' : cm.name)}
                >
                  {cm.name} ({cm.count})
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-label">加工等级</span>
            <div className="filter-chips">
              {processingLevels.map(pl => (
                <button
                  key={pl.name}
                  className={`filter-chip ${activeLevel === pl.name ? 'active' : ''}`}
                  onClick={() => setActiveLevel(activeLevel === pl.name ? '' : pl.name)}
                >
                  {pl.name} ({pl.count})
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="filter-result-count">
        共 {filteredRecipes.length} 道菜
      </div>

      <div className="all-recipes-grid">
        {filteredRecipes.map(recipe => (
          <Link to={`/recipe/${recipe.id}`} key={recipe.id} className="recipe-card">
            <div className="recipe-card-img">
              <RecipeImage src={recipe.image} alt={recipe.title} />
            </div>
            <div className="recipe-card-body">
              <h4>{recipe.title}</h4>
              <div className="recipe-card-meta">
                <span className="meta-tag">{recipe.category}</span>
                {recipe.flavorType && <span className="meta-tag flavor">{recipe.flavorType}</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function BottomNav() {
  const location = useLocation();
  const path = location.pathname;

  const items = [
    {
      path: '/',
      label: '首页',
      icon: <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="9 22 9 12 15 12 15 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>,
    },
    {
      path: '/all',
      label: '全部',
      icon: <><rect x="3" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="2"/></>,
    },
    {
      path: '/search',
      label: '搜索',
      icon: <><circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="2"/><path d="m21 21-4.35-4.35" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>,
    },
  ];

  return (
    <nav className="bottom-nav">
      {items.map(item => (
        <Link
          key={item.path}
          to={item.path}
          className={`nav-item ${path === item.path ? 'active' : ''}`}
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            {item.icon}
          </svg>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

function SharePage() {
  const { id } = useParams();
  const recipe = getRecipeById(id);
  const canvasRef = useRef(null);
  const [imageUrl, setImageUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const shareUrl = window.location.origin + '/recipe/' + id;

  useEffect(() => {
    if (!recipe || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const W = 600;
    const H = 800;
    canvas.width = W;
    canvas.height = H;

    const P = 32;
    const headerH = 260;
    const accentH = 4;
    const brandH = 44;
    const gapTop = 24;
    const maxStepsY = H - brandH;
    const stepsStartY = headerH + accentH + gapTop;
    const availableH = maxStepsY - stepsStartY;
    const imgSize = 212;
    const imgX = W - P - imgSize;
    const imgY = (headerH - imgSize) / 2;
    const leftX = P;
    const leftW = imgX - P - 24;
    const leftBarX = leftX;
    const leftBarW = 4;
    const leftContentX = leftBarX + leftBarW + 14;
    const leftContentW = leftW - leftBarW - 14;

    const allSteps = recipe.steps;

    const calcTotalHeight = (fs) => {
      const lh = Math.round(fs * 1.6);
      const gap = Math.round(fs * 0.6);
      const maxW = W - P * 2 - Math.round(fs * 1.8);
      ctx.font = `${fs}px "PingFang SC", "Microsoft YaHei", sans-serif`;
      let total = 0;
      for (const step of allSteps) {
        if (typeof step === 'string') {
          const lines = wrapText(ctx, step, maxW);
          const showLines = Math.min(lines.length, 2);
          total += showLines * lh + gap;
        } else if (step.section) {
          total += lh + gap;
        }
      }
      return total;
    };

    let fontSize = 20;
    const minFontSize = 10;
    while (fontSize > minFontSize && calcTotalHeight(fontSize) > availableH) {
      fontSize--;
    }

    const lh = Math.round(fontSize * 1.6);
    const stepGap = Math.round(fontSize * 0.6);
    const textMaxW = W - P * 2 - Math.round(fontSize * 1.8);
    const numOffsetX = Math.round(fontSize * 1.4);
    const textBaselineOff = Math.round(fontSize * 0.4);

    const rr = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    };

    const drawFrame = () => {
      ctx.fillStyle = '#FFFBF5';
      ctx.fillRect(0, 0, W, H);
    };

    const drawHeader = (img) => {
      ctx.fillStyle = '#C44D34';
      ctx.fillRect(leftBarX, imgY, leftBarW, imgSize);

      ctx.fillStyle = '#A09080';
      ctx.font = '11px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('食谱', leftContentX, imgY + 18);

      ctx.fillStyle = '#3D2B1F';
      const titleFontSize = 28;
      ctx.font = `bold ${titleFontSize}px "Noto Serif SC", "SimSun", "PingFang SC", serif`;
      const titleLines = wrapText(ctx, recipe.title, leftContentW);
      const titleLineH = 38;
      let ty = imgY + 50;
      for (let ti = 0; ti < Math.min(titleLines.length, 2); ti++) {
        ctx.fillText(titleLines[ti], leftContentX, ty);
        ty += titleLineH;
      }

      const tags = [recipe.category, recipe.flavorType, recipe.cookingMethod].filter(Boolean).filter(t => t !== '/');
      if (tags.length > 0) {
        const tagY = imgY + imgSize - 28;
        ctx.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif';
        let tx = leftContentX;
        for (const tag of tags) {
          const tw = ctx.measureText(tag).width + 16;
          ctx.fillStyle = '#C44D34';
          ctx.beginPath();
          rr(tx, tagY, tw, 24, 12);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(tag, tx + 8, tagY + 16);
          tx += tw + 8;
        }
      }

      ctx.save();
      rr(imgX, imgY, imgSize, imgSize, 14);
      ctx.clip();
      const scale = Math.max(imgSize / img.width, imgSize / img.height);
      const sw = img.width * scale;
      const sh = img.height * scale;
      const sx = imgX + (imgSize - sw) / 2;
      const sy = imgY + (imgSize - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh);
      ctx.restore();

      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      rr(imgX, imgY, imgSize, imgSize, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#C44D34';
      ctx.fillRect(0, headerH, W, accentH);
    };

    const drawStepsSection = () => {
      let y = stepsStartY;
      let stepNum = 0;
      const dotR = Math.max(3, Math.round(fontSize * 0.2));
      for (let i = 0; i < allSteps.length; i++) {
        const step = allSteps[i];
        if (step.section) {
          ctx.fillStyle = '#C44D34';
          ctx.beginPath();
          ctx.arc(P + dotR, y + textBaselineOff - dotR, dotR, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#C44D34';
          ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
          ctx.fillText(step.section, P + dotR * 3, y + textBaselineOff);
          y += lh + stepGap;
          if (y > maxStepsY) break;
          continue;
        }
        if (typeof step !== 'string') continue;
        stepNum++;
        ctx.fillStyle = '#C44D34';
        ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
        ctx.fillText(String(stepNum), P, y + textBaselineOff);

        ctx.fillStyle = '#4A3728';
        ctx.font = `${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
        const lines = wrapText(ctx, step, textMaxW);
        for (let li = 0; li < Math.min(lines.length, 2); li++) {
          if (y + lh > maxStepsY) break;
          ctx.fillText(lines[li], P + numOffsetX, y + textBaselineOff);
          y += lh;
        }
        y += stepGap;
        if (y > maxStepsY) break;
      }
    };

    const drawBranding = () => {
      ctx.fillStyle = '#EDE8E0';
      ctx.fillRect(0, H - brandH, W, 1);

      ctx.fillStyle = '#C44D34';
      ctx.font = 'bold 14px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('CookLikeHOC', P, H - 18);

      ctx.fillStyle = '#A09080';
      ctx.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('像老乡鸡那样做饭', P + 115, H - 18);

      ctx.fillStyle = '#A09080';
      ctx.font = '11px "PingFang SC", "Microsoft YaHei", sans-serif';
      const urlText = 'cook.zhouhao.cn';
      const urlW = ctx.measureText(urlText).width;
      ctx.fillText(urlText, W - P - urlW, H - 18);
    };

    drawFrame();

    const recipeImg = new Image();
    recipeImg.crossOrigin = 'anonymous';
    recipeImg.src = recipe.image;

    recipeImg.onload = () => {
      drawHeader(recipeImg);
      drawStepsSection();
      drawBranding();
      setImageUrl(canvas.toDataURL('image/jpeg', 0.92));
    };

    recipeImg.onerror = () => {
      ctx.fillStyle = '#EDE8E0';
      rr(imgX, imgY, imgSize, imgSize, 14);
      ctx.fill();
      ctx.fillStyle = '#8B7355';
      ctx.font = 'bold 14px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(recipe.title, imgX + imgSize / 2, imgY + imgSize / 2 + 6);
      ctx.textAlign = 'start';
      drawStepsSection();
      drawBranding();
      setImageUrl(canvas.toDataURL('image/jpeg', 0.92));
    };
  }, [recipe]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!recipe) {
    return (
      <div className="page not-found">
        <header className="app-header">
          <div className="header-content">
            <BackButton />
          </div>
        </header>
        <div className="not-found-content">
          <h2>未找到该菜谱</h2>
          <Link to="/" className="btn-primary">返回首页</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page share-page">
      <header className="app-header">
        <div className="header-content">
          <BackButton />
          <h1>分享菜谱</h1>
        </div>
      </header>

      <div className="share-content">
        <div className="share-card">
          {imageUrl ? (
            <img src={imageUrl} alt={recipe.title} className="share-image" />
          ) : (
            <div className="share-image-placeholder">
              <p>生成中...</p>
            </div>
          )}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        <p className="share-save-tip">长按图片保存到本地</p>

        <div className="share-url-box">
          <span className="share-url-text">{shareUrl}</span>
          <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
            {copied ? '已复制' : '复制链接'}
          </button>
        </div>
      </div>
    </div>
  );
}

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let current = '';
  for (const char of text) {
    const test = current + char;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = char;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/category/:id" element={<CategoryPage />} />
          <Route path="/recipe/:id" element={<RecipeDetailPage />} />
          <Route path="/share/:id" element={<SharePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/all" element={<AllRecipesPage />} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}

export default App;
