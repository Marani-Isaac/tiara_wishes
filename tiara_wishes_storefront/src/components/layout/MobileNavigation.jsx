import { NavLink } from 'react-router-dom'
import { CategoryIcon } from '../catalog/ProductCard'
import { IconClose } from '../common/Icons'

function DrawerCategories({ categories, onClose, depth = 0 }) {
  return categories.map((category) => (
    <div key={category.id} className={depth ? 'drawer-nested' : undefined}>
      <NavLink to={`/categories/${category.slug}`} className="nav-link drawer-cat" onClick={onClose}>
        {depth === 0 ? <span className="cat-icon"><CategoryIcon category={category} /></span> : null}
        <span>{category.name}</span>
      </NavLink>
      {category.children?.length ? (
        <DrawerCategories categories={category.children} onClose={onClose} depth={depth + 1} />
      ) : null}
    </div>
  ))
}

const links = [
  { to: '/shop', label: 'Shop' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
  { to: '/chamas', label: 'Chamas' },
]

export default function MobileNavigation({ open, onClose, categories = [] }) {
  if (!open) return null
  return (
    <div className="drawer md:hidden" onClick={onClose}>
      <div
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="display text-3xl">Menu</p>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close menu">
            <IconClose />
          </button>
        </div>
        <NavLink to="/shop" className="nav-link py-2 text-lg" onClick={onClose}>Shop all</NavLink>
        <DrawerCategories categories={categories} onClose={onClose} />
        {links.filter((link) => link.to !== '/shop').map((link) => (
          <NavLink key={link.to} to={link.to} className="nav-link py-2 text-lg" onClick={onClose}>
            {link.label}
          </NavLink>
        ))}
        <NavLink to="/account" className="nav-link py-2 text-lg" onClick={onClose}>
          Account
        </NavLink>
        <NavLink to="/cart" className="nav-link py-2 text-lg" onClick={onClose}>
          Cart
        </NavLink>
      </div>
    </div>
  )
}
