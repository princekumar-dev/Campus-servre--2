import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BottomNav from '../components/BottomNav'

describe('BottomNav service-provider navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.getItem.mockImplementation(key => key === 'auth' ? JSON.stringify({
      isAuthenticated: true,
      role: 'service_provider',
      email: 'service@msec.edu.in'
    }) : null)
  })

  it('renders the service dashboard navigation without a runtime error', () => {
    render(
      <MemoryRouter initialEntries={['/service/dashboard']}>
        <BottomNav />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: /services/i })).toHaveAttribute('href', '/service/dashboard')
  })

  it('renders the current PO action in a service workspace', () => {
    render(
      <MemoryRouter initialEntries={['/service/po/64b7f1122334455667788990?portal=service']}>
        <BottomNav />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: /current po/i })).toBeInTheDocument()
  })
})
