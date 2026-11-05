import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { getHome } from '../../api/catalog'
import Footer from './Footer'
import Header from './Header'

export default function StoreLayout() {
  const [home, setHome] = useState(null)
  const [homeState, setHomeState] = useState('loading')

  useEffect(() => {
    let active = true
    getHome()
      .then((body) => {
        if (!active) return
        setHome(body.data)
        setHomeState('ready')
      })
      .catch(() => {
        if (!active) return
        setHome(null)
        setHomeState('error')
      })
    return () => {
      active = false
    }
  }, [])

  const announcement = home?.blocks?.find((block) => block.slug === 'home_announcement')
  return (
    <div className="flex min-h-screen flex-col">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header announcement={announcement?.body} />
      <main id="main" className="flex-1">
        <Outlet context={{ home, homeState }} />
      </main>
      <Footer settings={home?.settings} />
    </div>
  )
}
