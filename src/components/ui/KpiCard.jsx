export default function KpiCard({ label, value, sub, icon: Icon, iconBg, iconColor, centered = false, className = '' }) {
  const displayValue = value ?? 0
  return (
    <div className={`premium-kpi group p-4 sm:p-5 ${centered ? 'text-center' : ''} ${className}`}>
      {centered ? (
        <>
          {Icon && (
            <div className={`p-2 rounded-lg ${iconBg} inline-flex mb-2`}>
              <Icon size={18} className={iconColor} />
            </div>
          )}
          <div className="text-2xl font-black text-slate-800 count-up">{displayValue}</div>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1">{label}</div>
          {sub && <span className="text-[11px] text-slate-500 mt-0.5 block">{sub}</span>}
        </>
      ) : (
        <>
          <div className="flex justify-between items-start">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">{label}</span>
            {Icon && (
              <div className={`p-2 rounded-lg ${iconBg}`}>
                <Icon size={16} className={iconColor} />
              </div>
            )}
          </div>
          <div className="count-up mt-2 text-2xl font-black tracking-[-0.04em] text-slate-900 sm:text-3xl">{displayValue}</div>
          {sub && <span className="text-[11px] text-slate-500 mt-1 block">{sub}</span>}
        </>
      )}
    </div>
  )
}
