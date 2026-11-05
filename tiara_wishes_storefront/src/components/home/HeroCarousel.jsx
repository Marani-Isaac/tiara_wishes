import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

function SlideAction({ action }) {
  const href = String(action.href || '').trim()
  if (!href) return null
  if (href.startsWith('/')) {
    return <Link to={href} className={action.tone || 'btn'}>{action.label}</Link>
  }
  if (!/^https?:\/\//i.test(href)) return null
  return (
    <a className={action.tone || 'btn'} href={href} target="_blank" rel="noreferrer">
      {action.label}
    </a>
  )
}

export default function HeroCarousel({ slides }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchX = useRef(0)
  const count = slides.length
  const current = count ? index % count : 0

  useEffect(() => {
    if (count < 2 || paused) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const timer = window.setTimeout(() => {
      setIndex((value) => (value + 1) % count)
    }, 6000)
    return () => window.clearTimeout(timer)
  }, [count, current, paused])

  function go(next) {
    if (!count) return
    setIndex((next + count) % count)
  }

  function onTouchStart(event) {
    touchX.current = event.changedTouches[0].clientX
  }

  function onTouchEnd(event) {
    const delta = event.changedTouches[0].clientX - touchX.current
    if (delta > 48) go(current - 1)
    if (delta < -48) go(current + 1)
  }

  if (!count) return null

  return (
    <section
      className="hero-carousel"
      aria-roledescription="carousel"
      aria-label="Store highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false)
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="hero-track" style={{ transform: `translateX(-${current * 100}%)` }}>
        {slides.map((slide, slideIndex) => {
          const Heading = slideIndex === current ? 'h1' : 'h2'
          return (
            <article
              key={slide.key}
              className={slide.image ? 'hero-slide' : 'hero-slide is-text'}
              aria-hidden={slideIndex !== current}
              inert={slideIndex !== current}
            >
              <div className="hero-copy">
                {slide.badge ? <p className="badge">{slide.badge}</p> : null}
                {slide.eyebrow ? <p className="eyebrow mt-2">{slide.eyebrow}</p> : null}
                <Heading className="display mt-3 text-3xl text-plum sm:text-4xl">{slide.title}</Heading>
                {slide.body ? <p className="hero-body mt-3 max-w-xl text-muted">{slide.body}</p> : null}
                {slide.actions?.length ? (
                  <div className="mt-6 flex flex-wrap gap-3">
                    {slide.actions.map((action) => (
                      <SlideAction key={action.label} action={action} />
                    ))}
                  </div>
                ) : null}
              </div>
              {slide.image ? <img className="hero-media" src={slide.image} alt={slide.alt || ''} /> : null}
            </article>
          )
        })}
      </div>
      {count > 1 ? (
        <>
          <button type="button" className="hero-nav hero-nav-prev" aria-label="Previous slide" onClick={() => go(current - 1)}>
            ‹
          </button>
          <button type="button" className="hero-nav hero-nav-next" aria-label="Next slide" onClick={() => go(current + 1)}>
            ›
          </button>
          <div className="hero-dots">
            {slides.map((slide, slideIndex) => (
              <button
                key={slide.key}
                type="button"
                className={slideIndex === current ? 'hero-dot is-on' : 'hero-dot'}
                aria-label={`${slide.title}, slide ${slideIndex + 1} of ${count}`}
                aria-current={slideIndex === current ? 'true' : undefined}
                onClick={() => go(slideIndex)}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  )
}
