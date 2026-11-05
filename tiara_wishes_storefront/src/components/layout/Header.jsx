import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listCategories } from '../../api/catalog'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { IconCart, IconMenu, IconSearch, IconUser } from '../common/Icons'
import CategoryBar from './CategoryBar'
import MobileNavigation from './MobileNavigation'

export default function Header({ announcement }) {
  const { user } = useAuth()
  const { count } = useCart()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [categories, setCategories] = useState([])

  useEffect(() => {
    let active = true
    listCategories()
      .then((body) => {
        if (active) setCategories(body.data || [])
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  function onSearch(event) {
    event.preventDefault()
    const term = query.trim()
    navigate(term ? `/shop?q=${encodeURIComponent(term)}` : '/shop')
    setSearchOpen(false)
  }

  return (
    <header className="site-header">
      <div className="announce" aria-label="Announcement">
        <p className="announce-track">
          <span>{announcement || 'Quality home essentials · Shop with confidence'}</span>
          <span aria-hidden="true">{announcement || 'Quality home essentials · Shop with confidence'}</span>
        </p>
      </div>
      <div className="shell header-row">
        <Link to="/" className="brand-lockup" aria-label="Tiara Wishes home">
          <span className="spark" aria-hidden="true">✦</span>
          <span>
            <span className="wordmark">Tiara Wishes</span>
            <span className="tagline">Make home feel like yours</span>
          </span>
        </Link>
        <form onSubmit={onSearch} className="search-pill hidden md:flex" role="search">
          <label className="sr-only" htmlFor="desktop-search">
            Search products
          </label>
          <input
            id="desktop-search"
            placeholder="Search for fridge, dispenser, cooker..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button className="btn" type="submit">Search</button>
        </form>
        <div className="header-actions">
          <button type="button" className="icon-btn md:hidden" aria-label="Search" onClick={() => setSearchOpen((value) => !value)}>
            <IconSearch />
          </button>
          <Link to="/chamas" className="pts-pill hidden sm:inline-flex">
            Rewards
          </Link>
          <Link to={user ? '/account' : '/login'} className="icon-btn" aria-label={user ? 'Account' : 'Sign in'}>
            <IconUser />
          </Link>
          <Link to="/cart" className="icon-btn" aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}>
            <IconCart />
            <span className="cart-count">{count}</span>
          </Link>
          <button type="button" className="icon-btn md:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
            <IconMenu />
          </button>
        </div>
      </div>
      {searchOpen ? (
        <form onSubmit={onSearch} className="shell pb-3 md:hidden" role="search">
          <label className="sr-only" htmlFor="mobile-search">
            Search products
          </label>
          <div className="search-pill">
            <input
              id="mobile-search"
              placeholder="Search for fridge, dispenser, cooker..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button className="btn" type="submit">Search</button>
          </div>
        </form>
      ) : null}
      <CategoryBar categories={categories} />
      <MobileNavigation open={open} onClose={() => setOpen(false)} categories={categories} />
    </header>
  )
}
