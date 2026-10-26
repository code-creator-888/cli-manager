import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ConversationPanel } from './ConversationPanel';
import { useAppStore } from '../../stores';
import type { CLIManagerAPI, Conversation } from '../../../shared/ipc';

const INITIAL_STATE = useAppStore.getState();

function conversation(id: string, overrides: Partial<Conversation> = {}): Conversation {
  return {
    id,
    cliType: 'claude',
    sessionId: `session-${id}`,
    title: `Conversation ${id}`,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    messageCount: 1,
    favorite: false,
    ...overrides,
  };
}

function makeConversations(count: number, prefix: string): Conversation[] {
  return Array.from({ length: count }, (_, i) =>
    conversation(`${prefix}-${i}`, { updatedAt: new Date(2026, 0, 1, 0, 0, count - i) })
  );
}

interface MockApiOverrides {
  list?: ReturnType<typeof vi.fn>;
}

function mockCliManagerAPI(overrides: MockApiOverrides = {}) {
  const api = {
    conversation: {
      list: overrides.list ?? vi.fn().mockResolvedValue([]),
      getWithMessages: vi.fn().mockResolvedValue(null),
      updateTitle: vi.fn().mockResolvedValue(undefined),
      onCreated: vi.fn().mockReturnValue(() => {}),
      onMessage: vi.fn().mockReturnValue(() => {}),
      toggleFavorite: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteByCLI: vi.fn().mockResolvedValue(0),
    },
  } as unknown as CLIManagerAPI;

  window.cliManagerAPI = api;
  return api;
}

beforeEach(() => {
  useAppStore.setState(INITIAL_STATE, true);
  useAppStore.setState({ activeCLI: 'claude' });
});

afterEach(() => {
  // @testing-library/react's automatic cleanup only kicks in when the test
  // runner injects a global afterEach; this project imports afterEach
  // explicitly, so we must unmount rendered components ourselves to avoid
  // leaking DOM nodes (and duplicate query matches) across tests.
  cleanup();
  delete (window as { cliManagerAPI?: CLIManagerAPI }).cliManagerAPI;
  vi.restoreAllMocks();
});

describe('ConversationPanel — pagination', () => {
  it('shows a "Load more" button when the first page is full, and hides it otherwise', async () => {
    const list = vi.fn().mockResolvedValue(makeConversations(50, 'a'));
    mockCliManagerAPI({ list });

    render(<ConversationPanel />);

    await waitFor(() => expect(screen.getByText('Load more')).toBeInTheDocument());
  });

  it('does not show "Load more" when the first page is smaller than the page size', async () => {
    const list = vi.fn().mockResolvedValue(makeConversations(3, 'a'));
    mockCliManagerAPI({ list });

    render(<ConversationPanel />);

    await waitFor(() => expect(screen.getByText(/3 conversations/)).toBeInTheDocument());
    expect(screen.queryByText('Load more')).not.toBeInTheDocument();
  });

  it('clicking "Load more" requests the next page with the correct offset and appends results', async () => {
    const firstPage = makeConversations(50, 'a');
    const secondPage = makeConversations(10, 'b');
    const list = vi.fn()
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage);
    mockCliManagerAPI({ list });

    render(<ConversationPanel />);

    const loadMoreButton = await screen.findByText('Load more');
    fireEvent.click(loadMoreButton);

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(list.mock.calls[1][0]).toMatchObject({ cliType: 'claude', offset: 50, limit: 50 });

    // Second page is smaller than the page size, so "Load more" disappears
    // and the appended conversations are now part of the store.
    await waitFor(() => expect(screen.queryByText('Load more')).not.toBeInTheDocument());
    expect(Object.keys(useAppStore.getState().conversations)).toHaveLength(60);
  });

  it('shows an error notification and keeps "Load more" visible when loading the next page fails', async () => {
    const firstPage = makeConversations(50, 'a');
    const list = vi.fn()
      .mockResolvedValueOnce(firstPage)
      .mockRejectedValueOnce(new Error('network down'));
    mockCliManagerAPI({ list });

    render(<ConversationPanel />);

    const loadMoreButton = await screen.findByText('Load more');
    fireEvent.click(loadMoreButton);

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      const notifications = useAppStore.getState().notifications;
      expect(notifications.some((n) => n.type === 'error' && n.message.includes('network down'))).toBe(true);
    });
    // The failed page never called appendConversations, so the store still only has page 1.
    expect(Object.keys(useAppStore.getState().conversations)).toHaveLength(50);
    expect(screen.getByText('Load more')).toBeInTheDocument();
  });
});
