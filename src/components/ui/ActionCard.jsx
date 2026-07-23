import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export default function ActionCard({ to, icon: Icon, iconBg = 'bg-violet-50', iconColor = 'text-violet-600', title, badge, badgeColor = 'bg-violet-100 text-violet-700', desc }) {
  return (
    <Link to={to} className="premium-action group">
      <div className={`premium-action-icon ${iconBg}`}>
        <Icon size={22} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-slate-800 text-[15px] tracking-tight">{title}</h3>
        {desc && <p className="text-sm text-slate-500 mt-0.5">{desc}</p>}
        {badge !== undefined && badge !== null && (
          <span className={`inline-flex items-center gap-1 mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${badgeColor}`}>
            {badge}
          </span>
        )}
      </div>
      <ChevronRight size={18} className="text-slate-300 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
    </Link>
  )
}
