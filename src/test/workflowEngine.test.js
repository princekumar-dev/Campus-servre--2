import { describe, expect, it } from 'vitest'
import { WORKFLOW_TRANSITIONS, calculateSlaDueAt, canTransition, getWorkflowOwner } from '../../lib/workflowEngine'

describe('canonical service workflow', () => {
  it('supports the complete happy path', () => {
    const path = [
      'DRAFT', 'SUBMITTED', 'APPROVED', 'ASSIGNED_TO_MANAGER', 'QUOTATION_IN_PROGRESS',
      'QUOTATION_SUBMITTED', 'QUOTATION_APPROVED', 'TECHNICIAN_ASSIGNED', 'WORK_ACCEPTED',
      'IN_PROGRESS', 'TECHNICIAN_COMPLETED', 'SERVICE_VERIFIED', 'INVOICE_IN_PROGRESS',
      'INVOICE_SUBMITTED', 'PAYMENT_PENDING', 'PARTIALLY_PAID', 'CLOSED',
    ]
    path.slice(0, -1).forEach((status, index) => expect(canTransition(status, path[index + 1])).toBe(true))
  })

  it('supports documented recovery paths', () => {
    expect(canTransition('WORK_DECLINED', 'TECHNICIAN_ASSIGNED')).toBe(true)
    expect(canTransition('QUOTATION_REJECTED', 'QUOTATION_IN_PROGRESS')).toBe(true)
    expect(canTransition('INVOICE_REJECTED', 'INVOICE_IN_PROGRESS')).toBe(true)
    expect(canTransition('TECHNICIAN_COMPLETED', 'REOPENED')).toBe(true)
  })

  it('has an owner for every non-terminal actionable status', () => {
    const terminal = new Set(['CLOSED', 'REJECTED', 'CANCELLED'])
    Object.keys(WORKFLOW_TRANSITIONS).filter(status => !terminal.has(status)).forEach(status => {
      expect(getWorkflowOwner(status), status).toBeTruthy()
    })
  })

  it('sets faster SLA targets for emergency requests', () => {
    const from = new Date('2026-07-20T00:00:00.000Z')
    expect(calculateSlaDueAt('EMERGENCY', 'SUBMITTED', from).getTime()).toBeLessThan(calculateSlaDueAt('LOW', 'SUBMITTED', from).getTime())
  })
})
