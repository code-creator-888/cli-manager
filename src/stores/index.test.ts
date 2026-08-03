import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './index';
import type { Conversation, ConversationMessage, TerminalSession } from '../types';

const INITIAL_STATE = useAppStore.getState();

function session(id: string, cliType: TerminalSession['cliType']): TerminalSession {
  return {
    id,
    cliType,
    createdAt: new Date(),
    lastActivity: new Date(),
  };
}

function conversation(id: string, overrides: Partial<Conversation> = {}): Conversation {
  return {
    id,
    cliType: 'claude',
    sessionId: `session-${id}`,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    messageCount: 0,
    favorite: false,
    ...overrides,
  };
}

function message(id: string, conversationId: string, overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id,
    conversationId,
    role: 'user',
    content: 'hello',
    timestamp: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  useAppStore.setState(INITIAL_STATE, true);
});

describe('useAppStore — terminal session actions', () => {
  it('addSession stores the session and makes it active', () => {
    const s1 = session('s1', 'claude');
    useAppStore.getState().addSession(s1);

    const state = useAppStore.getState();
    expect(state.sessions.s1).toEqual(s1);
    expect(state.activeSessionId).toBe('s1');
  });

  it('removeSession prefers a remaining session of the same CLI type when the active session is removed', () => {
    // Insert copilot-1 first so Object.values() would return it before claude-1
    // if the same-CLI-type preference were broken — this makes the assertion
    // below actually distinguish the two fallback strategies.
    useAppStore.getState().addSession(session('copilot-1', 'copilot'));
    useAppStore.getState().addSession(session('claude-1', 'claude'));
    useAppStore.getState().addSession(session('claude-2', 'claude'));
    useAppStore.setState({ activeCLI: 'claude' });
    useAppStore.getState().setActiveSession('claude-2');

    useAppStore.getState().removeSession('claude-2');

    const state = useAppStore.getState();
    expect(state.sessions['claude-2']).toBeUndefined();
    // Falls back to another session of the same CLI type (claude-1), not the
    // insertion-order-first session (copilot-1).
    expect(state.activeSessionId).toBe('claude-1');
  });

  it('removeSession falls back to any remaining session when none match the active CLI type', () => {
    useAppStore.getState().addSession(session('copilot-1', 'copilot'));
    useAppStore.getState().setActiveCLI('claude');
    useAppStore.getState().setActiveSession('copilot-1');

    useAppStore.getState().removeSession('copilot-1');

    const state = useAppStore.getState();
    expect(state.sessions['copilot-1']).toBeUndefined();
    expect(state.activeSessionId).toBeNull();
  });

  it('removeSession leaves activeSessionId untouched when removing a non-active session', () => {
    useAppStore.getState().addSession(session('s1', 'claude'));
    useAppStore.getState().addSession(session('s2', 'claude'));
    useAppStore.getState().setActiveSession('s1');

    useAppStore.getState().removeSession('s2');

    expect(useAppStore.getState().activeSessionId).toBe('s1');
  });

  it('setActiveCLI switches to the first existing session of the new CLI type', () => {
    useAppStore.getState().addSession(session('claude-1', 'claude'));
    useAppStore.getState().addSession(session('copilot-1', 'copilot'));

    useAppStore.getState().setActiveCLI('copilot');

    const state = useAppStore.getState();
    expect(state.activeCLI).toBe('copilot');
    expect(state.activeSessionId).toBe('copilot-1');
  });

  it('setActiveCLI clears activeSessionId when the new CLI type has no sessions', () => {
    useAppStore.getState().addSession(session('claude-1', 'claude'));

    useAppStore.getState().setActiveCLI('codex');

    const state = useAppStore.getState();
    expect(state.activeCLI).toBe('codex');
    expect(state.activeSessionId).toBeNull();
  });

  it('getSessionsForCLI returns only sessions matching the given CLI type', () => {
    useAppStore.getState().addSession(session('c1', 'claude'));
    useAppStore.getState().addSession(session('c2', 'claude'));
    useAppStore.getState().addSession(session('p1', 'copilot'));

    expect(useAppStore.getState().getSessionsForCLI('claude')).toHaveLength(2);
    expect(useAppStore.getState().getSessionsForCLI('copilot')).toHaveLength(1);
    expect(useAppStore.getState().getSessionsForCLI('codex')).toHaveLength(0);
  });
});

describe('useAppStore — status and notifications', () => {
  it('updateStatus stores status per CLI type without affecting others', () => {
    useAppStore.getState().updateStatus('claude', {
      cliType: 'claude',
      installed: true,
      version: '1.0.0',
      running: true,
      lastChecked: new Date(),
    });

    const state = useAppStore.getState();
    expect(state.statuses.claude?.installed).toBe(true);
    expect(state.statuses.copilot).toBeNull();
  });

  it('addNotification assigns a unique id and keeps only the last 5 notifications', () => {
    const ids: string[] = [];
    for (let i = 0; i < 7; i++) {
      ids.push(useAppStore.getState().addNotification({ type: 'info', message: `msg-${i}` }));
    }

    const state = useAppStore.getState();
    expect(state.notifications).toHaveLength(5);
    expect(new Set(ids).size).toBe(7); // all ids unique
    // oldest two were dropped, most recent five remain in order
    expect(state.notifications.map((n) => n.message)).toEqual(['msg-2', 'msg-3', 'msg-4', 'msg-5', 'msg-6']);
  });

  it('removeNotification removes only the targeted notification', () => {
    const id1 = useAppStore.getState().addNotification({ type: 'info', message: 'a' });
    const id2 = useAppStore.getState().addNotification({ type: 'info', message: 'b' });

    useAppStore.getState().removeNotification(id1);

    const state = useAppStore.getState();
    expect(state.notifications.map((n) => n.id)).toEqual([id2]);
  });
});

