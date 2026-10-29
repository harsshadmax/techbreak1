import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../lib/auth'
import { LoginPage } from '../pages/Login'
import { FACE_MOODS, FACE_SHAPES, Face } from './Face'
import { AwardList, FaceChip, Sheet } from './kit'

describe('Face', () => {
  it('draws every shape and mood', () => {
    const { container } = render(
      <div>
        {FACE_SHAPES.flatMap((shape) => FACE_MOODS.map((mood) => <Face key={`${shape}-${mood}`} shape={shape} mood={mood} />))}
      </div>,
    )
    expect(container.querySelectorAll('svg')).toHaveLength(FACE_SHAPES.length * FACE_MOODS.length)
  })
})

describe('AwardList', () => {
  it('shows the total and each line', () => {
    render(<AwardList awards={[{ amount: 25, reason: 'focus_complete' }, { amount: 5, reason: 'clean_bonus' }, { amount: 30, reason: 'goal_achieved' }, { amount: 5, reason: 'streak_bonus' }]} />)
    expect(screen.getByText('+65')).toBeInTheDocument()
    expect(screen.getByText('Focus time')).toBeInTheDocument()
    expect(screen.getByText('+30')).toBeInTheDocument()
  })

  it('explains an empty result', () => {
    render(<AwardList awards={[]} />)
    expect(screen.getByText(/No tokens this time/)).toBeInTheDocument()
  })
})

describe('FaceChip', () => {
  it('reports clicks', async () => {
    const onClick = vi.fn()
    render(<FaceChip label="25 min" color="#B9F5A3" onClick={onClick} />)
    await userEvent.click(screen.getByRole('button', { name: '25 min' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe('Sheet', () => {
  it('closes on Escape and renders nothing when closed', async () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <Sheet open onClose={onClose} label="Demo">
        <p>Hello</p>
      </Sheet>,
    )
    expect(screen.getByRole('dialog', { name: 'Demo' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
    rerender(
      <Sheet open={false} onClose={onClose} label="Demo">
        <p>Hello</p>
      </Sheet>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('LoginPage', () => {
  it('validates the email and password before calling the server', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(screen.getByText('Enter a valid email')).toBeInTheDocument()
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument()
  })

  it('asks for a display name when creating an account', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    )
    await userEvent.click(await screen.findByRole('button', { name: /Create an account/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByText('Enter a name')).toBeInTheDocument()
  })
})
