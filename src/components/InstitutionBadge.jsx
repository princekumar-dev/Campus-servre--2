import { INSTITUTIONS } from '../constants/institutions'

export default function InstitutionBadge({ institution, compact = false, className = '' }) {
  const item = INSTITUTIONS.find(entry => entry.id === institution) || INSTITUTIONS[0]

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2 py-1 font-black text-violet-700 ${compact ? 'text-[9px]' : 'text-[10px]'} ${className}`}
      title={`${item.name} institution`}
    >
      <span className={`flex items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-violet-100 ${compact ? 'h-4 w-4' : 'h-5 w-5'}`}>
        <img src={item.logo} alt="" className="h-full w-full object-contain p-0.5" />
      </span>
      {item.name}
    </span>
  )
}

