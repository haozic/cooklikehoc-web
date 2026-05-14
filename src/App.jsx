import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { getCategories, getRecipesByCategory, getRecipeById, searchRecipes, recipes, getFlavorTypes, getCookingMethods, getProcessingLevels, filterRecipes, getRandomRecipe } from './data/recipes';
import './App.css';

/* ---- Favorites helpers (localStorage) ---- */
function loadFavorites() {
  try { return JSON.parse(localStorage.getItem('cooklikehoc_favs') || '[]'); } catch { return []; }
}
function saveFavorites(ids) {
  localStorage.setItem('cooklikehoc_favs', JSON.stringify(ids));
}
const FavoritesContext = createContext();
function FavoritesProvider({ children }) {
  const [favs, setFavs] = useState(loadFavorites);
  const toggle = useCallback((id) => {
    setFavs(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      saveFavorites(next);
      return next;
    });
  }, []);
  return (
    <FavoritesContext.Provider value={{ favs, toggle }}>
      {children}
    </FavoritesContext.Provider>
  );
}
function useFavorites() {
  return useContext(FavoritesContext);
}

/* ---- Daily random 炒菜 (seeded by date) ---- */
function getDailyStirFry(count = 5) {
  const fried = recipes.filter(r => r.categoryDir === '炒菜' && r.steps && r.steps.length > 0);
  // Use local date (not UTC) so the day rolls at midnight local time
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const seed = [...dateStr].reduce((a, c) => a + c.charCodeAt(0), 0);
  // Seeded PRNG — state evolves each call
  let state = seed;
  function next() {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  }
  const arr = [...fried];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

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
      <ChevronLeftIcon />
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
    return (
      <div className={className} style={{ background: 'var(--cream-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--gray-400)' }}>
        {alt || '暂无图片'}
      </div>
    );
  }
  return <img className={className} src={src} alt={alt} loading="lazy" onError={() => setError(true)} />;
}

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
);

const ChevronLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="m15 18-6-6 6-6"/>
  </svg>
);

