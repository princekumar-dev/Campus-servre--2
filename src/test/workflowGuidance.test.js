import { describe, expect, it } from 'vitest'
import { getRoleActionStatuses, getWorkflowGuidance, getWorkflowPhase } from '../utils/workflowGuidance'

describe('workflow guidance', () => {
  it('directs managers to diagnosis before quotation', () => {
    expect(getWorkflowGuidance('ASSIGNED_TO_MANAGER', 'manager')).toMatchObject({ tab: 'Diagnosis', isMyTurn: true, title: 'Inspect and scope the request' })
  })

  it('keeps active workflow statuses actionable', () => {
    expect(getWorkflowGuidance('CLARIFICATION_REQUIRED', 'staff')).toMatchObject({ tab: 'Overview', isMyTurn: true })
    expect(getWorkflowGuidance('TECHNICIAN_COMPLETED', 'hod')).toMatchObject({ tab: 'Overview', isMyTurn: true })
  })

  it('sends completed requests to history without an owner', () => {
    expect(getWorkflowGuidance('CLOSED', 'admin')).toMatchObject({ tab: 'History', isMyTurn: false, ownerLabel: null })
  })

  it('groups statuses into the full service workflow phases', () => {
    expect(getWorkflowPhase('SUBMITTED')?.key).toBe('review')
    expect(getWorkflowPhase('QUOTATION_IN_PROGRESS')?.key).toBe('quotation')
    expect(getWorkflowPhase('WORK_ORDER_CREATED')?.key).toBe('order')
  })

  it('builds role-specific action queues', () => {
    expect(getRoleActionStatuses('admin')).toEqual(['SUBMITTED'])
    expect(getRoleActionStatuses('manager')).toContain('ASSIGNED_TO_MANAGER')
    expect(getRoleActionStatuses('manager')).toContain('QUOTATION_IN_PROGRESS')
  })
})
