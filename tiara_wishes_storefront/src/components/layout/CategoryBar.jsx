import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import { CategoryIcon } from '../catalog/ProductCard'

function CategoryBranch({ category, onPick, depth = 0 }) {
  return (
    <div className={depth ? 'cat-nested' : 'cat-branch'}>
      <NavLink to={`/categories/${category.slug}`} onClick={onPick}>
        {category.name}
      </NavLink>
      {category.children?.map((child) => (
        <CategoryBranch key={child.id} category={child} onPick={onPick} depth={depth + 1} />
      ))}
    </div>
  )
}

function menuPosition(button) {
  const rect = button?.getBoundingClientRect()
  if (!rect) return null
  const width = 240
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)
  return { top: `${rect.bottom + 6}px`, left: `${left}px`, width: `${width}px` }
}

function CategoryItem({ category, open, onOpen, onClose }) {
  const buttonRef = useRef(null)
  const [menuStyle, setMenuStyle] = useState(null)
  const hasChildren = Boolean(category.children?.length)

  useEffect(() => {
    if (!open) return undefined
    function place() {
      setMenuStyle(menuPosition(buttonRef.current))
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  function keepOpen(event) {
    const menu = document.getElementById(`cat-menu-${category.id}`)
    if (menu?.contains(event.relatedTarget) || buttonRef.current?.contains(event.relatedTarget)) return
    onClose()
  }

  const menu = hasChildren && open && menuStyle
    ? createPortal(
        <div id={`cat-menu-${category.id}`} className="cat-menu" style={menuStyle} onMouseLeave={keepOpen}>
          <NavLink className="cat-menu-all" to={`/categories/${category.slug}`} onClick={onClose}>
            All {category.name}
          </NavLink>
          {category.children.map((child) => (
            <CategoryBranch key={child.id} category={child} onPick={onClose} />
          ))}
        </div>,
        document.body,
      )
    : null

  return (
    <div className={open ? 'cat-item is-open' : 'cat-item'} onMouseEnter={() => (hasChildren ? onOpen(category.id) : onClose())} onMouseLeave={keepOpen}>
      {hasChildren ? (
        <button
          ref={buttonRef}
          type="button"
          className="cat-link"
          aria-expanded={open}
          aria-haspopup="true"
          onClick={() => (open ? onClose() : onOpen(category.id))}
        >
          <span className="cat-icon"><CategoryIcon category={category} /></span>
          <span>{category.name}</span>
        </button>
      ) : (
        <NavLink ref={buttonRef} to={`/categories/${category.slug}`} className="cat-link" onClick={onClose}>
          <span className="cat-icon"><CategoryIcon category={category} /></span>
          <span>{category.name}</span>
        </NavLink>
      )}
      {menu}
    </div>
  )
}

export default function CategoryBar({ categories }) {
  const location = useLocation()
  const [openId, setOpenId] = useState(null)
  const bar = useRef(null)
  const scroller = useRef(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  useEffect(() => {
    setOpenId(null)
  }, [location.pathname])

  useEffect(() => {
    function measure() {
      const element = scroller.current
      if (!element) return
      setCanLeft(element.scrollLeft > 4)
      setCanRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 4)
    }
    measure()
    const element = scroller.current
    if (!element) return undefined
    element.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      element.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [categories])

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') setOpenId(null)
    }
    function onPointer(event) {
      const menu = openId == null ? null : document.getElementById(`cat-menu-${openId}`)
      if (bar.current?.contains(event.target) || menu?.contains(event.target)) return
      setOpenId(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [openId])

  function move(direction) {
    scroller.current?.scrollBy({ left: direction * 180, behavior: 'smooth' })
  }

  const scrollable = canLeft || canRight

  return (
    <nav className="cat-strip" aria-label="Departments" ref={bar}>
      <div className="shell">
        {scrollable ? (
          <button type="button" className="cat-arrow" aria-label="Scroll categories left" disabled={!canLeft} onClick={() => move(-1)}>
            ‹
          </button>
        ) : null}
        <div className="cat-scroll" ref={scroller}>
          <NavLink to="/shop" end className="cat-link" onClick={() => setOpenId(null)}>Shop all</NavLink>
          {categories.map((category) => (
            <CategoryItem
              key={category.id}
              category={category}
              open={openId === category.id}
              onOpen={setOpenId}
              onClose={() => setOpenId(null)}
            />
          ))}
        </div>
        {scrollable ? (
          <button type="button" className="cat-arrow" aria-label="Scroll categories right" disabled={!canRight} onClick={() => move(1)}>
            ›
          </button>
        ) : null}
      </div>
    </nav>
  )
}
