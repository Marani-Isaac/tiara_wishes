import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import ProductRequestForm from '../components/contact/ProductRequestForm'
import PromoRail from '../components/common/PromoRail'
import SocialAccounts from '../components/common/SocialAccounts'

const SERVE = [
  'Young professionals building their homes.',
  'Newly married couples setting up their households.',
  'Families looking to furnish, upgrade, or improve their living spaces.',
  'Individuals seeking convenient and flexible purchasing options.',
  'Chamas, SACCOs, churches, and other organized community groups.',
  'Small businesses and organizations with household-product purchasing needs.',
]

const REASONS = [
  {
    title: 'Flexible payments',
    body: 'Choose a purchasing arrangement that works with your financial routine through daily, weekly, or monthly Chamas.',
  },
  {
    title: 'Community savings',
    body: 'Work towards your household goals through structured Chamas that bring people together to save and acquire products.',
  },
  {
    title: 'Affordable access',
    body: 'Explore household products with purchasing options designed around different budgets and financial capacities.',
  },
  {
    title: 'Convenient shopping',
    body: 'Discover a variety of household products in one digital destination, making it easier to find what your home needs.',
  },
]

const PROBLEMS = [
  {
    title: 'High upfront costs',
    body: 'Not everyone can comfortably afford to pay the full price of a major household product at once. Structured Chamas let customers work towards a purchase through planned contributions.',
  },
  {
    title: 'Limited purchasing flexibility',
    body: 'A normal purchase often requires immediate full payment. Daily, weekly, and monthly Chamas are the alternative arrangements for different financial routines.',
  },
  {
    title: 'Difficulty saving towards household goals',
    body: 'Saving without a clear goal can be challenging. Product-based Chamas give customers a structured way to save towards a specific household product.',
  },
]