describe('useAppStore — conversation actions', () => {
  it('setConversations replaces the conversation map keyed by id', () => {
    useAppStore.getState().setConversations([conversation('a'), conversation('b')]);

    const state = useAppStore.getState();
    expect(Object.keys(state.conversations).sort()).toEqual(['a', 'b']);
  });

  it('appendConversations merges into the existing map without dropping prior entries', () => {
    useAppStore.getState().setConversations([conversation('a')]);
    useAppStore.getState().appendConversations([conversation('b'), conversation('c')]);

    const state = useAppStore.getState();
    expect(Object.keys(state.conversations).sort()).toEqual(['a', 'b', 'c']);
  });

  it('appendConversations overwrites an existing entry with the same id', () => {
    useAppStore.getState().setConversations([conversation('a', { title: 'old' })]);
    useAppStore.getState().appendConversations([conversation('a', { title: 'new' })]);

    expect(useAppStore.getState().conversations.a.title).toBe('new');
  });

  it('updateConversation merges partial updates into an existing conversation', () => {
    useAppStore.getState().setConversations([conversation('a', { title: 'old' })]);

    useAppStore.getState().updateConversation('a', { title: 'renamed' });

    const state = useAppStore.getState();
    expect(state.conversations.a.title).toBe('renamed');
    expect(state.conversations.a.cliType).toBe('claude'); // untouched fields survive the merge
  });

  it('updateConversation is a no-op when the conversation id does not exist', () => {
    useAppStore.getState().setConversations([conversation('a')]);
    const before = useAppStore.getState().conversations;

    useAppStore.getState().updateConversation('missing', { title: 'nope' });

    expect(useAppStore.getState().conversations).toBe(before); // same reference: state object was returned unchanged
  });

  it('removeConversation deletes the conversation and its messages, clearing activeConversationId if it was active', () => {
    useAppStore.getState().setConversations([conversation('a')]);
    useAppStore.getState().setConversationMessages('a', [message('m1', 'a')]);
    useAppStore.getState().setActiveConversation('a');

    useAppStore.getState().removeConversation('a');

    const state = useAppStore.getState();
    expect(state.conversations.a).toBeUndefined();
    expect(state.conversationMessages.a).toBeUndefined();
    expect(state.activeConversationId).toBeNull();
  });

  it('removeConversation leaves activeConversationId untouched when removing a different conversation', () => {
    useAppStore.getState().setConversations([conversation('a'), conversation('b')]);
    useAppStore.getState().setActiveConversation('a');

    useAppStore.getState().removeConversation('b');

    expect(useAppStore.getState().activeConversationId).toBe('a');
  });

  it('removeConversationsForCLI removes only conversations of the given CLI type', () => {
    useAppStore.getState().setConversations([
      conversation('a', { cliType: 'claude' }),
      conversation('b', { cliType: 'copilot' }),
    ]);
    useAppStore.getState().setConversationMessages('a', [message('m1', 'a')]);

    useAppStore.getState().removeConversationsForCLI('claude');

    const state = useAppStore.getState();
    expect(state.conversations.a).toBeUndefined();
    expect(state.conversations.b).toBeDefined();
    expect(state.conversationMessages.a).toBeUndefined();
  });

  it('removeConversationsForCLI clears activeConversationId only when the active conversation belonged to the removed CLI', () => {
    useAppStore.getState().setConversations([
      conversation('a', { cliType: 'claude' }),
      conversation('b', { cliType: 'copilot' }),
    ]);
    useAppStore.getState().setActiveConversation('b');

    useAppStore.getState().removeConversationsForCLI('claude');

    expect(useAppStore.getState().activeConversationId).toBe('b');
  });

  it('addConversationMessage appends the message and bumps the conversation messageCount/updatedAt', () => {
    useAppStore.getState().setConversations([conversation('a', { messageCount: 1 })]);
    const newMessage = message('m1', 'a', { timestamp: new Date('2026-03-01T00:00:00Z') });

    useAppStore.getState().addConversationMessage('a', newMessage);

    const state = useAppStore.getState();
    expect(state.conversationMessages.a).toEqual([newMessage]);
    expect(state.conversations.a.messageCount).toBe(2);
    expect(state.conversations.a.updatedAt).toEqual(newMessage.timestamp);
  });

  it('addConversationMessage still records the message when the conversation is unknown', () => {
    const newMessage = message('m1', 'missing');

    useAppStore.getState().addConversationMessage('missing', newMessage);

    const state = useAppStore.getState();
    expect(state.conversationMessages.missing).toEqual([newMessage]);
    expect(state.conversations.missing).toBeUndefined();
  });
});
