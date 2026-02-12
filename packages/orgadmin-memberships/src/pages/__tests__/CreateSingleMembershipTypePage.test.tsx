import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CreateSingleMembershipTypePage from '../CreateSingleMembershipTypePage';

// Mock ReactQuill
vi.mock('react-quill', () => ({
  default: ({ value, onChange }: any) => (
    <textarea
      data-testid="quill-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
  };
});

describe('CreateSingleMembershipTypePage', () => {
  it('renders create single membership type form', () => {
    render(
      <BrowserRouter>
        <CreateSingleMembershipTypePage />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Create Single Membership Type')).toBeInTheDocument();
  });

  it('displays all required form fields', () => {
    render(
      <BrowserRouter>
        <CreateSingleMembershipTypePage />
      </BrowserRouter>
    );
    
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });
});
