import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useParams } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Orders from './pages/Orders';
import Analytics from './pages/Analytics';
import Reviews from './pages/Reviews';
import StorefrontLayout from './storefront/StorefrontLayout';
import Home from './storefront/pages/Home';
import Category from './storefront/pages/Category';
import Product from './storefront/pages/Product';
import Cart from './storefront/pages/Cart';
import Checkout from './storefront/pages/Checkout';
import OrderSuccess from './storefront/pages/OrderSuccess';
import { CartProvider } from './storefront/cart-context';
import AdminGuard from './admin/AdminGuard';
import AdminLogin from './admin/AdminLogin';

const META_PIXEL_ID = '2159470911562696';

function MetaPixelTracker() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.fbq) return;

    /* eslint-disable no-underscore-dangle */
    (function initMetaPixel(f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function fbqProxy() {
        if (n.callMethod) {
          n.callMethod.apply(n, arguments);
        } else {
          n.queue.push(arguments);
        }
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e);
      t.async = true;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js'));
    /* eslint-enable no-underscore-dangle */

    window.fbq('init', META_PIXEL_ID);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.fbq) return;
    if (location.pathname.startsWith('/admin')) return;
    window.fbq('track', 'PageView');
  }, [location.pathname]);

  return null;
}

function ProductRoute() {
  const { slug } = useParams();
  return <Product key={slug} />;
}

function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <MetaPixelTracker />
        <Routes>
          <Route element={<StorefrontLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/shop/:category" element={<Category />} />
            <Route path="/product/:slug" element={<ProductRoute />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order-success/:id" element={<OrderSuccess />} />
          </Route>

          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={
              <AdminGuard>
                <Layout />
              </AdminGuard>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="products" element={<Products />} />
            <Route path="orders" element={<Orders />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="reviews" element={<Reviews />} />
          </Route>
        </Routes> */ded/*
      </CartProvider>
    </BrowserRouter>
  );
}

export default App;