export default function AboutPage() {
  const { home } = useOutletContext() || {}
  return (
    <article className="shell py-10">
      <header className="max-w-3xl">
        <p className="eyebrow">About</p>
        <h1 className="display mt-2 text-3xl text-plum sm:text-4xl">About Tiara Wishes</h1>
        <p className="mt-4 text-lg text-muted">
          The bridge between the home you have, and the home you imagine.
        </p>
        <div className="mt-5">
          <SocialAccounts settings={home?.settings} label="Call, WhatsApp, and social" />
        </div>
      </header>

      <section className="panel mt-8 p-6 sm:p-8">
        <h2 className="display text-2xl text-plum">Who we are</h2>
        <p className="mt-3 max-w-3xl text-muted">
          Tiara Wishes is a retail company specializing in major household products, and offers customers two convenient ways to shop: direct cash purchases and group-savings or commercial Chamas.
        </p>
        <p className="mt-3 max-w-3xl text-muted">
          At Tiara Wishes, you will find a digital house with a stylish collection of kitchen essentials, bedroom luxuries, and cozy sitting-room must-haves to turn your dream home into a reality.
        </p>
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="panel p-6">
          <h2 className="display text-2xl text-plum">Our vision</h2>
          <p className="mt-3 text-muted">To make quality household products affordable through community savings and digital Chamas.</p>
        </section>
        <section className="panel p-6">
          <h2 className="display text-2xl text-plum">Our mission</h2>
          <p className="mt-3 text-muted">To empower households by combining technology, structured savings, and trusted retail into one convenient shopping experience.</p>
        </section>
      </div>

      <section className="panel mt-4 p-6 sm:p-8">
        <h2 className="display text-2xl text-plum">What we do</h2>
        <p className="mt-3 max-w-3xl text-muted">
          We bring together household retail, convenient shopping, and flexible payment options to make acquiring quality home products easier.
        </p>
        <p className="mt-3 max-w-3xl text-muted">
          Through a combination of direct purchases and structured community savings known as Chamas, customers can choose a purchasing arrangement that suits their needs and financial routines. Whether you prefer to purchase an item outright or contribute towards it over time, Tiara Wishes provides a convenient way to shop for the things that make a house a home.
        </p>
        <p className="mt-4 text-sm text-muted">
          Cash purchase is the checkout open in the shop today.{' '}
          <Link to="/chamas" className="font-semibold text-gold-deep">Chama arrangements</Link>
          {' '}are not available to join or pay with yet.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="display text-2xl text-plum">Who we serve</h2>
        <p className="mt-3 max-w-3xl text-muted">
          We serve individuals, households, and organized communities looking for more accessible ways to acquire quality household products.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {SERVE.map((item) => (
            <li key={item} className="panel px-4 py-3 text-sm">{item}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="display text-2xl text-plum">Why choose Tiara Wishes</h2>
        <p className="mt-3 max-w-3xl text-muted">
          We understand that different customers have different purchasing preferences and financial capabilities. Our approach gives you more flexibility and choice.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {REASONS.map((item) => (
            <section key={item.title} className="panel p-5">
              <h3 className="font-semibold text-plum">{item.title}</h3>
              <p className="mt-2 text-sm text-muted">{item.body}</p>
            </section>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="display text-2xl text-plum">What problems we solve</h2>
        <p className="mt-3 max-w-3xl text-muted">We recognize that acquiring quality household products can sometimes be challenging.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {PROBLEMS.map((item) => (
            <section key={item.title} className="panel p-5">
              <h3 className="font-semibold text-plum">{item.title}</h3>
              <p className="mt-2 text-sm text-muted">{item.body}</p>
            </section>
          ))}
        </div>
      </section>

      <section className="panel mt-10 p-6 sm:p-8">
        <h2 className="display text-2xl text-plum">Our promise</h2>
        <p className="mt-3 max-w-3xl text-muted">
          At Tiara Wishes, we are committed to making household shopping more accessible, convenient, and rewarding.
        </p>
        <p className="mt-3 max-w-3xl text-muted">
          From the smallest kitchen essential to the major purchases that transform your living space, we want to make your journey towards a better home easier.
        </p>
        <p className="display mt-6 text-xl text-plum">
          Tiara Wishes — the bridge between the home you have, and the home you imagine.
        </p>
        <Link to="/shop" className="btn mt-6">Shop home essentials</Link>
      </section>
    </article>
  )
}

export function ContactPage() {
  const { home } = useOutletContext() || {}
  const [params] = useSearchParams()
  const settings = home?.settings || {}
  const email = settings.contact_email
  const phone = settings.contact_phone
  const whatsapp = settings.contact_whatsapp
  return (
    <article className="shell py-10">
      <p className="eyebrow">Contact</p>
      <h1 className="display mt-2 text-3xl text-plum">Talk to the shop</h1>
      <p className="mt-3 max-w-2xl text-muted">Request an item the catalogue does not have, or use the contact details published by the store.</p>
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)]">
        <ProductRequestForm storeEmail={email} presetName={params.get('product') || ''} />
        <div className="grid gap-4">
          <div className="panel space-y-4 p-5">
            <SocialAccounts settings={settings} label="Call, WhatsApp, and social" />
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-semibold">Email</dt>
                <dd>{email ? <a className="text-gold-deep" href={`mailto:${email}`}>{email}</a> : 'Not published yet.'}</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold">Phone</dt>
                <dd>{phone ? <a className="text-gold-deep" href={`tel:${phone}`}>{phone}</a> : 'Not published yet.'}</dd>
              </div>
              {whatsapp ? (
                <div>
                  <dt className="text-sm font-semibold">WhatsApp</dt>
                  <dd><a className="text-gold-deep" href={`https://wa.me/${String(whatsapp).replace(/\D/g, '')}`}>Message the shop</a></dd>
                </div>
              ) : null}
            </dl>
          </div>
          <section className="panel overflow-hidden">
            <iframe
              title="Map of Kenya, where Tiara Wishes sells"
              className="h-56 w-full border-0"
              src="https://www.openstreetmap.org/export/embed.html?bbox=33.9%2C-4.7%2C41.9%2C5.0&layer=mapnik"
            />
            <p className="p-4 text-sm text-muted">Tiara Wishes sells in Kenya. A street pin appears here when the store publishes an address.</p>
          </section>
          <PromoRail promotions={home?.hovering_promotions || []} products={home?.featured_products || []} />
        </div>
      </div>
    </article>
  )
}

export function ChamaComingSoonPage() {
  const { home } = useOutletContext() || {}
  const block = home?.blocks?.find((item) => item.slug === 'chama_teaser')
  return (
    <article className="shell max-w-3xl py-10">
      <p className="badge">Coming soon</p>
      <h1 className="display mt-4 text-3xl">{block?.title || 'Digital Chamas'}</h1>
      <p className="mt-4 text-lg text-muted">
        {block?.body || home?.chama?.message || 'Tiara Wishes intends to introduce a group-savings Chama purchasing option. It is not available in this release.'}
      </p>
      <ul className="mt-6 space-y-2 text-muted">
        <li>You cannot join a Chama, contribute, or pay daily, weekly, or monthly here.</li>
        <li>There is no member position, allocation date, or stored wallet.</li>
        <li>Shopping in this release is a cash purchase only.</li>
      </ul>
      <Link to="/contact" className="btn mt-6">Contact the shop</Link>
    </article>
  )
}

const POLICIES = {
  delivery: {
    title: 'Delivery and returns',
    body: 'Placeholder copy for the owner to approve. Delivery fees and any return rules are confirmed by the store at checkout and on the order. This page does not promise a delivery time.',
  },
  privacy: {
    title: 'Privacy',
    body: 'Placeholder copy for the owner to approve. The shop account stores the name, email, optional phone, delivery addresses, and orders needed to complete a cash purchase. Replace this note with the approved privacy notice before launch.',
  },
  terms: {
    title: 'Terms',
    body: 'Placeholder copy for the owner to approve. Orders, prices, stock, and payment status are decided by the store. A payment is paid only after the store confirms it. Replace this note with the approved terms before launch.',
  },
}

export function PolicyPage({ kind }) {
  const policy = POLICIES[kind]
  return (
    <article className="shell max-w-3xl py-10">
      <p className="eyebrow">Policy</p>
      <h1 className="display mt-2 text-3xl">{policy.title}</h1>
      <p className="mt-4 text-lg text-muted">{policy.body}</p>
    </article>
  )
}

export function NotFoundPage() {
  return (
    <div className="shell py-20 text-center">
      <p className="eyebrow">404</p>
      <h1 className="display mt-3 text-4xl">That page is not in the shop</h1>
      <Link to="/" className="btn mt-6">Back home</Link>
    </div>
  )
}
