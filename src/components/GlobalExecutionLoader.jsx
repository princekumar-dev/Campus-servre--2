import { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { useLocation } from 'react-router-dom'

function GlobalExecutionLoader() {
  const [apiCount, setApiCount] = useState(0)
  const [navActive, setNavActive] = useState(false)
  const [percent, setPercent] = useState(0)
  const location = useLocation()

  useEffect(() => {
    setNavActive(true)
    setPercent(20)

    const t1 = setTimeout(() => setPercent(55), 100)
    const t2 = setTimeout(() => setPercent(85), 250)
    const t3 = setTimeout(() => {
      setPercent(100)
      setNavActive(false)
      const t4 = setTimeout(() => setPercent(0), 350)
      return () => clearTimeout(t4)
    }, 500)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [location.key, location.pathname, location.search])

  useEffect(() => {
    let safetyTimer = null

    const handleProgress = (e) => {
      const count = e.detail?.count || 0

      if (safetyTimer) clearTimeout(safetyTimer)

      setApiCount(count)

      if (count > 0) {
        setPercent((prev) => (prev < 40 ? 50 : prev < 75 ? prev + 10 : 85))

        safetyTimer = setTimeout(() => {
          setApiCount(0)
          setPercent(100)
          setTimeout(() => setPercent(0), 400)
        }, 25000)
      } else {
        setPercent(100)
        const timer = setTimeout(() => setPercent(0), 400)
        return () => clearTimeout(timer)
      }
    }

    window.addEventListener('apiProgress', handleProgress)
    return () => {
      window.removeEventListener('apiProgress', handleProgress)
      if (safetyTimer) clearTimeout(safetyTimer)
    }
  }, [])

  useEffect(() => {
    if (apiCount === 0 && !navActive) return

    const interval = setInterval(() => {
      setPercent((prev) => {
        if (prev >= 95) return 95
        const step = prev < 50 ? 5 : prev < 80 ? 2 : 1
        return prev + step
      })
    }, 450)

    return () => clearInterval(interval)
  }, [apiCount, navActive])

  const isVisible = apiCount > 0 || navActive || percent > 0

  if (!isVisible) return null

  return ReactDOM.createPortal(
    <>
      <style>{`
        @keyframes violetShimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .violet-top-loader {
          position: fixed;
          top: 0;
          left: 0;
          height: 3px;
          z-index: 99999;
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease;
          background: linear-gradient(90deg, #7c3aed, #c4b5fd, #6d28d9, #7c3aed);
          background-size: 300% 100%;
          animation: violetShimmer 2s linear infinite;
          box-shadow: 0 0 10px rgba(124, 58, 237, 0.8), 0 0 18px rgba(109, 40, 217, 0.5);
        }
        .violet-screen-glow {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 99998;
          pointer-events: none;
          opacity: 0.15;
          background: radial-gradient(circle at top, rgba(124,58,237,0.22) 0%, rgba(124,58,237,0.06) 50%, transparent 80%);
          animation: violetPulse 2.5s ease-in-out infinite alternate;
          transition: opacity 0.5s ease;
        }
        @keyframes violetPulse {
          0% { opacity: 0.10; }
          100% { opacity: 0.25; }
        }
        .processing-tag {
          position: fixed;
          bottom: 32px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 99999;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 18px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(124, 58, 237, 0.4);
          box-shadow: 0 8px 32px rgba(124, 58, 237, 0.18), 0 2px 10px rgba(0,0,0,0.06);
          font-size: 13px;
          font-weight: 600;
          color: #6d28d9;
          animation: slideUpFade 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @media (max-width: 768px) {
          .processing-tag {
            bottom: 84px;
            padding: 6px 16px;
            font-size: 12px;
          }
        }
        @keyframes slideUpFade {
          from { transform: translate(-50%, 20px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        .violet-spin-micro {
          width: 12px;
          height: 12px;
          border: 2px solid rgba(124, 58, 237, 0.2);
          border-top: 2px solid #7c3aed;
          border-radius: 50%;
          animation: spinMicro 0.8s linear infinite;
        }
        @keyframes spinMicro {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <div
        className="violet-top-loader"
        style={{
          width: `${percent}%`,
          opacity: percent > 0 && percent < 100 ? 1 : 0
        }}
      />

      {apiCount > 0 && <div className="violet-screen-glow" />}

      {apiCount > 0 && (
        <div className="processing-tag">
          <div className="violet-spin-micro" />
          <span>Processing...</span>
        </div>
      )}
    </>,
    document.body
  )
}

export default GlobalExecutionLoader
