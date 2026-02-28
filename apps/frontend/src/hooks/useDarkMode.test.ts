import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDarkMode } from './useDarkMode';

describe('useDarkMode', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Remove dark class from document
    document.documentElement.classList.remove('dark');
  });

  it('should initialize with light mode by default', () => {
    const { result } = renderHook(() => useDarkMode());
    const [isDarkMode] = result.current;

    expect(isDarkMode).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should initialize from localStorage if value exists', () => {
    localStorage.setItem('darkMode', JSON.stringify(true));

    const { result } = renderHook(() => useDarkMode());
    const [isDarkMode] = result.current;

    expect(isDarkMode).toBe(true);
  });

  it('should toggle dark mode on', () => {
    const { result } = renderHook(() => useDarkMode());

    act(() => {
      const [, setIsDarkMode] = result.current;
      setIsDarkMode(true);
    });

    const [isDarkMode] = result.current;
    expect(isDarkMode).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should toggle dark mode off', () => {
    localStorage.setItem('darkMode', JSON.stringify(true));

    const { result } = renderHook(() => useDarkMode());

    act(() => {
      const [, setIsDarkMode] = result.current;
      setIsDarkMode(false);
    });

    const [isDarkMode] = result.current;
    expect(isDarkMode).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should persist dark mode setting to localStorage', () => {
    const { result } = renderHook(() => useDarkMode());

    act(() => {
      const [, setIsDarkMode] = result.current;
      setIsDarkMode(true);
    });

    expect(localStorage.getItem('darkMode')).toBe('true');
  });

  it('should persist light mode setting to localStorage', () => {
    localStorage.setItem('darkMode', JSON.stringify(true));

    const { result } = renderHook(() => useDarkMode());

    act(() => {
      const [, setIsDarkMode] = result.current;
      setIsDarkMode(false);
    });

    expect(localStorage.getItem('darkMode')).toBe('false');
  });

  it('should add dark class to document element when enabled', () => {
    const { result } = renderHook(() => useDarkMode());

    act(() => {
      const [, setIsDarkMode] = result.current;
      setIsDarkMode(true);
    });

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should remove dark class from document element when disabled', () => {
    // Start with dark mode on
    localStorage.setItem('darkMode', JSON.stringify(true));
    document.documentElement.classList.add('dark');

    const { result } = renderHook(() => useDarkMode());

    act(() => {
      const [, setIsDarkMode] = result.current;
      setIsDarkMode(false);
    });

    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should toggle between modes multiple times', () => {
    const { result } = renderHook(() => useDarkMode());

    // Toggle on
    act(() => {
      const [, setIsDarkMode] = result.current;
      setIsDarkMode(true);
    });
    expect(result.current[0]).toBe(true);

    // Toggle off
    act(() => {
      const [, setIsDarkMode] = result.current;
      setIsDarkMode(false);
    });
    expect(result.current[0]).toBe(false);

    // Toggle on again
    act(() => {
      const [, setIsDarkMode] = result.current;
      setIsDarkMode(true);
    });
    expect(result.current[0]).toBe(true);
  });
});
