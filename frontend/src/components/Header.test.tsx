import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Header from './Header';

describe('Header', () => {
  it('should render the header with title', () => {
    render(<Header isDarkMode={false} onToggleDarkMode={vi.fn()} />);
    expect(screen.getByText('Event Taxonomy')).toBeInTheDocument();
    expect(screen.getByText('Analytics Management')).toBeInTheDocument();
  });

  it('should render status indicator', () => {
    render(<Header isDarkMode={false} onToggleDarkMode={vi.fn()} />);
    expect(screen.getByText('All Systems Operational')).toBeInTheDocument();
  });

  it('should render user email', () => {
    render(<Header isDarkMode={false} onToggleDarkMode={vi.fn()} />);
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });

  it('should show moon icon when in light mode', () => {
    render(<Header isDarkMode={false} onToggleDarkMode={vi.fn()} />);
    const toggleButton = screen.getByLabelText('Toggle dark mode');
    expect(toggleButton).toBeInTheDocument();
    // Moon icon (d="M17.293...") should be present
    const moonPath = toggleButton.querySelector('path[d*="M17.293"]');
    expect(moonPath).toBeInTheDocument();
  });

  it('should show sun icon when in dark mode', () => {
    render(<Header isDarkMode={true} onToggleDarkMode={vi.fn()} />);
    const toggleButton = screen.getByLabelText('Toggle dark mode');
    expect(toggleButton).toBeInTheDocument();
    // Sun icon (fillRule="evenodd") should be present
    const sunPath = toggleButton.querySelector('path[fill-rule="evenodd"]');
    expect(sunPath).toBeInTheDocument();
  });

  it('should call onToggleDarkMode when dark mode button is clicked', () => {
    const onToggleDarkMode = vi.fn();
    render(<Header isDarkMode={false} onToggleDarkMode={onToggleDarkMode} />);

    const toggleButton = screen.getByLabelText('Toggle dark mode');
    fireEvent.click(toggleButton);

    expect(onToggleDarkMode).toHaveBeenCalledTimes(1);
  });

  it('should have proper accessibility label for dark mode toggle', () => {
    render(<Header isDarkMode={false} onToggleDarkMode={vi.fn()} />);
    const toggleButton = screen.getByLabelText('Toggle dark mode');
    expect(toggleButton).toHaveAttribute('aria-label', 'Toggle dark mode');
  });

  it('should render header as sticky element', () => {
    const { container } = render(<Header isDarkMode={false} onToggleDarkMode={vi.fn()} />);
    const header = container.querySelector('header');
    expect(header).toHaveClass('sticky');
  });
});
