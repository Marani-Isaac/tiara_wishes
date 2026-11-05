-- Reference data and clearly marked demo catalogue rows.
-- Safe to run more than once. Existing rows are left unchanged.

INSERT IGNORE INTO roles (name, description) VALUES
('customer', 'Retail customer'),
('admin', 'Store administrator'),
('inventory_manager', 'Manages catalogue stock'),
('order_manager', 'Manages orders and deliveries'),
('finance_manager', 'Manages payments, refunds, and reports'),
('content_manager', 'Manages site content, promotions, and reviews'),
('super_admin', 'Full access, including role assignment');

INSERT IGNORE INTO permissions (code, description) VALUES
('categories.manage', 'Create and edit categories'),
('brands.manage', 'Create and edit brands'),
('products.manage', 'Create and edit products'),
('inventory.manage', 'Adjust stock'),
('orders.manage', 'View and update orders'),
('payments.manage', 'View and reconcile payments'),
('deliveries.manage', 'View and update deliveries'),
('customers.read', 'View customers'),
('customers.manage', 'Enable or disable customers'),
('promotions.manage', 'Create and edit promotions'),
('content.manage', 'Edit site content and settings'),
('reports.read', 'View sales and product reports'),
('audit.read', 'View audit logs'),
('users.manage', 'Assign staff roles'),
('reviews.moderate', 'Approve or reject reviews'),
('refunds.manage', 'Record refund tracking entries');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
WHERE r.name IN ('admin', 'super_admin');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('products.manage', 'inventory.manage', 'categories.manage', 'brands.manage')
WHERE r.name = 'inventory_manager';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('orders.manage', 'deliveries.manage', 'customers.read')
WHERE r.name = 'order_manager';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('payments.manage', 'refunds.manage', 'reports.read', 'audit.read')
WHERE r.name = 'finance_manager';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('content.manage', 'promotions.manage', 'reviews.moderate')
WHERE r.name = 'content_manager';

INSERT IGNORE INTO categories (name, slug, description, sort_order, is_active) VALUES
('Home', 'home', 'Demo category. Edit or archive this before launch.', 1, 1),
('Kitchen', 'kitchen', 'Demo category. Edit or archive this before launch.', 2, 1),
('Personal Care', 'personal-care', 'Demo category. Edit or archive this before launch.', 3, 1);

INSERT INTO categories (name, slug, description, parent_id, sort_order, is_active)
SELECT 'Cookware', 'cookware', 'Demo child category. Edit or archive this before launch.', c.id, 1, 1
FROM categories c
WHERE c.slug = 'kitchen'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'cookware');

INSERT IGNORE INTO brands (name, slug, description, is_active) VALUES
('Tiara Home', 'tiara-home', 'Demo brand. Edit or archive this before launch.', 1),
('Everyday Essentials', 'everyday-essentials', 'Demo brand. Edit or archive this before launch.', 1);

INSERT IGNORE INTO products (
  category_id, brand_id, name, slug, sku, short_description, description,
  cash_price, compare_at_price, currency, low_stock_threshold,
  is_featured, is_active, status
)
SELECT c.id, b.id,
  'DEMO Ceramic Dinner Plate', 'demo-ceramic-dinner-plate', 'DEMO-PLATE-001',
  'Demo catalogue item. Safe to edit or archive.',
  'Demo catalogue item. Safe to edit or archive. Not a real product listing.',
  450.00, NULL, 'KES', 5, 0, 1, 'active'
FROM categories c
JOIN brands b ON b.slug = 'everyday-essentials'
WHERE c.slug = 'kitchen';

INSERT IGNORE INTO products (
  category_id, brand_id, name, slug, sku, short_description, description,
  cash_price, compare_at_price, currency, low_stock_threshold,
  is_featured, is_active, status
)
SELECT c.id, b.id,
  'DEMO Cotton Throw', 'demo-cotton-throw', 'DEMO-THROW-001',
  'Demo catalogue item. Safe to edit or archive.',
  'Demo catalogue item. Safe to edit or archive. Not a real product listing.',
  1899.00, 2500.00, 'KES', 5, 1, 1, 'active'
FROM categories c
JOIN brands b ON b.slug = 'tiara-home'
WHERE c.slug = 'home';

INSERT IGNORE INTO products (
  category_id, brand_id, name, slug, sku, short_description, description,
  cash_price, compare_at_price, currency, low_stock_threshold,
  is_featured, is_active, status
)
SELECT c.id, b.id,
  'DEMO Scented Candle', 'demo-scented-candle', 'DEMO-CANDLE-001',
  'Demo low-stock item. Safe to edit or archive.',
  'Demo catalogue item. Safe to edit or archive. Not a real product listing.',
  750.00, NULL, 'KES', 5, 0, 1, 'active'
