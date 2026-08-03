import { describe, expect, it } from 'vitest'
import { getRoleActionStatuses, getWorkflowGuidance, getWorkflowPhase } from '../utils/workflowGuidance'

describe('workflow guidance', () => {
  it('directs managers to purchase-order generation', () => {
    expect(getWorkflowGuidance('ASSIGNED_TO_MANAGER', 'manager')).toMatchObject({ tab: 'Overview', isMyTurn: true, title: 'Generate the purchase order' })
  })

  it('treats removed legacy actions as read-only history', () => {
    expect(getWorkflowGuidance('CLARIFICATION_REQUIRED', 'staff')).toMatchObject({ tab: 'History', isMyTurn: false })
    expect(getWorkflowGuidance('TECHNICIAN_COMPLETED', 'hod')).toMatchObject({ tab: 'History', isMyTurn: false })
  })

  it('sends completed requests to history without an owner', () => {
    expect(getWorkflowGuidance('CLOSED', 'admin')).toMatchObject({ tab: 'History', isMyTurn: false, ownerLabel: null })
  })

  it('groups statuses into the simplified request-to-order process', () => {
    expect(getWorkflowPhase('SUBMITTED')?.key).toBe('review')
    expect(getWorkflowPhase('PURCHASE_ORDER_CREATED')?.key).toBe('order')
  })

  it('builds role-specific action queues', () => {
    expect(getRoleActionStatuses('admin')).toEqual(['SUBMITTED'])
    expect(getRoleActionStatuses('manager')).toEqual(['ASSIGNED_TO_MANAGER'])
  })
})
