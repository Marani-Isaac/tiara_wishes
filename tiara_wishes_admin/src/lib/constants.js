export const ORDER_TRANSITIONS = {
  pending_payment: ['cancelled', 'failed'],
  confirmed: ['processing', 'refund_pending'],
  processing: ['ready_to_dispatch', 'refund_pending'],
  ready_to_dispatch: ['dispatched', 'refund_pending'],
  dispatched: ['delivered'],
  delivered: [],
  cancelled: [],
  refund_pending: ['refunded'],
  refunded: [],
  failed: ['cancelled'],
}

export const ORDER_STATUSES = [
  'pending_payment',
  'confirmed',
  'processing',
  'ready_to_dispatch',
  'dispatched',
  'delivered',
  'cancelled',
  'refund_pending',
  'refunded',
  'failed',
]

export const ORDER_PAYMENT_STATUSES = [
  'unpaid',
  'pending',
  'paid',
  'failed',
  'partially_refunded',
  'refunded',
]

export const PAYMENT_STATUSES = [
  'initiated',
  'pending',
  'succeeded',
  'failed',
  'cancelled',
  'refunded',
  'partially_refunded',
]

export const DELIVERY_STATUSES = [
  'pending',
  'processing',
  'packed',
  'dispatched',
  'in_transit',
  'delivered',
  'failed',
  'returned',
]

export const PRODUCT_STATUSES = ['draft', 'active', 'archived']

export const ASSIGNABLE_ROLES = [
  'customer',
  'admin',
  'inventory_manager',
  'order_manager',
  'finance_manager',
  'content_manager',
  'super_admin',
]

export const MOVEMENT_TYPES = [
  { value: 'restock', label: 'Restock', sign: 'positive' },
  { value: 'return', label: 'Return', sign: 'positive' },
  { value: 'opening_stock', label: 'Opening stock', sign: 'positive' },
  { value: 'adjustment', label: 'Correction', sign: 'either' },
]

export const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', end: true, permission: 'reports.read' },
  { to: '/admin/products', label: 'Products', permission: 'products.manage', count: 'products' },
  { to: '/admin/categories', label: 'Categories', permission: 'categories.manage', count: 'categories' },
  { to: '/admin/brands', label: 'Brands', permission: 'brands.manage', count: 'brands' },
  { to: '/admin/inventory', label: 'Inventory', permission: 'inventory.manage', count: 'inventory' },
  { to: '/admin/orders', label: 'Orders', permission: 'orders.manage', count: 'orders' },
  { to: '/admin/customers', label: 'Customers', anyOf: ['customers.read', 'customers.manage'], count: 'customers' },
  { to: '/admin/payments', label: 'Payments', permission: 'payments.manage', count: 'payments' },
  { to: '/admin/deliveries', label: 'Deliveries', permission: 'deliveries.manage', count: 'deliveries' },
  { to: '/admin/promotions', label: 'Promotions', permission: 'promotions.manage', count: 'promotions' },
  { to: '/admin/reviews', label: 'Reviews', permission: 'reviews.moderate', count: 'reviews' },
  { to: '/admin/content', label: 'Content', permission: 'content.manage', count: 'content' },
  { to: '/admin/settings', label: 'Settings', permission: 'content.manage', count: 'settings' },
  { to: '/admin/staff', label: 'Staff', permission: 'users.manage', count: 'staff' },
  { to: '/admin/reports', label: 'Reports', permission: 'reports.read' },
  { to: '/admin/audit-logs', label: 'Audit logs', permission: 'audit.read', count: 'audit' },
  { to: '/admin/chama', label: 'Chama', coming: true },
]