FROM categories c
JOIN brands b ON b.slug = 'tiara-home'
WHERE c.slug = 'home';

INSERT IGNORE INTO products (
  category_id, brand_id, name, slug, sku, short_description, description,
  cash_price, compare_at_price, currency, low_stock_threshold,
  is_featured, is_active, status
)
SELECT c.id, b.id,
  'DEMO Archived Bowl', 'demo-archived-bowl', 'DEMO-BOWL-ARCHIVED',
  'Demo archived item. It must not appear on the public catalogue.',
  'Demo catalogue item. Safe to edit or archive. Not a real product listing.',
  300.00, NULL, 'KES', 5, 0, 0, 'archived'
FROM categories c
JOIN brands b ON b.slug = 'everyday-essentials'
WHERE c.slug = 'cookware';

INSERT INTO inventory (product_id, on_hand, reserved)
SELECT p.id, 20, 0 FROM products p
WHERE p.sku = 'DEMO-PLATE-001'
AND NOT EXISTS (SELECT 1 FROM inventory i WHERE i.product_id = p.id);

INSERT INTO inventory (product_id, on_hand, reserved)
SELECT p.id, 8, 0 FROM products p
WHERE p.sku = 'DEMO-THROW-001'
AND NOT EXISTS (SELECT 1 FROM inventory i WHERE i.product_id = p.id);

INSERT INTO inventory (product_id, on_hand, reserved)
SELECT p.id, 2, 0 FROM products p
WHERE p.sku = 'DEMO-CANDLE-001'
AND NOT EXISTS (SELECT 1 FROM inventory i WHERE i.product_id = p.id);

INSERT INTO inventory (product_id, on_hand, reserved)
SELECT p.id, 0, 0 FROM products p
WHERE p.sku = 'DEMO-BOWL-ARCHIVED'
AND NOT EXISTS (SELECT 1 FROM inventory i WHERE i.product_id = p.id);

INSERT INTO inventory_movements (product_id, movement_type, quantity_change, reference_type, reason)
SELECT p.id, 'opening_stock', 20, 'seed', 'Demo opening stock'
FROM products p
WHERE p.sku = 'DEMO-PLATE-001'
AND NOT EXISTS (
  SELECT 1 FROM inventory_movements m
  WHERE m.product_id = p.id AND m.reference_type = 'seed'
);

INSERT INTO inventory_movements (product_id, movement_type, quantity_change, reference_type, reason)
SELECT p.id, 'opening_stock', 8, 'seed', 'Demo opening stock'
FROM products p
WHERE p.sku = 'DEMO-THROW-001'
AND NOT EXISTS (
  SELECT 1 FROM inventory_movements m
  WHERE m.product_id = p.id AND m.reference_type = 'seed'
);

INSERT INTO inventory_movements (product_id, movement_type, quantity_change, reference_type, reason)
SELECT p.id, 'opening_stock', 2, 'seed', 'Demo opening stock'
FROM products p
WHERE p.sku = 'DEMO-CANDLE-001'
AND NOT EXISTS (
  SELECT 1 FROM inventory_movements m
  WHERE m.product_id = p.id AND m.reference_type = 'seed'
);

INSERT IGNORE INTO promotions (
  name, code, type, value, minimum_order_amount, usage_limit, usage_count, is_active
) VALUES (
  'DEMO Welcome 10', 'WELCOME10', 'percentage', 10.00, 0.00, 100, 0, 1
);

INSERT IGNORE INTO site_content (slug, title, body, sort_order, is_active) VALUES
(
  'home_announcement',
  'Welcome to Tiara Wishes',
  'Household and lifestyle goods, sold as a normal cash purchase.',
  1,
  1
),
(
  'chama_teaser',
  'Digital Chamas',
  'Digital Chamas are not available in this release. You can shop with a normal cash purchase. Group contributions, rotation, and Chama checkout are not implemented.',
  2,
  1
);

INSERT IGNORE INTO site_content (slug, entry_type, title, body, sort_order, is_active) VALUES
('contact_email', 'setting', 'contact_email', 'hello@tiarawishes.example', 0, 1),
('contact_phone', 'setting', 'contact_phone', '+254700000000', 0, 1),
('social_facebook', 'setting', 'social_facebook', '', 0, 1),
('social_instagram', 'setting', 'social_instagram', '', 0, 1),
('currency', 'setting', 'currency', 'KES', 0, 1),
('delivery_fee_kes', 'setting', 'delivery_fee_kes', '', 0, 1),
('free_delivery_threshold_kes', 'setting', 'free_delivery_threshold_kes', '', 0, 1);
