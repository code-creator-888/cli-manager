import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTerminal } from './useTerminal';
import { useAppStore } from '../stores';
import type { CLIManagerAPI } from '../../shared/ipc';

const INITIAL_STATE = useAppStore.getState();

function mockCliManagerAPI(overrides: Partial<CLIManagerAPI['terminal']> = {}) {
  const api = {
    terminal: {
      create: vi.fn().mockResolvedValue({ sessionId: 'session-1', cliSessionId: 'cli-session-1' }),
      destroy: vi.fn(),
      write: vi.fn(),
      resize: vi.fn(),
      ...overrides,
    },
  } as unknown as CLIManagerAPI;

  window.cliManagerAPI = api;
  return api;
}

beforeEach(() => {
  useAppStore.setState(INITIAL_STATE, true);
});

afterEach(() => {
  delete (window as { cliManagerAPI?: CLIManagerAPI }).cliManagerAPI;
  vi.restoreAllMocks();
});

describe('useTerminal — createSession', () => {
  it('returns null and does not call the store when cliManagerAPI is unavailable', async () => {
    delete (window as { cliManagerAPI?: CLIManagerAPI }).cliManagerAPI;
    const { result } = renderHook(() => useTerminal());

    let sessionId: string | null = null;
    await act(async () => {
      sessionId = await result.current.createSession();
    });

    expect(sessionId).toBeNull();
    expect(useAppStore.getState().sessions).toEqual({});
  });

  it('creates a session via cliManagerAPI, adds it to the store, and returns the new session id', async () => {
    const api = mockCliManagerAPI();
    useAppStore.setState({ activeCLI: 'claude' });
    const { result } = renderHook(() => useTerminal());

    let sessionId: string | null = null;
    await act(async () => {
      sessionId = await result.current.createSession();
    });

    expect(sessionId).toBe('session-1');
    expect(api.terminal.create).toHaveBeenCalledWith('claude');
    const stored = useAppStore.getState().sessions['session-1'];
    expect(stored).toBeDefined();
    expect(stored.cliType).toBe('claude');
    expect(stored.cliSessionId).toBe('cli-session-1');
  });

  it('returns null and logs an error when cliManagerAPI.terminal.create rejects', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCliManagerAPI({ create: vi.fn().mockRejectedValue(new Error('boom')) });
    const { result } = renderHook(() => useTerminal());

    let sessionId: string | null = null;
    await act(async () => {
      sessionId = await result.current.createSession();
    });

    expect(sessionId).toBeNull();
    expect(useAppStore.getState().sessions).toEqual({});
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('ignores concurrent createSession calls while one is already in flight', async () => {
    // create() never resolves during this test. We deliberately never await
    // the in-flight call itself (a regression could leave it pending forever);
    // instead we only await a plain resolved promise to flush microtasks, then
    // assert synchronously on the second call's outcome and the mock's call count.
    const create = vi.fn().mockImplementation(() => new Promise(() => {}));
    mockCliManagerAPI({ create });
    const { result } = renderHook(() => useTerminal());

    let secondCallResult: string | null = 'not-yet-settled';
    act(() => {
      void result.current.createSession(); // fire-and-forget: starts the in-flight call
      void result.current.createSession().then((value) => { secondCallResult = value; });
    });
    await act(async () => {
      await Promise.resolve(); // flush the microtask queue without waiting on any hook promise
    });

    expect(create).toHaveBeenCalledTimes(1);
    // isCreatingRef guards re-entry synchronously, so the second call resolves
    // to null immediately without ever invoking create() again.
    expect(secondCallResult).toBeNull();
  });
});

describe('useTerminal — destroySession / writeToTerminal / resizeTerminal', () => {
  it('destroySession calls cliManagerAPI.terminal.destroy and removes the session from the store', () => {
    const api = mockCliManagerAPI();
    useAppStore.getState().addSession({
      id: 's1',
      cliType: 'claude',
      createdAt: new Date(),
      lastActivity: new Date(),
    });
    const { result } = renderHook(() => useTerminal());

    act(() => {
      result.current.destroySession('s1');
    });

    expect(api.terminal.destroy).toHaveBeenCalledWith('s1');
    expect(useAppStore.getState().sessions.s1).toBeUndefined();
  });

  it('destroySession still removes the session from the store when cliManagerAPI is unavailable', () => {
    delete (window as { cliManagerAPI?: CLIManagerAPI }).cliManagerAPI;
    useAppStore.getState().addSession({
      id: 's1',
      cliType: 'claude',
      createdAt: new Date(),
      lastActivity: new Date(),
    });
    const { result } = renderHook(() => useTerminal());

    act(() => {
      result.current.destroySession('s1');
    });

    expect(useAppStore.getState().sessions.s1).toBeUndefined();
  });

  it('writeToTerminal forwards to cliManagerAPI.terminal.write only when available', () => {
    const api = mockCliManagerAPI();
    const { result } = renderHook(() => useTerminal());

    act(() => {
      result.current.writeToTerminal('s1', 'ls -la\n');
    });

    expect(api.terminal.write).toHaveBeenCalledWith('s1', 'ls -la\n');
  });

  it('writeToTerminal is a no-op when cliManagerAPI is unavailable', () => {
    delete (window as { cliManagerAPI?: CLIManagerAPI }).cliManagerAPI;
    const { result } = renderHook(() => useTerminal());

    expect(() => result.current.writeToTerminal('s1', 'data')).not.toThrow();
  });

  it('resizeTerminal forwards to cliManagerAPI.terminal.resize only when available', () => {
    const api = mockCliManagerAPI();
    const { result } = renderHook(() => useTerminal());

    act(() => {
      result.current.resizeTerminal('s1', 80, 24);
    });

    expect(api.terminal.resize).toHaveBeenCalledWith('s1', 80, 24);
  });

  it('resizeTerminal is a no-op when cliManagerAPI is unavailable', () => {
    delete (window as { cliManagerAPI?: CLIManagerAPI }).cliManagerAPI;
    const { result } = renderHook(() => useTerminal());

    expect(() => result.current.resizeTerminal('s1', 80, 24)).not.toThrow();
  });
});
