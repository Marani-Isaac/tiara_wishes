import { Route, Routes } from 'react-router-dom'
import RequireAuth from '../components/RequireAuth'
import AccountLayout from '../components/account/AccountLayout'
import StoreLayout from '../components/layout/StoreLayout'
import AboutPage, { ChamaComingSoonPage, ContactPage, NotFoundPage, PolicyPage } from '../pages/ContentPages'
import AccountPage from '../pages/AccountPage'
import AddressesPage from '../pages/AddressesPage'
import CartPage from '../pages/CartPage'
import CheckoutPage from '../pages/CheckoutPage'
import ForgotPasswordPage from '../pages/ForgotPasswordPage'
import HomePage from '../pages/HomePage'
import LoginPage from '../pages/LoginPage'
import OrderDetailPage from '../pages/OrderDetailPage'
import OrdersPage from '../pages/OrdersPage'
import ProductPage from '../pages/ProductPage'
import RegisterPage from '../pages/RegisterPage'
import ShopPage, { CategoryPage } from '../pages/ShopPage'

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<StoreLayout />}>
        <Route index element={<HomePage />} />
        <Route path="shop" element={<ShopPage />} />
        <Route path="categories/:slug" element={<CategoryPage />} />
        <Route path="products/:slug" element={<ProductPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="chamas" element={<ChamaComingSoonPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="delivery-returns" element={<PolicyPage kind="delivery" />} />
        <Route path="privacy" element={<PolicyPage kind="privacy" />} />
        <Route path="terms" element={<PolicyPage kind="terms" />} />
        <Route
          path="account"
          element={
            <RequireAuth>
              <AccountLayout />
            </RequireAuth>
          }
        >
          <Route index element={<AccountPage />} />
          <Route path="addresses" element={<AddressesPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:orderNumber" element={<OrderDetailPage />} />
        </Route>
        <Route path="reset-password" element={<ForgotPasswordPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
