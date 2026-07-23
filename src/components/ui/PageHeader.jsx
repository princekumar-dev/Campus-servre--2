const ROLE_LABELS = {
  admin: 'Administrator',
  super_admin: 'Super Admin',
  manager: 'Operations Manager',
  accounts: 'Accounts',
  vendor: 'Vendor Portal',
  gate: 'Gate Security',
  receiving_officer: 'Receiving Officer',
  technician: 'Technician',
  requester: 'Requester',
  hod: 'Head of Department',
  staff: 'Staff',
  delivery_person: 'Delivery',
}

export default function PageHeader({ title, subtitle, role, action, badge }) {
  const roleLabel = badge || ROLE_LABELS[role] || null

  return (
    <div className="page-header">
      <div>
        {roleLabel && (
          <span className="role-badge mb-2">{roleLabel}</span>
        )}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="page-header-action mt-2 min-w-0 sm:mt-0 sm:flex-shrink-0">{action}</div>}
    </div>
  )
}
