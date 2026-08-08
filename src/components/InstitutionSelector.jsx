import { useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import { INSTITUTIONS } from '../constants/institutions'

export default function InstitutionSelector({ value, onChange, tone = 'glass' }) {
  const isLight = tone === 'light'
  const carouselRef = useRef(null)
  const loopItems = [...INSTITUTIONS, ...INSTITUTIONS, ...INSTITUTIONS]

  useEffect(() => {
    const carousel = carouselRef.current
    if (!carousel) return
    const middleItem = carousel.children[INSTITUTIONS.length + Math.max(0, INSTITUTIONS.findIndex(item => item.id === value))]
    if (middleItem) carousel.scrollLeft = middleItem.offsetLeft - (carousel.clientWidth - middleItem.offsetWidth) / 2
    // Position the loop once on mount. Later selections center the exact card
    // that was tapped, without pulling a user's swipe back to another copy.
  }, [])

  const keepCarouselLooping = () => {
    const carousel = carouselRef.current
    if (!carousel) return
    const segmentWidth = carousel.scrollWidth / 3
    if (carousel.scrollLeft < segmentWidth * 0.45) carousel.scrollLeft += segmentWidth
    else if (carousel.scrollLeft > segmentWidth * 1.55) carousel.scrollLeft -= segmentWidth
  }

  const institutionButton = (institution, key, mobile = false) => {
    const selected = value === institution.id
    return <button
      key={key}
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={event => {
        onChange(institution.id)
        if (mobile) {
          const carousel = carouselRef.current
          const item = event.currentTarget
          carousel?.scrollTo({ left: item.offsetLeft - (carousel.clientWidth - item.offsetWidth) / 2, behavior: 'smooth' })
        }
      }}
      className={`group relative flex shrink-0 flex-col items-center gap-2 text-center transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none ${mobile ? 'w-[100px] snap-center' : 'min-w-0'}`}
    >
      <span className={`relative flex h-[82px] max-w-[100px] items-center justify-center rounded-2xl border backdrop-blur-xl transition-all duration-200 ${institution.tileClass} ${selected
        ? 'border-violet-400 bg-white/90 shadow-[0_8px_24px_rgba(124,58,237,0.32)] ring-2 ring-violet-500'
        : isLight
          ? 'border-slate-200 bg-white/80 shadow-sm group-hover:border-violet-300 group-hover:shadow-md'
          : 'border-white/70 bg-white/70 shadow-[0_8px_22px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.85)] group-hover:border-violet-300 group-hover:bg-white/85'
      } group-focus-visible:ring-4 group-focus-visible:ring-violet-300/70`}>
        {selected && <span className="absolute -right-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white shadow-md ring-2 ring-white"><Check size={14} strokeWidth={3} /></span>}
        <img src={institution.logo} alt={`${institution.name} logo`} className={`max-h-[62px] max-w-[90px] object-contain drop-shadow-sm ${institution.logoClass}`} />
      </span>
      <span className={`flex min-h-8 items-start justify-center text-xs font-black leading-tight ${selected
        ? isLight ? 'text-violet-700' : 'text-violet-200 [text-shadow:0_1px_5px_rgba(15,23,42,0.95)]'
        : isLight ? 'text-slate-700' : 'text-white [text-shadow:0_1px_5px_rgba(15,23,42,0.95)]'
      }`}>{institution.name}</span>
    </button>
  }

  return (
    <fieldset className="min-w-0 max-w-full overflow-hidden">
      <legend className={`mb-4 block text-sm font-black tracking-wide ${isLight ? 'text-slate-700' : 'text-white [text-shadow:0_2px_7px_rgba(15,23,42,0.95)]'}`}>
        Choose your institution
      </legend>
      <div
        ref={carouselRef}
        onScroll={keepCarouselLooping}
        className="institution-swipe flex w-full max-w-full snap-x snap-mandatory gap-3 overflow-x-auto px-[calc(50%_-_50px)] pb-3 pt-3 sm:hidden"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        role="radiogroup"
        aria-label="Institution"
      >
        {loopItems.map((institution, index) => institutionButton(institution, `${institution.id}-${index}`, true))}
      </div>
      <div className="hidden grid-cols-5 gap-3 pt-3 sm:grid" role="radiogroup" aria-label="Institution">
        {INSTITUTIONS.map(institution => institutionButton(institution, institution.id))}
      </div>
    </fieldset>
  )
}
