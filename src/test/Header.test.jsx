import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Header, { isNavPathActive } from '../components/Header'

// Mock localStorage
beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  window.history.pushState({}, '', '/')
})

describe('Header Component', () => {
  it('renders header component', () => {
    render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    )
    expect(document.querySelector('header')).toBeInTheDocument()
  })

  it('shows login state when not authenticated', () => {
    localStorage.setItem('auth', JSON.stringify({ isAuthenticated: false }))
    render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    )
    // Header should render without errors
    expect(document.querySelector('header')).toBeTruthy()
  })

  it('handles authentication state', () => {
    const authData = {
      isAuthenticated: true,
      email: 'test@example.com',
      role: 'staff'
    }
    localStorage.setItem('auth', JSON.stringify(authData))
    
    render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    )
    
    expect(document.querySelector('header')).toBeTruthy()
  })

  it('keeps the parent navigation active on nested detail pages', () => {
    expect(isNavPathActive('/purchase-orders/po-123', '/purchase-orders')).toBe(true)
    expect(isNavPathActive('/requests/request-123/edit', '/requests')).toBe(true)
    expect(isNavPathActive('/vendors/vendor-123', '/vendors')).toBe(true)
    expect(isNavPathActive('/requests/new', '/requests')).toBe(false)
    expect(isNavPathActive('/requests/new', '/requests/new')).toBe(true)
  })
})
