import { describe, expect, it } from 'vitest';
import { ConversationParser, ParsedMessage } from './conversation-parser';

function collectParserEvents(parser: ConversationParser) {
  const messages: ParsedMessage[] = [];
  let starts = 0;

  parser.on('conversationStart', () => {
    starts += 1;
  });
  parser.on('message', (message: ParsedMessage) => {
    messages.push(message);
  });

  return {
    get starts() {
      return starts;
    },
    messages,
  };
}

describe('ConversationParser', () => {
  it('does not create an empty conversation for a bare prompt', () => {
    const parser = new ConversationParser('claude');
    const events = collectParserEvents(parser);

    parser.feed('> \n\n');
    parser.flush();

    expect(events.starts).toBe(0);
    expect(events.messages).toEqual([]);
  });

  it('records Claude user messages only after content is present', () => {
    const parser = new ConversationParser('claude');
    const events = collectParserEvents(parser);

    parser.feed('> explain this project\n\n');

    expect(events.starts).toBe(1);
    expect(events.messages).toEqual([
      {
        role: 'user',
        content: 'explain this project',
      },
    ]);
  });

  it('records Claude typed input and skips the prompt echo', () => {
    const parser = new ConversationParser('claude');
    const events = collectParserEvents(parser);

    parser.feedInput('explain this project\r');
    parser.feed('> explain this project\nI can help with that.');
    parser.flush();

    expect(events.starts).toBe(1);
    expect(events.messages).toEqual([
      {
        role: 'user',
        content: 'explain this project',
      },
      {
        role: 'assistant',
        content: 'I can help with that.',
      },
    ]);
  });

  it('records Qoder typed input with Copilot-style assistant labels', () => {
    const parser = new ConversationParser('qoder');
    const events = collectParserEvents(parser);

    parser.feedInput('explain this project\r');
    parser.feed('explain this project\nQoder: I can help with that.');
    parser.flush();

    expect(events.starts).toBe(1);
    expect(events.messages).toEqual([
      {
        role: 'user',
        content: 'explain this project',
      },
      {
        role: 'assistant',
        content: 'I can help with that.',
      },
    ]);
  });

  it('records Copilot input typed into the terminal and skips the echoed line', () => {
    const parser = new ConversationParser('copilot');
    const events = collectParserEvents(parser);

    parser.feedInput('why is conversation empty?\r');
    parser.feed('why is conversation empty?\nCopilot: Because the parser did not see labelled output.');
    parser.flush();

    expect(events.starts).toBe(1);
    expect(events.messages).toEqual([
      {
        role: 'user',
        content: 'why is conversation empty?',
      },
      {
        role: 'assistant',
        content: 'Because the parser did not see labelled output.',
      },
    ]);
  });

  it('records Codex typed input and skips the echoed line', () => {
    const parser = new ConversationParser('codex');
    const events = collectParserEvents(parser);

    parser.feedInput('summarize the repo\r');
    parser.feed('summarize the repo\nCodex: Here is a summary.');
    parser.flush();

    expect(events.starts).toBe(1);
    expect(events.messages).toEqual([
      {
        role: 'user',
        content: 'summarize the repo',
      },
      {
        role: 'assistant',
        content: 'Here is a summary.',
      },
    ]);
  });

  it('ignores terminal control sequences while recording typed input', () => {
    const parser = new ConversationParser('copilot');
    const events = collectParserEvents(parser);

    parser.feedInput(
      '\x1b[?2026;0$y\x1b[O\x1b]10;rgb:eaea/eaea/eaea\x07\x1b]11;rgb:1a1a/1a1a/2e2e\x07' +
      '\x1b[<0;48;14M\x1b[<0;48;14m试一下  你这交互有问题吧\r'
    );
    parser.flush();

    expect(events.starts).toBe(1);
    expect(events.messages).toEqual([
      {
        role: 'user',
        content: '试一下  你这交互有问题吧',
      },
    ]);
  });

  it('recognizes common Copilot-style user and assistant labels', () => {
    const parser = new ConversationParser('copilot');
    const events = collectParserEvents(parser);

    parser.feed('You: hello\nAssistant: hi there');
    parser.flush();

    expect(events.starts).toBe(1);
    expect(events.messages).toEqual([
      {
        role: 'user',
        content: 'hello',
      },
      {
        role: 'assistant',
        content: 'hi there',
      },
    ]);
  });
});
