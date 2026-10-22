import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  LockKeyhole,
  LogOut,
  Menu,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from './icons.jsx';
import './styles.css';

const typeNames = {
  book: 'كتب',
  newspaper: 'جرائد',
  magazine: 'مجلات',
  manuscript: 'مخطوطات',
  rare: 'كتب قديمة ونادرة',
  other: 'أخرى',
};
const conditionNames = { new: 'جديد', excellent: 'ممتازة', good: 'جيدة', fair: 'مقبولة' };
const statusNames = {
  pending: 'قيد المراجعة',
  approved: 'منشور',
  rejected: 'مرفوض',
  new: 'جديد',
  confirmed: 'مؤكد',
  shipped: 'تم الشحن',
  delivered: 'تم التوصيل',
  cancelled: 'ملغي',
};
const roleNames = { customer: 'قارئ', seller: 'بائع', admin: 'مالك المتجر' };
const categories = [
  { type: 'book', label: 'كتب', icon: '📚', color: 'sage' },
  { type: 'rare', label: 'كتب قديمة ونادرة', icon: '✦', color: 'peach' },
  { type: 'manuscript', label: 'مخطوطات', icon: '✒', color: 'sand' },
  { type: 'magazine', label: 'مجلات', icon: '▤', color: 'lavender' },
  { type: 'newspaper', label: 'جرائد', icon: '▧', color: 'blue' },
  { type: 'other', label: 'وغيرها', icon: '◈', color: 'pink' },
];
const money = (value) => `${Number(value || 0).toLocaleString('ar-EG')} ج.م`;
function ordersByStore(orders) {
  const groups = new Map();
  for (const order of orders) {
    const groupedItems = new Map();
    for (const item of order.items) {
      if (!groupedItems.has(item.seller_id)) groupedItems.set(item.seller_id, []);
      groupedItems.get(item.seller_id).push(item);
    }
    for (const [sellerId, items] of groupedItems) {
      if (!groups.has(sellerId))
        groups.set(sellerId, { sellerId, sellerName: items[0].seller_name, orders: [] });
      groups.get(sellerId).orders.push({
        ...order,
        items,
        total: items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
      });
    }
  }
  return [...groups.values()];
}
const asset = (url) => (url?.startsWith('/uploads/') ? url : url);
const stored = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};

async function api(path, options = {}, token) {
  const isForm = options.body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'حدث خطأ، حاول مرة أخرى');
  return data;
}

function Cover({ item, large = false }) {
  const variant = (Number(item.id || item.title?.length || 1) % 6) + 1;
  return (
    <div
      className={`cover cover-${variant}${large ? ' cover-large' : ''}${item.image_url ? ' cover-photo' : ''}`}
    >
      {item.image_url ? (
        <img src={asset(item.image_url)} alt={item.title} />
      ) : (
        <div className={`cover-art${item.title?.length > 28 ? ' cover-art-long' : ''}`}>
          <span className="cover-ornament">✦</span>
          <span className="cover-type">{typeNames[item.item_type] || 'متجر علم'}</span>
          <strong>{item.title}</strong>
          <small>{item.author || 'من متجر علم'}</small>
          <span className="cover-line" />
        </div>
      )}
    </div>
  );
}

function BookCard({ item, onOpen, onAdd }) {
  return (
    <article className="book-card" onClick={() => onOpen(item.id)}>
      <div className="book-image">
        <Cover item={item} />
        <button
          className="quick-add"
          aria-label={`أضف ${item.title} للسلة`}
          onClick={(event) => {
            event.stopPropagation();
            onAdd(item);
          }}
        >
          <Plus size={18} />
        </button>
      </div>
      <div className="book-meta">
        <span>{typeNames[item.item_type]}</span>
        <span className="dot">•</span>
        <span>{conditionNames[item.item_condition]}</span>
      </div>
      <h3 title={item.title}>{item.title}</h3>
      <p>{item.author || item.seller_name}</p>
      <div className="book-bottom">
        <strong>{money(item.price)}</strong>
        <span>
          عرض التفاصيل <ArrowLeft size={15} />
        </span>
      </div>
    </article>
  );
}

function Empty({ title, text, action, onAction }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <BookOpen size={32} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="button button-dark" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}
function Alert({ text, onClose }) {
  return text ? (
    <div className="toast">
      <Check size={17} />
      {text}
      <button onClick={onClose} aria-label="إغلاق">
        <X size={16} />
      </button>
    </div>
  ) : null;
}

