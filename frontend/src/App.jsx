import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import ChatWidget from './components/ChatWidget'
import { ProtectedRoute, AdminRoute } from './routes/ProtectedRoute'

// Public pages
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ProductListPage from './pages/ProductListPage'
import ProductDetailPage from './pages/ProductDetailPage'

// Customer pages
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import PaymentPage from './pages/PaymentPage'
import OrderListPage from './pages/OrderListPage'
import OrderTrackingPage from './pages/OrderTrackingPage'

// Admin pages
import AdminProductsPage from './pages/admin/AdminProductsPage'
import AdminOrdersPage from './pages/admin/AdminOrdersPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'

export default function App() {
  return (
    <>
      <Navbar />
      <ChatWidget />
      <Routes>
        {/* Public */}
        <Route path="/" element={<Navigate to="/products" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/products" element={<ProductListPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />

        {/* Customer (authenticated) */}
        <Route path="/cart" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />
        <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
        <Route path="/payment" element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><OrderListPage /></ProtectedRoute>} />
        <Route path="/orders/:id" element={<ProtectedRoute><OrderTrackingPage /></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin" element={<AdminRoute><Navigate to="/admin/products" replace /></AdminRoute>} />
        <Route path="/admin/products" element={<AdminRoute><AdminProductsPage /></AdminRoute>} />
        <Route path="/admin/orders" element={<AdminRoute><AdminOrdersPage /></AdminRoute>} />
        <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/products" replace />} />
      </Routes>
    </>
  )
}
