import { useState, useEffect } from 'react'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { Landmark, TrendingUp, ShieldCheck, Users } from 'lucide-react'
import { PageHeader } from '../components/ui'

function Reports() {
  const [stats, setStats] = useState({
    totalRequests: 0,
    totalExpenses: 0,
    totalQuotations: 0,
    closed: 0
  })
  const [categoryData, setCategoryData] = useState([])
  const [departmentData, setDepartmentData] = useState([])
  const [technicianData, setTechnicianData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const { showError } = useAlert()

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        const res = await apiClient.get('/api/reports')
        if (res.success) {
          setStats(res.stats)
          if (res.charts) {
            setCategoryData(res.charts.categoryData || [])
            setDepartmentData(res.charts.departmentData || [])
            setTechnicianData(res.charts.technicianData || [])
          }
        }
      } catch (err) {
        showError('Load Error', 'Failed to retrieve reports data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchReportData()
  }, [showError])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="premium-spinner"></div>
      </div>
    )
  }

  const maxCategoryVal = categoryData.length > 0 ? Math.max(...categoryData.map(c => c.value)) : 1
  const maxDeptCost = departmentData.length > 0 ? Math.max(...departmentData.map(d => d.cost)) : 1

  return (
    <div className="space-y-8 page-enter text-left">
      <PageHeader
        title="Reports & Financial Analytics"
        subtitle="Institutional overview of service expenditure, operations, and technician tasks"
      />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="premium-card p-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Expenditure</span>
            <span className="text-2xl font-black text-slate-800 mt-2 block">₹{stats.totalExpenses.toFixed(2)}</span>
            <span className="text-xs text-slate-500 mt-1 block">Cleared payments</span>
          </div>
          <div className="p-4 bg-emerald-50 rounded-xl text-emerald-600">
            <Landmark size={24} />
          </div>
        </div>

        <div className="premium-card p-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Approved Budget</span>
            <span className="text-2xl font-black text-slate-800 mt-2 block">₹{stats.totalQuotations.toFixed(2)}</span>
            <span className="text-xs text-slate-500 mt-1 block">Estimated quotation totals</span>
          </div>
          <div className="p-4 bg-violet-50 rounded-xl text-violet-600">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="premium-card p-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Request Resolution Rate</span>
            <span className="text-2xl font-black text-slate-800 mt-2 block">
              {stats.totalRequests > 0 ? Math.round((stats.closed / stats.totalRequests) * 100) : 0}%
            </span>
            <span className="text-xs text-slate-500 mt-1 block">{stats.closed} resolved of {stats.totalRequests}</span>
          </div>
          <div className="p-4 bg-indigo-50 rounded-xl text-indigo-650">
            <ShieldCheck size={24} />
          </div>
        </div>
      </div>

      {/* Main Charts & Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Cost by Department */}
        <div className="premium-card p-6 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100">Expenditure by Department</h3>
          
          <div className="space-y-4">
            {departmentData.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">No expenses recorded yet.</div>
            ) : (
              departmentData.map((d, idx) => {
                const percent = Math.round((d.cost / maxDeptCost) * 100)
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium text-slate-700">
                      <span>{d.name}</span>
                      <span className="font-bold">₹{d.cost.toFixed(2)}</span>
                    </div>
                    <div className="w-full h-2 rounded bg-slate-100 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded" style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Requests by Category */}
        <div className="premium-card p-6 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100">Request Category Distribution</h3>
          
          <div className="space-y-4">
            {categoryData.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">No requests filed yet.</div>
            ) : (
              categoryData.map((c, idx) => {
                const percent = Math.round((c.value / maxCategoryVal) * 100)
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium text-slate-700">
                      <span>{c.name}</span>
                      <span className="font-bold">{c.value} requests</span>
                    </div>
                    <div className="w-full h-2 rounded bg-slate-100 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded" style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Technician Performance Logs */}
        <div className="premium-card p-6 space-y-4 lg:col-span-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center space-x-2">
            <Users size={16} />
            <span>Technician Task Logs</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-750">
              <thead>
                <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
                  <th className="pb-2">Technician Name</th>
                  <th className="pb-2 text-right">Assigned Tasks</th>
                  <th className="pb-2 text-right">Completed Tasks</th>
                  <th className="pb-2 text-right">Completion Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {technicianData.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-6 text-center text-slate-400 text-xs">No technician logs compiled.</td>
                  </tr>
                ) : (
                  technicianData.map((t, idx) => {
                    const rate = t.assigned > 0 ? Math.round((t.completed / t.assigned) * 100) : 0
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 font-semibold text-slate-800">{t.name}</td>
                        <td className="py-2.5 text-right">{t.assigned}</td>
                        <td className="py-2.5 text-right">{t.completed}</td>
                        <td className="py-2.5 text-right font-bold text-violet-650">{rate}%</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  )
}

export default Reports