function App() {
  const parseRoute = () => {
    const [page, id] = location.hash.slice(1).split('/');
    return { page: page || 'home', id: id || null };
  };
  const [route, setRoute] = useState(parseRoute);
  const [user, setUser] = useState(stored('warraq-user', null));
  const [token, setToken] = useState(localStorage.getItem('warraq-token') || '');
  const [cart, setCart] = useState(stored('warraq-cart', []));
  const cartRef = useRef(cart);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [sort, setSort] = useState('newest');
  const [selected, setSelected] = useState(null);
  const [sellerItems, setSellerItems] = useState([]);
  const [reviewItems, setReviewItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [sellerOrders, setSellerOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [reviewFilter, setReviewFilter] = useState('all');
  const [authMode, setAuthMode] = useState('login');
  const cartCount = cart.reduce((sum, entry) => sum + entry.quantity, 0);
  const cartTotal = cart.reduce((sum, entry) => sum + entry.price * entry.quantity, 0);
  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 5000);
  };

  function go(page, id = null) {
    location.hash = `${page}${id ? `/${id}` : ''}`;
    setRoute({ page, id });
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  useEffect(() => {
    const listener = () => setRoute(parseRoute());
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, []);
  useEffect(() => {
    if (route.page === 'auctions') go('catalog');
  }, [route.page]);
  useEffect(() => {
    cartRef.current = cart;
    localStorage.setItem('warraq-cart', JSON.stringify(cart));
  }, [cart]);
  useEffect(() => {
    if (!token) return;
    api('/auth/me', {}, token)
      .then(({ user }) => {
        setUser(user);
        localStorage.setItem('warraq-user', JSON.stringify(user));
      })
      .catch(() => {
        setUser(null);
        setToken('');
        localStorage.removeItem('warraq-token');
        localStorage.removeItem('warraq-user');
      });
  }, [token]);
  useEffect(() => {
    if (!['home', 'catalog'].includes(route.page)) return;
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({
      page: String(route.page === 'home' ? 1 : pageNumber),
      sort,
    });
    if (route.page === 'catalog' && query) params.set('q', query);
    if (route.page === 'catalog' && type) params.set('type', type);
    api(`/listings?${params}`)
      .then((data) => {
        if (active) {
          setItems(data.items);
          setTotal(data.total);
          setPages(data.pages);
        }
      })
      .catch((error) => notify(error.message))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [route.page, query, type, sort, pageNumber]);
  useEffect(() => {
    if (route.page !== 'product' || !route.id) return;
    setSelected(null);
    api(`/listings/${route.id}`)
      .then((data) => {
        setSelected(data.item);
      })
      .catch((error) => notify(error.message));
  }, [route.page, route.id]);
  useEffect(() => {
    if (!token) return;
    if (route.page === 'seller' && ['seller', 'admin'].includes(user?.role)) refreshSeller();
    if (route.page === 'admin' && user?.role === 'admin') refreshAdmin();
    if (route.page === 'orders')
      api('/orders/mine', {}, token)
        .then((data) => setOrders(data.items))
        .catch((error) => notify(error.message));
  }, [route.page, token, user?.role]);
  useEffect(() => {
    if (route.page !== 'seller' || !token || !['seller', 'admin'].includes(user?.role)) return;
    const timer = window.setInterval(refreshSeller, 15000);
    return () => window.clearInterval(timer);
  }, [route.page, token, user?.role]);

  function replaceCart(next) {
    cartRef.current = next;
    setCart(next);
  }
  function refreshSeller() {
    api('/seller/listings', {}, token)
      .then((data) => setSellerItems(data.items))
      .catch((error) => notify(error.message));
    api('/seller/orders', {}, token)
      .then((data) => setSellerOrders(data.items))
      .catch((error) => notify(error.message));
  }
  function refreshAdmin() {
    api('/admin/listings', {}, token)
      .then((data) => setReviewItems(data.items))
      .catch((error) => notify(error.message));
    api('/admin/orders', {}, token)
      .then((data) => setOrders(data.items))
      .catch((error) => notify(error.message));
  }
  function addToCart(item) {
    const available = Number(item.quantity ?? item.stock ?? 0);
    const previous = cartRef.current;
    const found = previous.find((entry) => entry.id === item.id);
    if (available < 1 || (found && found.quantity >= available)) {
      notify(`الكمية المتاحة من «${item.title}» هي ${Math.max(available, 0)} فقط`);
      return;
    }
    replaceCart(
      found
        ? previous.map((entry) =>
            entry.id === item.id
              ? { ...entry, quantity: entry.quantity + 1, stock: available }
              : entry,
          )
        : [
            ...previous,
            {
              id: item.id,
              title: item.title,
              author: item.author,
              item_type: item.item_type,
              price: item.price,
              image_url: item.image_url,
              quantity: 1,
              stock: available,
            },
          ],
    );
    notify('تمت الإضافة إلى السلة');
  }
  function updateCart(id, delta) {
    const previous = cartRef.current;
    const entry = previous.find((item) => item.id === id);
    if (!entry) return;
    if (delta > 0 && entry.quantity >= entry.stock) {
      notify(`الكمية المتاحة من «${entry.title}» هي ${entry.stock} فقط`);
      return;
    }
    replaceCart(
      previous.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item,
      ),
    );
  }
  function logout() {
    setUser(null);
    setToken('');
    localStorage.removeItem('warraq-user');
    localStorage.removeItem('warraq-token');
    go('home');
  }
  async function becomeSeller() {
    try {
      const data = await api('/auth/become-seller', { method: 'POST' }, token);
      setUser(data.user);
      localStorage.setItem('warraq-user', JSON.stringify(data.user));
      notify('تم تفعيل حساب البائع');
    } catch (error) {
      notify(error.message);
    }
  }
  function openCatalog(nextType = '') {
    setType(nextType);
    setPageNumber(1);
    go('catalog');
  }

  return (
    <>
      <div className="top-strip">
        <span>✦</span> كتب العلم والتراث بين يديك <span>✦</span>
      </div>
      <header className="site-header">
        <div className="container header-inner">
          <button className="logo" onClick={() => go('home')} aria-label="الصفحة الرئيسية">
            <img className="logo-mark" src="/ilm-logo-green.jpeg" alt="" />
            <span>
              <strong>متجر علم</strong>
              <small>سوق كتب العلم والتراث</small>
            </span>
          </button>
          <nav className={menuOpen ? 'nav open' : 'nav'}>
            <button className={route.page === 'home' ? 'active' : ''} onClick={() => go('home')}>
              الرئيسية
            </button>
            <button
              className={route.page === 'catalog' ? 'active' : ''}
              onClick={() => openCatalog()}
            >
              تصفح المعروضات
            </button>
            <button
              onClick={() => {
                setAuthMode('register');
                go(user ? 'seller' : 'auth');
              }}
            >
              اعرض كتبك
            </button>
            {user && <button onClick={() => go('orders')}>طلباتي</button>}
            {user && (
              <button
                className={route.page === 'profile' ? 'active' : ''}
                onClick={() => go('profile')}
              >
                حسابي
              </button>
            )}
            {(user?.role === 'seller' || user?.role === 'admin') && (
              <button onClick={() => go('seller')}>متجري</button>
            )}
            {user?.role === 'admin' && <button onClick={() => go('admin')}>الإدارة</button>}
          </nav>
          <div className="header-actions">
            {user ? (
              <button
                className="account account-user"
                onClick={() => go('profile')}
                aria-label="حسابي"
              >
                <span className="account-avatar">{user.name?.trim()?.[0] || 'ع'}</span>
                <span className="account-label">
                  حسابي <small>{user.name.split(' ')[0]}</small>
                </span>
              </button>
            ) : (
              <button
                className="account"
                onClick={() => {
                  setAuthMode('login');
                  go('auth');
                }}
              >
                <UserRound size={19} />
                <span>دخول / حساب جديد</span>
              </button>
            )}
            <button
              className="cart-button"
              onClick={() => go('cart')}
              aria-label={`السلة، ${cartCount} عناصر`}
            >
              <ShoppingBag size={21} />
              {cartCount > 0 && <em>{cartCount}</em>}
            </button>
            <button
              className="menu-button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="القائمة"
            >
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>

      <main>
        {route.page === 'home' && (
          <>
            <section className="hero">
              <div className="container hero-grid">
                <div className="hero-copy">
                  <div className="eyebrow">
                    <span className="line" /> مكتبة للعلم والتراث
                  </div>
                  <h1>
                    علمٌ يُقرأ
                    <br />
                    <em>وتراثٌ يُقتنى.</em>
                  </h1>
                  <p>
                    اكتشف كتب العلم والمراجع المتخصصة، واقتنِ طبعات التراث والمخطوطات والنوادر من
                    مكتبات وبائعين مختلفين.
                  </p>
                  <div className="hero-actions">
                    <button className="button button-dark" onClick={() => openCatalog()}>
                      تصفّح الكتب والمقتنيات <ArrowLeft size={18} />
                    </button>
                    <button
                      className="text-link"
                      onClick={() => {
                        setAuthMode('register');
                        go(user ? 'seller' : 'auth');
                      }}
                    >
                      لديك كتب أو مخطوطات؟ <ArrowLeft size={16} />
                    </button>
                  </div>
                  <div className="hero-note">
                    <div className="avatar-stack">
                      <span>ع</span>
                      <span>ن</span>
                      <span>م</span>
                    </div>
                    <span>
                      يلتقي الباحثون والقرّاء والبائعون
                      <br />
                      <strong>على حب العلم والتراث</strong>
                    </span>
                  </div>
                </div>
                <div className="hero-visual" aria-hidden="true">
                  <div className="hero-arch" />
                  <div className="hero-sun" />
                  <div className="hero-book hero-book-back">
                    <span>التراث العربي</span>
                    <strong>
                      كنوز
                      <br />
                      التراث
                    </strong>
                    <small>متجر علم</small>
                  </div>
                  <div className="hero-book hero-book-front">
                    <span>متجر علم</span>
                    <strong>
                      أصول
                      <br />
                      العلم
                      <br />
                      والتراث
                    </strong>
                    <small>معرفة تستحق الحفظ</small>
                  </div>
                  <div className="hero-spark one">✦</div>
                  <div className="hero-spark two">✧</div>
                  <div className="hero-badge">
                    <Sparkles size={18} /> نوادر تستحق الاكتشاف
                  </div>
                </div>
              </div>
            </section>
            <section className="promise-bar">
              <div className="container promise-inner">
                <div>
                  <span>✦</span> كتب ومراجع لمختلف الاهتمامات
                </div>
                <div>
                  <span>✦</span> معروضات يراجعها فريقنا
                </div>
                <div>
                  <span>✦</span> بائعون ومقتنون للكتب التراثية
                </div>
              </div>
            </section>
            <section className="section container">
              <div className="section-heading">
                <div>
                  <span className="mini-title">من أين تبدأ؟</span>
                  <h2>تصفّح حسب اهتمامك</h2>
                  <p>من المراجع العلمية وكتب اللغة والتاريخ إلى المخطوطات والطبعات النادرة.</p>
                </div>
                <button className="subtle-link" onClick={() => openCatalog()}>
                  كل المعروضات <ArrowLeft size={17} />
                </button>
              </div>
              <div className="category-grid">
                {categories.map((category) => (
                  <button
                    key={category.type}
                    className={`category ${category.color}`}
                    onClick={() => openCatalog(category.type)}
                  >
                    <span className="category-icon">{category.icon}</span>
                    <strong>{category.label}</strong>
                    <ArrowLeft size={17} />
                  </button>
                ))}
              </div>
            </section>
            <section className="section section-featured">
              <div className="container">
                <div className="section-heading">
                  <div>
                    <span className="mini-title">اختيرت لك</span>
                    <h2>إضافات جديدة للمكتبة</h2>
                    <p>تعرّف على أحدث كتب العلم والتراث والمقتنيات التي أضافها البائعون.</p>
                  </div>
                  <button className="subtle-link" onClick={() => openCatalog()}>
                    عرض الكل <ArrowLeft size={17} />
                  </button>
                </div>
                {loading ? (
                  <div className="loading">جارٍ تحميل الكتب...</div>
                ) : items.length ? (
                  <div className="books-grid">
                    {items.slice(0, 8).map((item) => (
                      <BookCard
                        key={item.id}
                        item={item}
                        onOpen={(id) => go('product', id)}
                        onAdd={addToCart}
                      />
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="المكتبة تنتظر أول كتاب"
                    text="أضف كتاباً أو مخطوطة من لوحة البائع ليظهر المعروض بعد المراجعة."
                    action="اعرض كتاباً"
                    onAction={() => {
                      setAuthMode('register');
                      go(user ? 'seller' : 'auth');
                    }}
                  />
                )}
              </div>
            </section>
            <section className="seller-banner container">
              <div className="seller-banner-icon">
                <BookOpen size={39} strokeWidth={1.5} />
              </div>
              <div>
                <span className="mini-title">شارك ما في مكتبتك</span>
                <h2>كتبك العلمية والتراثية تستحق قارئاً جديداً.</h2>
                <p>افتح حساب بائع، وأضف كتبك ومخطوطاتك وصورها لنراجعها قبل نشرها.</p>
              </div>
              <button
                className="button button-light"
                onClick={() => {
                  setAuthMode('register');
                  go(user ? 'seller' : 'auth');
                }}
              >
                ابدأ البيع الآن <ArrowLeft size={18} />
              </button>
            </section>
          </>
        )}

        {route.page === 'catalog' && (
          <section className="container page-section">
            <div className="page-title">
              <span className="mini-title">مكتبة العلم والتراث</span>
              <h1>تصفّح الكتب والمقتنيات</h1>
              <p>كتب علم وتراث، مخطوطات، مجلات وصحف من مكتبات مختلفة.</p>
            </div>
            <div className="catalog-layout">
              <aside className="filters">
                <div className="filter-title">
                  <SlidersHorizontal size={18} />
                  <strong>تصفية النتائج</strong>
                </div>
                <label>بحث عن كتاب أو مؤلف</label>
                <div className="field-icon">
                  <Search size={18} />
                  <input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPageNumber(1);
                    }}
                    placeholder="ماذا تبحث عنه؟"
                  />
                </div>
                <label>النوع</label>
                <div className="filter-options">
                  <button
                    className={!type ? 'selected' : ''}
                    onClick={() => {
                      setType('');
                      setPageNumber(1);
                    }}
                  >
                    كل المعروضات
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.type}
                      className={type === category.type ? 'selected' : ''}
                      onClick={() => {
                        setType(category.type);
                        setPageNumber(1);
                      }}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>
              </aside>
              <div className="catalog-results">
                <div className="results-toolbar">
                  <strong>{total.toLocaleString('ar-EG')} معروض</strong>
                  <label>
                    ترتيب حسب{' '}
                    <select value={sort} onChange={(e) => setSort(e.target.value)}>
                      <option value="newest">الأحدث</option>
                      <option value="price_asc">السعر: الأقل أولاً</option>
                      <option value="price_desc">السعر: الأعلى أولاً</option>
                    </select>
                    <ChevronDown size={15} />
                  </label>
                </div>
                {loading ? (
                  <div className="loading">جارٍ تحميل المعروضات...</div>
                ) : items.length ? (
                  <>
                    <div className="books-grid catalog-grid">
                      {items.map((item) => (
                        <BookCard
                          key={item.id}
                          item={item}
                          onOpen={(id) => go('product', id)}
                          onAdd={addToCart}
                        />
                      ))}
                    </div>
                    <div className="pagination">
                      <button
                        disabled={pageNumber <= 1}
                        onClick={() => setPageNumber(pageNumber - 1)}
                      >
                        السابق
                      </button>
                      <span>
                        صفحة {pageNumber} من {pages}
                      </span>
                      <button
                        disabled={pageNumber >= pages}
                        onClick={() => setPageNumber(pageNumber + 1)}
                      >
                        التالي
                      </button>
                    </div>
                  </>
                ) : (
                  <Empty
                    title="لا توجد معروضات مطابقة"
                    text="جرّب كلمة بحث أو نوعاً آخر."
                    action="مسح التصفية"
                    onAction={() => {
                      setQuery('');
                      setType('');
                    }}
                  />
                )}
              </div>
            </div>
          </section>
        )}

        {route.page === 'product' && (
          <section className="container page-section">
            {selected ? (
              <>
                <div className="breadcrumb">
                  <button onClick={() => go('home')}>الرئيسية</button>
                  <span>/</span>
                  <button onClick={() => openCatalog()}>المعروضات</button>
                  <span>/</span>
                  {selected.title}
                </div>
                <div className="product-layout">
                  <div className="product-cover">
                    <Cover item={selected} large />
                  </div>
                  <div className="product-info">
                    <span className="pill">{typeNames[selected.item_type]}</span>
                    <h1>{selected.title}</h1>
                    <p className="product-author">{selected.author || 'من مقتنيات البائع'}</p>
                    <div className="product-price">{money(selected.price)}</div>
                    <div className="product-facts">
                      <div>
                        <span>الحالة</span>
                        <strong>{conditionNames[selected.item_condition]}</strong>
                      </div>
                      <div>
                        <span>سنة النشر</span>
                        <strong>{selected.publication_year || 'غير محددة'}</strong>
                      </div>
                      <div>
                        <span>البائع</span>
                        <strong>{selected.seller_name}</strong>
                      </div>
                      <div>
                        <span>المتاح</span>
                        <strong>{selected.quantity.toLocaleString('ar-EG')} نسخة</strong>
                      </div>
                    </div>
                    <button
                      className="button button-dark add-wide"
                      onClick={() => addToCart(selected)}
                    >
                      <ShoppingBag size={20} /> أضف إلى السلة
                    </button>
                    <div className="product-description">
                      <h3>عن هذا المعروض</h3>
                      <p>
                        {selected.description ||
                          'كتاب أو مقتنى معروض في متجر علم. أتمّ الطلب لمعرفة تفاصيل التوصيل.'}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="loading">جارٍ تحميل المعروض...</div>
            )}
          </section>
        )}

        {route.page === 'auth' && (
          <section className="auth-page">
            <div className="auth-aside">
              <span className="auth-ornament">✦</span>
              <h2>
                علم ينتقل
                <br />
                من جيل إلى جيل.
              </h2>
              <p>انضم إلى متجر علم لتكتشف المراجع والنوادر، أو تعرض ما في مكتبتك لمن يبحث عنه.</p>
              <div className="auth-quote">الكتب تحفظ العلم، والقراءة تجدّده.</div>
            </div>
            <div className="auth-panel">
              <div className="auth-tabs">
                <button
                  className={authMode === 'login' ? 'selected' : ''}
                  onClick={() => setAuthMode('login')}
                >
                  تسجيل الدخول
                </button>
                <button
                  className={authMode === 'register' ? 'selected' : ''}
                  onClick={() => setAuthMode('register')}
                >
                  حساب جديد
                </button>
              </div>
              <h1>{authMode === 'login' ? 'أهلاً بعودتك' : 'أهلاً بك في متجر علم'}</h1>
              <p>
                {authMode === 'login'
                  ? 'سجّل دخولك لتتابع كتبك ومقتنياتك.'
                  : 'أنشئ حسابك لتشتري أو تعرض مقتنياتك.'}
              </p>
              <AuthForm
                mode={authMode}
                onSubmit={async (values) => {
                  const data = await api(`/auth/${authMode}`, {
                    method: 'POST',
                    body: JSON.stringify(values),
                  });
                  setUser(data.user);
                  setToken(data.token);
                  localStorage.setItem('warraq-user', JSON.stringify(data.user));
                  localStorage.setItem('warraq-token', data.token);
                  notify(`أهلاً ${data.user.name}`);
                  go(data.user.role === 'seller' ? 'seller' : 'home');
                }}
              />
            </div>
          </section>
        )}

        {route.page === 'profile' &&
          (user ? (
            <ProfilePage
              user={user}
              token={token}
              onUpdated={(updatedUser) => {
                setUser(updatedUser);
                localStorage.setItem('warraq-user', JSON.stringify(updatedUser));
                notify('تم حفظ بيانات حسابك');
              }}
              onPasswordChanged={() => notify('تم تغيير كلمة المرور بنجاح')}
              onNavigate={go}
              onLogout={logout}
            />
          ) : (
            <section className="container page-section">
              <Empty
                title="سجّل الدخول لعرض حسابك"
                text="يمكنك تحديث بياناتك وعناوين التوصيل من ملفك الشخصي."
                action="تسجيل الدخول"
                onAction={() => go('auth')}
              />
            </section>
          ))}

        {route.page === 'cart' && (
          <section className="container page-section">
            <div className="page-title">
              <span className="mini-title">مقتنياتك المختارة</span>
              <h1>سلة المشتريات</h1>
              <p>
                {cartCount
                  ? `لديك ${cartCount.toLocaleString('ar-EG')} عناصر بانتظارك`
                  : 'ابدأ باختيار ما يعجبك من السوق.'}
              </p>
            </div>
            {cart.length ? (
              <div className="cart-layout">
                <div className="cart-items">
                  {cart.map((entry) => (
                    <div className="cart-item" key={entry.id}>
                      <div className="cart-thumb" onClick={() => go('product', entry.id)}>
                        <Cover item={entry} />
                      </div>
                      <div className="cart-info">
                        <span>{typeNames[entry.item_type]}</span>
                        <h3 onClick={() => go('product', entry.id)}>{entry.title}</h3>
                        <p>{entry.author}</p>
                        <strong>{money(entry.price)}</strong>
                        <small>المتاح: {entry.stock} نسخة</small>
                      </div>
                      <div className="cart-controls">
                        <button
                          onClick={() =>
                            replaceCart(cartRef.current.filter((x) => x.id !== entry.id))
                          }
                          aria-label="حذف"
                        >
                          <Trash2 size={17} />
                        </button>
                        <div>
                          <button onClick={() => updateCart(entry.id, -1)} aria-label="تقليل">
                            <Minus size={15} />
                          </button>
                          <span>{entry.quantity}</span>
                          <button onClick={() => updateCart(entry.id, 1)} aria-label="زيادة">
                            <Plus size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <aside className="cart-summary">
                  <h3>ملخص الطلب</h3>
                  <div>
                    <span>المنتجات ({cartCount})</span>
                    <strong>{money(cartTotal)}</strong>
                  </div>
                  <div>
                    <span>التوصيل</span>
                    <span>يُحدد عند التأكيد</span>
                  </div>
                  <div className="summary-total">
                    <strong>الإجمالي</strong>
                    <strong>{money(cartTotal)}</strong>
                  </div>
                  <button
                    className="button button-dark"
                    onClick={() => go(user ? 'checkout' : 'auth')}
                  >
                    متابعة الطلب <ArrowLeft size={18} />
                  </button>
                  <small>الدفع عند الاستلام بعد تأكيد الطلب</small>
                </aside>
              </div>
            ) : (
              <Empty
                title="السلة فارغة الآن"
                text="تصفّح الرفوف وأضف ما يعجبك من الكتب والمقتنيات."
                action="تصفح المعروضات"
                onAction={() => openCatalog()}
              />
            )}
          </section>
        )}

        {route.page === 'checkout' && (
          <section className="container page-section">
            <div className="page-title">
              <span className="mini-title">خطوة أخيرة</span>
              <h1>تأكيد الطلب</h1>
              <p>
                أدخل بياناتك وسنتواصل معك لتأكيد التوصيل. يُسجّل طلب مستقل لكل متجر، والدفع عند
                الاستلام.
              </p>
            </div>
            {!user ? (
              <Empty
                title="سجّل الدخول أولاً"
                text="يلزم حساب لإتمام الطلب."
                action="تسجيل الدخول"
                onAction={() => go('auth')}
              />
            ) : cart.length ? (
              <div className="checkout-layout">
                <CheckoutForm
                  user={user}
                  onSubmit={async (values) => {
                    const data = await api(
                      '/orders',
                      {
                        method: 'POST',
                        body: JSON.stringify({
                          ...values,
                          items: cart.map((x) => ({ listing_id: x.id, quantity: x.quantity })),
                        }),
                      },
                      token,
                    );
                    replaceCart([]);
                    notify(
                      data.orders.length > 1
                        ? `تم تسجيل ${data.orders.length} طلبات منفصلة حسب المتجر`
                        : `تم تسجيل طلبك رقم #${data.order.id}`,
                    );
                    go('orders');
                  }}
                />
                <aside className="cart-summary">
                  <h3>طلبك</h3>
                  {cart.map((entry) => (
                    <div key={entry.id}>
                      <span>
                        {entry.title} × {entry.quantity}
                      </span>
                      <strong>{money(entry.price * entry.quantity)}</strong>
                    </div>
                  ))}
                  <div className="summary-total">
                    <strong>الإجمالي</strong>
                    <strong>{money(cartTotal)}</strong>
                  </div>
                </aside>
              </div>
            ) : (
              <Empty
                title="سلتك فارغة"
                text="اختر كتاباً أولاً."
                action="تصفح الكتب"
                onAction={() => openCatalog()}
              />
            )}
          </section>
        )}

        {route.page === 'orders' && (
          <section className="container page-section">
            <div className="page-title">
              <span className="mini-title">حسابي</span>
              <h1>طلباتي</h1>
              <p>تابع الكتب التي طلبتها.</p>
            </div>
            {!user ? (
              <Empty
                title="سجّل الدخول"
                text="اعرض طلباتك بعد تسجيل الدخول."
                action="تسجيل الدخول"
                onAction={() => go('auth')}
              />
            ) : orders.length ? (
              <div className="orders-list">
                {orders.map((order) => (
                  <div className="order-card" key={order.id}>
                    <div className="order-head">
                      <div>
                        <strong>
                          طلب #{order.id} · {order.items[0]?.seller_name || 'المتجر'}
                        </strong>
                        <span>{new Date(`${order.created_at}Z`).toLocaleDateString('ar-EG')}</span>
                      </div>
                      <span className={`status status-${order.status}`}>
                        {statusNames[order.status]}
                      </span>
                    </div>
                    <div className="order-lines">
                      {order.items.map((item) => (
                        <div key={item.id}>
                          <span>
                            {item.title} × {item.quantity}
                          </span>
                          <strong>{money(item.unit_price * item.quantity)}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="order-foot">
                      <span>
                        {order.city}، {order.address}
                      </span>
                      <strong>{money(order.total)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="لا توجد طلبات بعد"
                text="عندما تشتري كتاباً سيظهر طلبك هنا."
                action="تصفح الكتب"
                onAction={() => openCatalog()}
              />
            )}
          </section>
        )}

        {route.page === 'seller' && (
          <section className="container page-section">
            <div className="dashboard-title">
              <div>
                <span className="mini-title">مساحة البائع</span>
                <h1>متجري على متجر علم</h1>
                <p>أضف معروضاتك وتابع حالتها وطلبات المشترين.</p>
              </div>
              {(user?.role === 'seller' || user?.role === 'admin') && (
                <button className="button button-dark" onClick={() => setEditing({})}>
                  <Plus size={18} /> إضافة معروض
                </button>
              )}
            </div>
            {!user ? (
              <Empty
                title="سجّل الدخول أولاً"
                text="افتح حساب بائع لعرض كتبك بعد مراجعتها."
                action="حساب جديد"
                onAction={() => {
                  setAuthMode('register');
                  go('auth');
                }}
              />
            ) : user.role === 'customer' ? (
              <Empty
                title="ابدأ البيع بحسابك الحالي"
                text="فعّل وضع البائع ثم أضف كتبك للمراجعة."
                action="تفعيل حساب البائع"
                onAction={becomeSeller}
              />
            ) : (
              <>
                <div className="stats">
                  <div>
                    <span>كل المعروضات</span>
                    <strong>{sellerItems.length}</strong>
                  </div>
                  <div>
                    <span>منشورة</span>
                    <strong>{sellerItems.filter((x) => x.status === 'approved').length}</strong>
                  </div>
                  <div>
                    <span>قيد المراجعة</span>
                    <strong>{sellerItems.filter((x) => x.status === 'pending').length}</strong>
                  </div>
                  <div>
                    <span>عناصر مطلوبة</span>
                    <strong>{sellerOrders.length}</strong>
                  </div>
                </div>
                <div className="dashboard-panel">
                  <div className="panel-head">
                    <h2>معروضاتي</h2>
                    <span>
                      {user.role === 'admin'
                        ? 'معروضاتك وتعديلاتك تظهر فوراً بدون موافقة'
                        : 'أي تعديل يعيد المعروض للمراجعة'}
                    </span>
                  </div>
                  {sellerItems.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>المعروض</th>
                            <th>النوع</th>
                            <th>السعر</th>
                            <th>الكمية</th>
                            <th>الحالة</th>
                            <th>إجراء</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sellerItems.map((item) => (
                            <tr key={item.id}>
                              <td>
                                <strong>{item.title}</strong>
                                <small>{item.author}</small>
                                {item.review_note && (
                                  <small className="review-note">{item.review_note}</small>
                                )}
                              </td>
                              <td>{typeNames[item.item_type]}</td>
                              <td>{money(item.price)}</td>
                              <td>{item.quantity}</td>
                              <td>
                                <span className={`status status-${item.status}`}>
                                  {statusNames[item.status]}
                                </span>
                              </td>
                              <td>
                                <button className="table-action" onClick={() => setEditing(item)}>
                                  تعديل
                                </button>
                                <button
                                  className="table-action danger"
                                  onClick={async () => {
                                    if (!confirm('حذف هذا المعروض؟')) return;
                                    try {
                                      await api(
                                        `/seller/listings/${item.id}`,
                                        { method: 'DELETE' },
                                        token,
                                      );
                                      refreshSeller();
                                      notify('تم حذف المعروض');
                                    } catch (error) {
                                      notify(error.message);
                                    }
                                  }}
                                >
                                  حذف
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty
                      title="لم تضف أي معروض بعد"
                      text="ابدأ بإضافة أول كتاب أو مجلة أو مخطوطة."
                      action="إضافة معروض"
                      onAction={() => setEditing({})}
                    />
                  )}
                </div>
                <div className="dashboard-panel">
                  <div className="panel-head">
                    <h2>طلبات معروضاتي</h2>
                  </div>
                  {sellerOrders.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>رقم الطلب</th>
                            <th>المعروض</th>
                            <th>المشتري</th>
                            <th>المدينة</th>
                            <th>الكمية</th>
                            <th>الحالة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sellerOrders.map((item) => (
                            <tr key={item.id}>
                              <td>#{item.order_id}</td>
                              <td>{item.title}</td>
                              <td>
                                {item.customer_name}
                                <small>{item.phone}</small>
                              </td>
                              <td>{item.city}</td>
                              <td>{item.quantity}</td>
                              <td>
                                <span className={`status status-${item.status}`}>
                                  {statusNames[item.status]}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="panel-empty">لا توجد طلبات بعد.</p>
                  )}
                </div>
              </>
            )}
            {editing && (
              <ListingModal
                item={editing}
                token={token}
                isOwner={user.role === 'admin'}
                onClose={() => setEditing(null)}
                onSaved={() => {
                  setEditing(null);
                  refreshSeller();
                  notify(user.role === 'admin' ? 'تم نشر المعروض' : 'تم إرسال المعروض للمراجعة');
                }}
              />
            )}
          </section>
        )}

        {route.page === 'admin' && (
          <section className="container page-section">
            <div className="page-title">
              <span className="mini-title">لوحة الإدارة</span>
              <h1>مراجعة السوق</h1>
              <p>راجع معروضات التجار؛ معروضاتك أنت تُنشر فوراً.</p>
            </div>
            {user?.role !== 'admin' ? (
              <Empty title="غير مصرح لك" text="هذه الصفحة لمدير السوق فقط." />
            ) : (
              <>
                <div className="stats">
                  <div>
                    <span>بانتظار المراجعة</span>
                    <strong>{reviewItems.filter((x) => x.status === 'pending').length}</strong>
                  </div>
                  <div>
                    <span>منشورة</span>
                    <strong>{reviewItems.filter((x) => x.status === 'approved').length}</strong>
                  </div>
                  <div>
                    <span>مرفوضة</span>
                    <strong>{reviewItems.filter((x) => x.status === 'rejected').length}</strong>
                  </div>
                  <div>
                    <span>طلبات جديدة</span>
                    <strong>{orders.filter((x) => x.status === 'new').length}</strong>
                  </div>
                </div>
                <div className="dashboard-panel">
                  <div className="panel-head">
                    <h2>مراجعة المعروضات</h2>
                  </div>
                  <div className="review-filters">
                    {[
                      ['all', 'الكل'],
                      ['pending', 'بانتظار المراجعة'],
                      ['approved', 'تمت الموافقة'],
                      ['rejected', 'مرفوضة'],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        className={reviewFilter === value ? 'selected' : ''}
                        onClick={() => setReviewFilter(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {reviewItems.some(
                    (item) => reviewFilter === 'all' || item.status === reviewFilter,
                  ) ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>المعروض</th>
                            <th>البائع</th>
                            <th>السعر</th>
                            <th>الحالة</th>
                            <th>الإجراء</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reviewItems
                            .filter(
                              (item) => reviewFilter === 'all' || item.status === reviewFilter,
                            )
                            .map((item) => (
                              <tr key={item.id}>
                                <td>
                                  <strong>{item.title}</strong>
                                  <small>
                                    {typeNames[item.item_type]} ·{' '}
                                    {conditionNames[item.item_condition]}
                                  </small>
                                  <small>{item.description.slice(0, 100)}</small>
                                </td>
                                <td>{item.seller_name}</td>
                                <td>{money(item.price)}</td>
                                <td>
                                  <span className={`status status-${item.status}`}>
                                    {statusNames[item.status]}
                                  </span>
                                </td>
                                <td className="review-actions">
                                  {item.status === 'pending' ? (
                                    <>
                                      <button
                                        onClick={async () => {
                                          try {
                                            const data = await api(
                                              `/admin/listings/${item.id}/review`,
                                              {
                                                method: 'PATCH',
                                                body: JSON.stringify({ status: 'approved' }),
                                              },
                                              token,
                                            );
                                            setReviewItems((previous) =>
                                              previous.map((row) =>
                                                row.id === item.id ? data.item : row,
                                              ),
                                            );
                                            setReviewFilter('all');
                                            notify('تمت الموافقة على المعروض');
                                          } catch (error) {
                                            notify(error.message);
                                          }
                                        }}
                                      >
                                        موافقة
                                      </button>
                                      <button
                                        onClick={async () => {
                                          const note = prompt('سبب الرفض (اختياري):') ?? '';
                                          try {
                                            const data = await api(
                                              `/admin/listings/${item.id}/review`,
                                              {
                                                method: 'PATCH',
                                                body: JSON.stringify({ status: 'rejected', note }),
                                              },
                                              token,
                                            );
                                            setReviewItems((previous) =>
                                              previous.map((row) =>
                                                row.id === item.id ? data.item : row,
                                              ),
                                            );
                                            setReviewFilter('all');
                                            notify('تم رفض المعروض');
                                          } catch (error) {
                                            notify(error.message);
                                          }
                                        }}
                                      >
                                        رفض
                                      </button>
                                    </>
                                  ) : (
                                    <span className={`status status-${item.status}`}>
                                      {item.status === 'approved' ? 'تمت الموافقة ✓' : 'تم الرفض'}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="panel-empty">لا توجد معروضات في هذا التصنيف.</p>
                  )}
                </div>
                <div className="dashboard-panel">
                  <div className="panel-head">
                    <h2>إدارة الطلبات</h2>
                  </div>
                  {orders.length ? (
                    ordersByStore(orders).map((store) => (
                      <div className="store-order-group" key={store.sellerId}>
                        <h3>
                          متجر {store.sellerName} <small>({store.orders.length} طلب)</small>
                        </h3>
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>رقم</th>
                                <th>المشتري</th>
                                <th>المحتويات</th>
                                <th>الإجمالي</th>
                                <th>الحالة</th>
                              </tr>
                            </thead>
                            <tbody>
                              {store.orders.map((order) => (
                                <tr key={order.id}>
                                  <td>#{order.id}</td>
                                  <td>
                                    {order.customer_name}
                                    <small>
                                      {order.phone} · {order.city}
                                    </small>
                                  </td>
                                  <td>{order.items.map((x) => x.title).join('، ')}</td>
                                  <td>{money(order.total)}</td>
                                  <td>
                                    <select
                                      value={order.status}
                                      onChange={async (e) => {
                                        try {
                                          await api(
                                            `/admin/orders/${order.id}`,
                                            {
                                              method: 'PATCH',
                                              body: JSON.stringify({ status: e.target.value }),
                                            },
                                            token,
                                          );
                                          refreshAdmin();
                                          notify('تم تحديث الطلب');
                                        } catch (error) {
                                          notify(error.message);
                                        }
                                      }}
                                    >
                                      {[
                                        'new',
                                        'confirmed',
                                        'shipped',
                                        'delivered',
                                        'cancelled',
                                      ].map((value) => (
                                        <option value={value} key={value}>
                                          {statusNames[value]}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="panel-empty">لا توجد طلبات بعد.</p>
                  )}
                </div>
              </>
            )}
          </section>
        )}
      </main>
      <footer className="footer">
        <div className="container footer-grid">
          <div>
            <div className="footer-logo">
              <img className="logo-mark" src="/ilm-logo-green.jpeg" alt="شعار متجر علم" />
              <strong>متجر علم</strong>
            </div>
            <p>
              سوق لكتب العلم والتراث والمخطوطات والطبعات النادرة، يجمع البائعين بالباحثين والقرّاء.
            </p>
          </div>
          <div>
            <h4>اكتشف</h4>
            <button onClick={() => openCatalog()}>كل المعروضات</button>
            <button onClick={() => openCatalog('rare')}>الكتب القديمة والنادرة</button>
            <button onClick={() => openCatalog('manuscript')}>المخطوطات</button>
          </div>
          <div>
            <h4>حسابك</h4>
            {user && <button onClick={() => go('profile')}>الملف الشخصي</button>}
            <button onClick={() => go(user ? 'seller' : 'auth')}>اعرض كتبك</button>
            <button onClick={() => go(user ? 'orders' : 'auth')}>طلباتي</button>
            <button onClick={() => go('cart')}>سلة المشتريات</button>
          </div>
          <div className="footer-note">
            من جيل إلى جيل،
            <br />
            <em>يبقى العلم.</em>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} متجر علم. كل الحقوق محفوظة.</span>
          <span>صُنع بمحبة للعلم والتراث ✦</span>
        </div>
      </footer>
      <Alert text={notice} onClose={() => setNotice('')} />
    </>
  );
}

function ProfilePage({ user, token, onUpdated, onPasswordChanged, onNavigate, onLogout }) {
  const joined = user.created_at
    ? new Date(`${user.created_at.replace(' ', 'T')}Z`).toLocaleDateString('ar-EG', {
        month: 'long',
        year: 'numeric',
      })
    : '';
  return (
    <section className="container page-section profile-page">
      <div className="profile-hero">
        <span className="profile-avatar">{user.name?.trim()?.[0] || 'ع'}</span>
        <div>
          <span className="mini-title">ملفك الشخصي</span>
          <h1>أهلاً، {user.name}</h1>
          <p>
            {user.email}
            {joined ? ` · عضو منذ ${joined}` : ''}
          </p>
        </div>
        <span className="profile-role">
          <ShieldCheck size={17} /> {roleNames[user.role]}
        </span>
      </div>
      <div className="profile-layout">
        <aside className="profile-sidebar">
          <div className="profile-side-heading">حسابك في متجر علم</div>
          <button className="selected" onClick={() => onNavigate('profile')}>
            <UserRound size={18} /> البيانات الشخصية
          </button>
          <button onClick={() => onNavigate('orders')}>
            <ShoppingBag size={18} /> طلباتي
          </button>
          {(user.role === 'seller' || user.role === 'admin') && (
            <button onClick={() => onNavigate('seller')}>
              <BookOpen size={18} /> معروضاتي
            </button>
          )}
          {user.role === 'admin' && (
            <button onClick={() => onNavigate('admin')}>
              <ShieldCheck size={18} /> لوحة الإدارة
            </button>
          )}
          <button className="profile-logout" onClick={onLogout}>
            <LogOut size={18} /> تسجيل الخروج
          </button>
        </aside>
        <div className="profile-content">
          {user.role === 'admin' && (
            <div className="owner-note">
              <ShieldCheck size={22} />
              <div>
                <strong>أنت مالك المتجر</strong>
                <p>أي معروض تضيفه أو تعدّله من حسابك يُنشر مباشرةً. معروضات التجار تمر بمراجعتك.</p>
              </div>
            </div>
          )}
          <div className="profile-card">
            <div className="profile-card-heading">
              <div>
                <span className="mini-title">بيانات الحساب</span>
                <h2>معلوماتك الشخصية</h2>
              </div>
              <UserRound size={23} />
            </div>
            <p className="profile-intro">حدّث بيانات التواصل والتوصيل التي تستخدمها عند الطلب.</p>
            <ProfileForm user={user} token={token} onUpdated={onUpdated} />
          </div>
          <div className="profile-card">
            <div className="profile-card-heading">
              <div>
                <span className="mini-title">الأمان</span>
                <h2>تغيير كلمة المرور</h2>
              </div>
              <LockKeyhole size={23} />
            </div>
            <p className="profile-intro">استخدم كلمة مرور قوية لا تستعملها في حسابات أخرى.</p>
            <PasswordForm token={token} onChanged={onPasswordChanged} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ProfileForm({ user, token, onUpdated }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const data = await api('/profile', { method: 'PUT', body: JSON.stringify(values) }, token);
      onUpdated(data.user);
    } catch (issue) {
      setError(issue.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form profile-form" onSubmit={submit}>
      <div className="two-fields">
        <label>
          الاسم الكامل
          <input
            name="name"
            required
            minLength="2"
            maxLength="100"
            defaultValue={user.name}
            autoComplete="name"
          />
        </label>
        <label>
          البريد الإلكتروني
          <input
            name="email"
            type="email"
            required
            maxLength="200"
            defaultValue={user.email}
            dir="ltr"
            autoComplete="email"
          />
        </label>
      </div>
      <div className="two-fields">
        <label>
          رقم الهاتف
          <input
            name="phone"
            type="tel"
            maxLength="30"
            defaultValue={user.phone || ''}
            placeholder="01xxxxxxxxx"
            dir="ltr"
            autoComplete="tel"
          />
        </label>
        <label>
          المدينة / المحافظة
          <input
            name="city"
            maxLength="100"
            defaultValue={user.city || ''}
            placeholder="القاهرة"
            autoComplete="address-level2"
          />
        </label>
      </div>
      <label>
        عنوان التوصيل
        <input
          name="address"
          maxLength="250"
          defaultValue={user.address || ''}
          placeholder="الشارع، رقم المبنى، الشقة"
          autoComplete="street-address"
        />
      </label>
      {(user.role === 'seller' || user.role === 'admin') && (
        <>
          <div className="profile-form-divider" />
          <div className="two-fields">
            <label>
              اسم المتجر المعروض للزوار
              <input
                name="store_name"
                maxLength="100"
                defaultValue={user.store_name || ''}
                placeholder="اسم مكتبتك أو متجرك"
              />
            </label>
            <div className="profile-helper">
              إذا تركت الاسم فارغاً، سيظهر اسمك الشخصي كبائع للمعروضات.
            </div>
          </div>
          <label>
            نبذة عنك
            <textarea
              name="bio"
              rows="3"
              maxLength="500"
              defaultValue={user.bio || ''}
              placeholder="عرّف القرّاء بمكتبتك ومقتنياتك"
            />
          </label>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-dark profile-save" disabled={busy}>
        {busy ? 'جارٍ الحفظ...' : 'حفظ التغييرات'} <Check size={17} />
      </button>
    </form>
  );
}

function PasswordForm({ token, onChanged }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError('');
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    if (values.new_password !== values.confirm_password) {
      setError('تأكيد كلمة المرور غير مطابق');
      return;
    }
    setBusy(true);
    try {
      await api(
        '/profile/password',
        {
          method: 'PUT',
          body: JSON.stringify({
            current_password: values.current_password,
            new_password: values.new_password,
          }),
        },
        token,
      );
      form.reset();
      onChanged();
    } catch (issue) {
      setError(issue.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form profile-form" onSubmit={submit}>
      <label>
        كلمة المرور الحالية
        <input name="current_password" type="password" required autoComplete="current-password" />
      </label>
      <div className="two-fields">
        <label>
          كلمة المرور الجديدة
          <input
            name="new_password"
            type="password"
            required
            minLength="8"
            autoComplete="new-password"
          />
        </label>
        <label>
          تأكيد كلمة المرور الجديدة
          <input
            name="confirm_password"
            type="password"
            required
            minLength="8"
            autoComplete="new-password"
          />
        </label>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-dark profile-save" disabled={busy}>
        {busy ? 'جارٍ التغيير...' : 'تغيير كلمة المرور'} <ArrowLeft size={17} />
      </button>
    </form>
  );
}

function AuthForm({ mode, onSubmit }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState('customer');
  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await onSubmit(Object.fromEntries(form));
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form" onSubmit={submit}>
      {mode === 'register' && (
        <>
          <label>
            الاسم الكامل
            <input name="name" required minLength="2" placeholder="اسمك الكامل" />
          </label>
          <div className="role-picker">
            <button
              type="button"
              className={role === 'customer' ? 'selected' : ''}
              onClick={() => setRole('customer')}
            >
              أريد الشراء
            </button>
            <button
              type="button"
              className={role === 'seller' ? 'selected' : ''}
              onClick={() => setRole('seller')}
            >
              أريد البيع
            </button>
          </div>
          <input type="hidden" name="role" value={role} />
        </>
      )}
      <label>
        البريد الإلكتروني
        <input name="email" type="email" required placeholder="name@example.com" dir="ltr" />
      </label>
      <label>
        كلمة المرور
        <input
          name="password"
          type="password"
          required
          minLength={mode === 'register' ? 8 : 1}
          placeholder="••••••••"
          dir="ltr"
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button className="button button-dark form-submit" disabled={busy}>
        {busy ? 'جارٍ المتابعة...' : mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب'}{' '}
        <ArrowLeft size={18} />
      </button>
    </form>
  );
}
function CheckoutForm({ user, onSubmit }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onSubmit(Object.fromEntries(new FormData(event.currentTarget)));
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form checkout-form" onSubmit={submit}>
      <h2>بيانات التوصيل</h2>
      <div className="two-fields">
        <label>
          الاسم الكامل
          <input name="customer_name" required minLength="2" defaultValue={user.name} />
        </label>
        <label>
          رقم الهاتف
          <input
            name="phone"
            required
            minLength="8"
            placeholder="01xxxxxxxxx"
            dir="ltr"
            defaultValue={user.phone || ''}
          />
        </label>
      </div>
      <div className="two-fields">
        <label>
          المدينة / المحافظة
          <input name="city" required placeholder="القاهرة" defaultValue={user.city || ''} />
        </label>
        <label>
          العنوان بالتفصيل
          <input
            name="address"
            required
            minLength="5"
            placeholder="الشارع، رقم المبنى، الشقة"
            defaultValue={user.address || ''}
          />
        </label>
      </div>
      <label>
        ملاحظات للطلب (اختياري)
        <textarea name="notes" rows="3" placeholder="أي تفاصيل تساعدنا في التوصيل" />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button className="button button-dark" disabled={busy}>
        {busy ? 'جارٍ تسجيل الطلب...' : 'تأكيد الطلب'} <ArrowLeft size={18} />
      </button>
      <small>طريقة الدفع: عند الاستلام</small>
    </form>
  );
}
function ListingModal({ item, token, isOwner, onClose, onSaved }) {
  const [imageUrl, setImageUrl] = useState(item.image_url || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  async function uploadImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('image', file);
      const data = await api('/uploads', { method: 'POST', body: form }, token);
      setImageUrl(data.url);
    } catch (error) {
      setError(error.message);
    } finally {
      setUploading(false);
    }
  }
  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    values.image_url = imageUrl;
    try {
      await api(
        item.id ? `/seller/listings/${item.id}` : '/seller/listings',
        { method: item.id ? 'PUT' : 'POST', body: JSON.stringify(values) },
        token,
      );
      onSaved();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="mini-title">متجرك</span>
            <h2>{item.id ? 'تعديل المعروض' : 'إضافة معروض جديد'}</h2>
          </div>
          <button onClick={onClose} aria-label="إغلاق">
            <X size={22} />
          </button>
        </div>
        <div className={isOwner ? 'publish-hint owner' : 'publish-hint'}>
          <ShieldCheck size={19} />
          <span>
            {isOwner
              ? 'بصفتك مالك المتجر، سيظهر معروضك مباشرةً للزوار بعد الحفظ.'
              : 'سيظهر المعروض للزوار بعد موافقة إدارة المتجر.'}
          </span>
        </div>
        <form className="form" onSubmit={submit}>
          <div className="two-fields">
            <label>
              عنوان المعروض *
              <input
                name="title"
                required
                maxLength="160"
                defaultValue={item.title || ''}
                placeholder="مثال: الأيام"
              />
            </label>
            <label>
              المؤلف / المصدر
              <input
                name="author"
                maxLength="120"
                defaultValue={item.author || ''}
                placeholder="طه حسين"
              />
            </label>
          </div>
          <div className="two-fields">
            <label>
              النوع *
              <select name="item_type" defaultValue={item.item_type || 'book'}>
                {Object.entries(typeNames).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              الحالة *
              <select name="item_condition" defaultValue={item.item_condition || 'good'}>
                {Object.entries(conditionNames).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="two-fields">
            <label>
              السعر بالجنيه المصري *
              <input
                name="price"
                type="number"
                min="0"
                max="10000000"
                required
                defaultValue={item.price ?? ''}
              />
            </label>
            <label>
              الكمية *
              <input
                name="quantity"
                type="number"
                min="1"
                max="10000"
                required
                defaultValue={item.quantity ?? 1}
              />
            </label>
          </div>
          <label>
            سنة النشر (اختياري)
            <input
              name="publication_year"
              type="number"
              min="100"
              max={new Date().getFullYear() + 1}
              defaultValue={item.publication_year || ''}
            />
          </label>
          <label>
            وصف المعروض
            <textarea
              name="description"
              rows="4"
              maxLength="3000"
              defaultValue={item.description || ''}
              placeholder="احكِ عن النسخة وحالتها وأي تفاصيل تهمّ القارئ"
            />
          </label>
          <label>
            صورة الغلاف <span className="label-hint">JPG أو PNG أو WebP، بحد أقصى 5 ميجابايت</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} />
            {uploading && <small>جارٍ رفع الصورة...</small>}
            {imageUrl && <small>تم اختيار الصورة ✓</small>}
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="button button-dark" disabled={busy || uploading}>
            {busy
              ? 'جارٍ الحفظ...'
              : isOwner
                ? item.id
                  ? 'حفظ ونشر التعديلات'
                  : 'نشر المعروض الآن'
                : item.id
                  ? 'حفظ التعديلات للمراجعة'
                  : 'إرسال للمراجعة'}{' '}
            <ArrowLeft size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
