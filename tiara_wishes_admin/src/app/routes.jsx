import { Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from '../components/layout/AdminLayout'
import { RequireAuth, RequirePermission } from '../components/RequireAccess'
import AuditLogsPage from '../pages/AuditLogsPage'
import BrandsPage from '../pages/BrandsPage'
import CategoriesPage from '../pages/CategoriesPage'
import ComingLaterPage from '../pages/ComingLaterPage'
import ContentSettingsPage from '../pages/ContentSettingsPage'
import CustomerDetailsPage from '../pages/CustomerDetailsPage'
import CustomersPage from '../pages/CustomersPage'
import DashboardPage from '../pages/DashboardPage'
import DeliveriesPage from '../pages/DeliveriesPage'
import DeliveryDetailsPage from '../pages/DeliveryDetailsPage'
import InventoryPage from '../pages/InventoryPage'
import LoginPage from '../pages/LoginPage'
import NotFoundPage from '../pages/NotFoundPage'
import OrderDetailsPage from '../pages/OrderDetailsPage'
import OrdersPage from '../pages/OrdersPage'
import PaymentDetailsPage from '../pages/PaymentDetailsPage'
import PaymentsPage from '../pages/PaymentsPage'
import ProductCreatePage from '../pages/ProductCreatePage'
import ProductEditPage from '../pages/ProductEditPage'
import ProductsPage from '../pages/ProductsPage'
import PromotionsPage from '../pages/PromotionsPage'
import ReportsPage from '../pages/ReportsPage'
import ReviewsPage from '../pages/ReviewsPage'
import SettingsPage from '../pages/SettingsPage'
import StaffPermissionsPage from '../pages/StaffPermissionsPage'

const home = { title: 'Dashboard', crumbs: [{ label: 'Dashboard' }] }

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<RequirePermission permission="reports.read"><DashboardPage /></RequirePermission>} handle={home} />
        <Route path="products" element={<RequirePermission permission="products.manage"><ProductsPage /></RequirePermission>} handle={{ title: 'Products', crumbs: [{ label: 'Products' }] }} />
        <Route path="products/new" element={<RequirePermission permission="products.manage"><ProductCreatePage /></RequirePermission>} handle={{ title: 'New product', crumbs: [{ label: 'Products', to: '/admin/products' }, { label: 'New' }] }} />
        <Route path="products/:id/edit" element={<RequirePermission permission="products.manage"><ProductEditPage /></RequirePermission>} handle={{ title: 'Edit product', crumbs: [{ label: 'Products', to: '/admin/products' }, { label: 'Edit' }] }} />
        <Route path="categories" element={<RequirePermission permission="categories.manage"><CategoriesPage /></RequirePermission>} handle={{ title: 'Categories', crumbs: [{ label: 'Categories' }] }} />
        <Route path="brands" element={<RequirePermission permission="brands.manage"><BrandsPage /></RequirePermission>} handle={{ title: 'Brands', crumbs: [{ label: 'Brands' }] }} />
        <Route path="inventory" element={<RequirePermission permission="inventory.manage"><InventoryPage /></RequirePermission>} handle={{ title: 'Inventory', crumbs: [{ label: 'Inventory' }] }} />
        <Route path="orders" element={<RequirePermission permission="orders.manage"><OrdersPage /></RequirePermission>} handle={{ title: 'Orders', crumbs: [{ label: 'Orders' }] }} />
        <Route path="orders/:orderNumber" element={<RequirePermission permission="orders.manage"><OrderDetailsPage /></RequirePermission>} handle={{ title: 'Order', crumbs: [{ label: 'Orders', to: '/admin/orders' }, { label: 'Detail' }] }} />
        <Route path="customers" element={<RequirePermission anyOf={['customers.read', 'customers.manage']}><CustomersPage /></RequirePermission>} handle={{ title: 'Customers', crumbs: [{ label: 'Customers' }] }} />
        <Route path="customers/:id" element={<RequirePermission anyOf={['customers.read', 'customers.manage']}><CustomerDetailsPage /></RequirePermission>} handle={{ title: 'Customer', crumbs: [{ label: 'Customers', to: '/admin/customers' }, { label: 'Detail' }] }} />
        <Route path="payments" element={<RequirePermission permission="payments.manage"><PaymentsPage /></RequirePermission>} handle={{ title: 'Payments', crumbs: [{ label: 'Payments' }] }} />
        <Route path="payments/:merchantReference" element={<RequirePermission permission="payments.manage"><PaymentDetailsPage /></RequirePermission>} handle={{ title: 'Payment', crumbs: [{ label: 'Payments', to: '/admin/payments' }, { label: 'Detail' }] }} />
        <Route path="deliveries" element={<RequirePermission permission="deliveries.manage"><DeliveriesPage /></RequirePermission>} handle={{ title: 'Deliveries', crumbs: [{ label: 'Deliveries' }] }} />
        <Route path="deliveries/:id" element={<RequirePermission permission="deliveries.manage"><DeliveryDetailsPage /></RequirePermission>} handle={{ title: 'Delivery', crumbs: [{ label: 'Deliveries', to: '/admin/deliveries' }, { label: 'Detail' }] }} />
        <Route path="promotions" element={<RequirePermission permission="promotions.manage"><PromotionsPage /></RequirePermission>} handle={{ title: 'Promotions', crumbs: [{ label: 'Promotions' }] }} />
        <Route path="reviews" element={<RequirePermission permission="reviews.moderate"><ReviewsPage /></RequirePermission>} handle={{ title: 'Reviews', crumbs: [{ label: 'Reviews' }] }} />
        <Route path="content" element={<RequirePermission permission="content.manage"><ContentSettingsPage /></RequirePermission>} handle={{ title: 'Content', crumbs: [{ label: 'Content' }] }} />
        <Route path="settings" element={<RequirePermission permission="content.manage"><SettingsPage /></RequirePermission>} handle={{ title: 'Settings', crumbs: [{ label: 'Settings' }] }} />
        <Route path="staff" element={<RequirePermission permission="users.manage"><StaffPermissionsPage /></RequirePermission>} handle={{ title: 'Staff', crumbs: [{ label: 'Staff' }] }} />
        <Route path="reports" element={<RequirePermission permission="reports.read"><ReportsPage /></RequirePermission>} handle={{ title: 'Reports', crumbs: [{ label: 'Reports' }] }} />
        <Route path="audit-logs" element={<RequirePermission permission="audit.read"><AuditLogsPage /></RequirePermission>} handle={{ title: 'Audit logs', crumbs: [{ label: 'Audit logs' }] }} />
        <Route path="chama" element={<ComingLaterPage />} handle={{ title: 'Chama', crumbs: [{ label: 'Chama' }] }} />
        <Route path="*" element={<NotFoundPage />} handle={{ title: 'Not found' }} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
