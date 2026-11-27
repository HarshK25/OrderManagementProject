import { Link } from 'react-router-dom'
import BrandLogo from './BrandLogo'

export default function Footer() {
  return (
    <footer className="mt-24 bg-[#111111] dark:bg-[#08090a] text-[#ffffff] border-t border-[#222222]">
      <div className="max-w-[1240px] mx-auto px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <BrandLogo size="md" inverted />
            <p className="text-sm text-[#9a9fa6] mt-3 max-w-sm leading-relaxed">
              Direct store and order operations. Pay via UPI, card, net banking, or cash on delivery. Track every dispatch step and download tax invoices directly from your order page.
            </p>
            <p className="font-mono text-xs text-[#6b6b6b] mt-5">
              Indiranagar, Bengaluru &middot; support@ordermanagement.example
            </p>
          </div>

          <div>
            <h3 className="font-mono text-[11px] uppercase tracking-wider text-[#9a9fa6] mb-3">Store</h3>
            <ul className="space-y-2.5 text-sm text-[#e5e5e5]">
              <li><Link to="/" className="hover:text-white underline-offset-4 hover:underline">Overview</Link></li>
              <li><Link to="/products" className="hover:text-white underline-offset-4 hover:underline">Catalog</Link></li>
              <li><Link to="/wishlist" className="hover:text-white underline-offset-4 hover:underline">Saved items</Link></li>
              <li><Link to="/cart" className="hover:text-white underline-offset-4 hover:underline">Cart</Link></li>
              <li><Link to="/sell" className="hover:text-white underline-offset-4 hover:underline">Become a Seller</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-mono text-[11px] uppercase tracking-wider text-[#9a9fa6] mb-3">Account</h3>
            <ul className="space-y-2.5 text-sm text-[#e5e5e5]">
              <li><Link to="/orders" className="hover:text-white underline-offset-4 hover:underline">Orders &amp; tracking</Link></li>
              <li><Link to="/addresses" className="hover:text-white underline-offset-4 hover:underline">Address book</Link></li>
              <li><Link to="/profile" className="hover:text-white underline-offset-4 hover:underline">Account summary</Link></li>
              <li><Link to="/admin/analytics" className="hover:text-white underline-offset-4 hover:underline">Admin desk</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[#222222] flex flex-wrap items-center justify-between gap-4 text-xs text-[#6b6b6b]">
          <span>© {new Date().getFullYear()} ShopVerse</span>
          <span className="font-mono">7-day return window &middot; Razorpay verified checkout</span>
        </div>
      </div>
    </footer>
  )
}
