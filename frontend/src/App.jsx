import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Navbar, { MobileBottomNav } from './components/Navbar'
import Footer from './components/Footer'
import ChatWidget from './components/ChatWidget'
import { ProtectedRoute, AdminRoute } from './routes/ProtectedRoute'

// Code-split pages for fast initial load
const HomePage          = lazy(() => import('./pages/HomePage'))
const LoginPage         = lazy(() => import('./pages/LoginPage'))
const RegisterPage      = lazy(() => import('./pages/RegisterPage'))
const ProductListPage   = lazy(() => import('./pages/ProductListPage'))
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'))
const CartPage          = lazy(() => import('./pages/CartPage'))
const CheckoutPage      = lazy(() => import('./pages/CheckoutPage'))
const PaymentPage       = lazy(() => import('./pages/PaymentPage'))
const OrderListPage     = lazy(() => import('./pages/OrderListPage'))
const OrderTrackingPage = lazy(() => import('./pages/OrderTrackingPage'))
const WishlistPage      = lazy(() => import('./pages/WishlistPage'))
const AddressesPage     = lazy(() => import('./pages/AddressesPage'))
const ProfilePage       = lazy(() => import('./pages/ProfilePage'))
const BecomeSellerPage  = lazy(() => import('./pages/BecomeSellerPage'))

// Admin pages
const AdminProductsPage  = lazy(() => import('./pages/admin/AdminProductsPage'))
const AdminOrdersPage    = lazy(() => import('./pages/admin/AdminOrdersPage'))
const AdminUsersPage     = lazy(() => import('./pages/admin/AdminUsersPage'))
const AdminReturnsPage   = lazy(() => import('./pages/admin/AdminReturnsPage'))
const AdminAnalyticsPage = lazy(() => import('./pages/admin/AdminAnalyticsPage'))
const AdminCouponsPage   = lazy(() => import('./pages/admin/AdminCouponsPage'))
const AdminAuditLogsPage = lazy(() => import('./pages/admin/AdminAuditLogsPage'))
const AdminSellersPage   = lazy(() => import('./pages/admin/AdminSellersPage'))

export default function App() {
  const location = useLocation()
  const isAdminRoute = location.pathname.startsWith('/admin')

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [location.pathname, location.search])

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <ChatWidget />
      <div className="flex-1">
        <Suspense fallback={<div className="loading-center"><div className="spinner" /></div>}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/products" element={<ProductListPage />} />
            <Route path="/products/:id" element={<ProductDetailPage />} />
            <Route path="/sell" element={<BecomeSellerPage />} />

            {/* Customer (authenticated) */}
            <Route path="/cart" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />
            <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
            <Route path="/payment" element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><OrderListPage /></ProtectedRoute>} />
            <Route path="/orders/:id" element={<ProtectedRoute><OrderTrackingPage /></ProtectedRoute>} />
            <Route path="/wishlist" element={<ProtectedRoute><WishlistPage /></ProtectedRoute>} />
            <Route path="/addresses" element={<ProtectedRoute><AddressesPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

            {/* Admin */}
            <Route path="/admin" element={<AdminRoute><Navigate to="/admin/analytics" replace /></AdminRoute>} />
            <Route path="/admin/analytics" element={<AdminRoute><AdminAnalyticsPage /></AdminRoute>} />
            <Route path="/admin/products" element={<AdminRoute><AdminProductsPage /></AdminRoute>} />
            <Route path="/admin/orders" element={<AdminRoute><AdminOrdersPage /></AdminRoute>} />
            <Route path="/admin/returns" element={<AdminRoute><AdminReturnsPage /></AdminRoute>} />
            <Route path="/admin/coupons" element={<AdminRoute><AdminCouponsPage /></AdminRoute>} />
            <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
            <Route path="/admin/sellers" element={<AdminRoute><AdminSellersPage /></AdminRoute>} />
            <Route path="/admin/audit-logs" element={<AdminRoute><AdminAuditLogsPage /></AdminRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
      {!isAdminRoute && <Footer />}
      {!isAdminRoute && <MobileBottomNav />}
    </div>
  )
}