function Home() {
  const categories = getCategories();
  const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dailyRecipes = useMemo(() => getDailyStirFry(5), [todayStr]);
  const randomRecipe = useMemo(() => getRandomRecipe(), []);
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerRef = useRef(null);
  const totalBanners = dailyRecipes.length;

  const scrollToBanner = useCallback((index) => {
    if (bannerRef.current) {
      const cardWidth = bannerRef.current.children[0]?.offsetWidth || 0;
      const gap = 16;
      bannerRef.current.scrollTo({ left: index * (cardWidth + gap), behavior: 'smooth' });
    }
    setBannerIndex(index);
  }, []);

  useEffect(() => {
    if (totalBanners === 0) return;
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
        <h1 className="hero-title">老乡鸡菜谱</h1>
        <p className="hero-subtitle">源自老乡鸡菜品溯源报告 · 174 道家常菜谱</p>
      </div>

      <section className="section banner-section">
        <div className="section-header">
          <h2 className="section-title">今天尝尝这些菜</h2>
        </div>
        <div className="banner-container">
          <div className="banner-track" ref={bannerRef} onScroll={handleBannerScroll}>
            {dailyRecipes.map(recipe => (
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
            {dailyRecipes.map((_, i) => (
              <button
                key={i}
                className={`banner-dot ${i === bannerIndex ? 'active' : ''}`}
                onClick={() => scrollToBanner(i)}
              />
            ))}
          </div>
        </div>
      </section>

      <div className="home-random-area">
        <p className="suggest-random-text">不知道今天吃什么？来碰一下手气</p>
        <Link to={`/recipe/${randomRecipe.id}`} className="random-btn" aria-label="随机推荐菜谱">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 4l3 3-3 3"/>
            <path d="M3 20v-4a4 4 0 014-4h10"/>
            <path d="M6 20l-3-3 3-3"/>
            <path d="M21 4v4a4 4 0 01-4 4H7"/>
          </svg>
          碰一下
        </Link>
      </div>

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
                {recipe.ingredients.length > 0
                  ? recipe.ingredients.slice(0, 4).join('、') + (recipe.ingredients.length > 4 ? '...' : '')
                  : '暂无食材信息'}
              </p>
            </div>
            <div className="recipe-row-arrow"><ArrowIcon /></div>
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
  const { favs, toggle } = useFavorites();
  const isFav = recipe ? favs.includes(recipe.id) : false;

  if (!recipe) {
    return (
      <div className="page not-found">
        <header className="app-header">
          <div className="header-content">
            <Link to="/" className="back-btn">
              <ChevronLeftIcon />
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

        {recipe.nutrition && Object.keys(recipe.nutrition).length > 0 && (
          <section className="recipe-section">
            <h3 className="recipe-section-title">营养成分（每100g）</h3>
            <div className="nutrition-grid">
              {Object.entries(recipe.nutrition)
                .filter(([key]) => !key.startsWith('钠'))
                .map(([key, value]) => {
                const match = key.match(/^(.+?)\((.+?)\)$/);
                const label = match ? match[1] : key;
                const unit = match ? match[2] : '';
                return (
                  <div key={key} className="nutrition-card">
                    <span className="nutrition-value">
                      {Number.isInteger(value) ? value : Number(value).toFixed(1)}
                    </span>
                    <span className="nutrition-unit">{unit}</span>
                    <span className="nutrition-label">{label}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="recipe-section">
          <h3 className="recipe-section-title">食材</h3>
          {recipe.ingredients.length > 0 ? (
            <ul className="ingredients-list">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="ingredient-item">
                  <span className="ingredient-dot" />
                  <span>{ing}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: 14, color: 'var(--gray-400)' }}>暂无食材信息</p>
          )}
        </section>

        {recipe.steps.length > 0 ? (
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
        ) : (
          <section className="recipe-section">
            <h3 className="recipe-section-title">做法</h3>
            <p style={{ fontSize: 14, color: 'var(--gray-400)' }}>暂无做法步骤</p>
          </section>
        )}

        <div className="fav-btn-area">
          <button
            className={`fav-btn ${isFav ? 'active' : ''}`}
            onClick={() => toggle(recipe.id)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            {isFav ? '已收藏' : '添加到收藏夹'}
          </button>
        </div>

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

function FavoritesPage() {
  const { favs } = useFavorites();
  const favRecipes = favs.map(id => getRecipeById(id)).filter(Boolean);

  return (
    <div className="page favorites-page">
      <header className="app-header">
        <div className="header-content">
          <BackButton />
          <h1>收藏夹</h1>
        </div>
      </header>

      {favRecipes.length === 0 ? (
        <div className="empty-state" style={{ padding: '60px 16px' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--gray-300)" strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 16 }}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <p style={{ fontSize: 15, color: 'var(--gray-600)', marginBottom: 8 }}>收藏夹是空的</p>
          <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>在菜谱详情页点击收藏按钮添加</p>
        </div>
      ) : (
        <div className="category-recipe-list" style={{ paddingTop: 12 }}>
          {favRecipes.map(recipe => (
            <div key={recipe.id} className="recipe-row-wrapper">
              <Link to={`/recipe/${recipe.id}`} className="recipe-row">
                <div className="recipe-row-img">
                  <RecipeImage src={recipe.image} alt={recipe.title} />
                </div>
                <div className="recipe-row-info">
                  <h4>{recipe.title}</h4>
                  <div className="recipe-row-tags">
                    <span className="meta-tag">{recipe.category}</span>
                    {recipe.flavorType && <span className="meta-tag flavor">{recipe.flavorType}</span>}
                  </div>
                </div>
                <div className="recipe-row-arrow"><ArrowIcon /></div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AllRecipesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeFlavor, setActiveFlavor] = useState('');
  const [activeMethod, setActiveMethod] = useState('');
  const [activeLevel, setActiveLevel] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const inputRef = useRef(null);

  const categories = getCategories();
  const flavorTypes = getFlavorTypes();
  const cookingMethods = getCookingMethods();
  const processingLevels = getProcessingLevels();

  const filteredRecipes = useMemo(() => {
    if (searchQuery.trim()) {
      return searchRecipes(searchQuery.trim());
    }
    return filterRecipes({
      category: activeCategory,
      flavorType: activeFlavor || undefined,
      cookingMethod: activeMethod || undefined,
      processingLevel: activeLevel || undefined,
    });
  }, [searchQuery, activeCategory, activeFlavor, activeMethod, activeLevel]);

  const hasActiveFilters = activeFlavor || activeMethod || activeLevel;
  const isSearching = searchQuery.trim() !== '';

  return (
    <div className="page all-recipes-page">
      <header className="app-header">
        <div className="header-content">
          <BackButton />
          <h1>全部菜谱</h1>
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
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => { setSearchQuery(''); inputRef.current?.focus(); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>
      </div>

      {isSearching ? (
        <>
          <div className="search-info">找到 {filteredRecipes.length} 个结果</div>
          {filteredRecipes.length > 0 ? (
            <div className="category-recipe-list">
              {filteredRecipes.map(recipe => (
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
                      {recipe.ingredients.length > 0
                        ? recipe.ingredients.slice(0, 4).join('、') + (recipe.ingredients.length > 4 ? '...' : '')
                        : '暂无食材信息'}
                    </p>
                  </div>
                  <div className="recipe-row-arrow"><ArrowIcon /></div>
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
        <>
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
        </>
      )}
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
      path: '/favorites',
      label: '收藏',
      icon: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>,
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
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
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
    const imgSize = 240;
    const imgX = W - P - imgSize;
    const imgY = (headerH - imgSize) / 2;
    const infoX = P;
    const infoW = imgX - P - 16;

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
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#FFFBF5');
      bg.addColorStop(1, '#F8F2E8');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
    };

    const drawHeader = (img) => {
      ctx.save();
      rr(imgX, imgY, imgSize, imgSize, 16);
      ctx.clip();
      const scale = Math.max(imgSize / img.width, imgSize / img.height);
      const sw = img.width * scale;
      const sh = img.height * scale;
      const sx = imgX + (imgSize - sw) / 2;
      const sy = imgY + (imgSize - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh);
      ctx.restore();

      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      rr(imgX, imgY, imgSize, imgSize, 16);
      ctx.fill();
      ctx.stroke();

      const titleFontSize = 32;
      ctx.font = `bold ${titleFontSize}px "Noto Serif SC", "SimSun", "PingFang SC", serif`;
      const titleLines = wrapText(ctx, recipe.title, infoW);
      const actualTitleLines = Math.min(titleLines.length, 2);
      const titleLineH = 40;
      const labelH = 16;
      const tagsH = 26;
      const infoBlockH = labelH + 4 + actualTitleLines * titleLineH + 10 + tagsH;
      const infoTop = imgY + (imgSize - infoBlockH) / 2;

      ctx.fillStyle = '#A09080';
      ctx.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('食谱', infoX, infoTop + 12);

      ctx.fillStyle = '#3D2B1F';
      ctx.font = `bold ${titleFontSize}px "Noto Serif SC", "SimSun", "PingFang SC", serif`;
      let ty = infoTop + labelH + 4 + titleLineH - 10;
      for (let ti = 0; ti < actualTitleLines; ti++) {
        ctx.fillText(titleLines[ti], infoX, ty);
        ty += titleLineH;
      }

      const tags = [recipe.category, recipe.flavorType, recipe.cookingMethod].filter(Boolean).filter(t => t !== '/');
      if (tags.length > 0) {
        const tagY = infoTop + infoBlockH - tagsH;
        ctx.font = '13px "PingFang SC", "Microsoft YaHei", sans-serif';
        let tx = infoX;
        for (const tag of tags) {
          const tw = ctx.measureText(tag).width + 18;
          ctx.fillStyle = '#C44D34';
          ctx.beginPath();
          rr(tx, tagY, tw, tagsH, tagsH / 2);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(tag, tx + 9, tagY + 18);
          tx += tw + 8;
        }
      }

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
      ctx.fillText('老乡鸡菜谱', P + 115, H - 18);

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
      <FavoritesProvider>
        <ScrollToTop />
        <div className="app">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/category/:id" element={<CategoryPage />} />
            <Route path="/recipe/:id" element={<RecipeDetailPage />} />
            <Route path="/share/:id" element={<SharePage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/all" element={<AllRecipesPage />} />
          </Routes>
          <BottomNav />
        </div>
      </FavoritesProvider>
    </BrowserRouter>
  );
}

export default App;
