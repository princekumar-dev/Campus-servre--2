export default function GlassPanel({ children, className = '', padding = 'p-6', hover = false }) {
  return (
    <div className={`premium-card ${padding} ${hover ? 'hover:translate-y-[-2px]' : ''} ${className}`}>
      {children}
    </div>
  )
}
