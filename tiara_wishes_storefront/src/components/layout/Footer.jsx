import { Link } from 'react-router-dom'
import SocialAccounts from '../common/SocialAccounts'

export default function Footer({ settings }) {
  const email = settings?.contact_email
  const phone = settings?.contact_phone
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="shell grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="display text-2xl text-gold-soft">Tiara Wishes</p>
          <p className="mt-3 max-w-xs text-sm text-gold-soft">
            Household and lifestyle goods. Checkout in this release is a cash purchase.
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-gold-soft">Shop</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link to="/shop">All products</Link></li>
            <li><Link to="/cart">Cart</Link></li>
            <li><Link to="/chamas">Chamas, coming soon</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-gold-soft">Help</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link to="/about">About</Link></li>
            <li><Link to="/contact">Contact</Link></li>
            <li><Link to="/delivery-returns">Delivery and returns</Link></li>
            <li><Link to="/privacy">Privacy</Link></li>
            <li><Link to="/terms">Terms</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-gold-soft">Contact</p>
          <ul className="mt-3 space-y-2 text-sm">
            {email ? <li><a href={`mailto:${email}`}>{email}</a></li> : <li>Email is set in the store admin.</li>}
            {phone ? <li><a href={`tel:${phone}`}>{phone}</a></li> : null}
          </ul>
          <div className="mt-4">
            <SocialAccounts settings={settings} />
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="shell py-4 text-xs text-gold-soft">© {year} Tiara Wishes</p>
      </div>
    </footer>
  )
}
