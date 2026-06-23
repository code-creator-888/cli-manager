import { EventEmitter } from 'events';

type CLIType = 'claude' | 'copilot' | 'codex' | 'qoder';

export interface ParsedMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  metadata?: {
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    toolResult?: string;
  };
}

export interface ConversationParserEvents {
  message: (message: ParsedMessage) => void;
  conversationStart: () => void;
}

type ParserState = 'idle' | 'collecting_user' | 'collecting_assistant' | 'collecting_tool';

export class ConversationParser extends EventEmitter {
  private cliType: CLIType;
  private state: ParserState = 'idle';
  private buffer: string = '';
  private inputBuffer: string = '';
  private currentContent: string = '';
  private currentToolName: string = '';
  private hasStartedConversation: boolean = false;
  private lastUserInput: string | null = null;

  constructor(cliType: CLIType) {
    super();
    this.cliType = cliType;
  }

  reset(): void {
    this.state = 'idle';
    this.buffer = '';
    this.inputBuffer = '';
    this.currentContent = '';
    this.currentToolName = '';
    this.hasStartedConversation = false;
    this.lastUserInput = null;
  }

  feed(data: string): void {
    this.buffer += data;
    this.processBuffer();
  }

  feedInput(data: string): void {
    for (let index = 0; index < data.length; index += 1) {
      const char = data[index];

      if (char === '\x1b') {
        index = this.skipTerminalControlSequence(data, index);
        continue;
      }

      if (char === '\r' || char === '\n') {
        this.emitBufferedInput();
      } else if (char === '\u0003') {
        this.inputBuffer = '';
      } else if (char === '\u007f' || char === '\b') {
        this.inputBuffer = this.inputBuffer.slice(0, -1);
      } else if (char >= ' ' || char === '\t') {
        this.inputBuffer += char;
      }
    }
  }

  private skipTerminalControlSequence(data: string, startIndex: number): number {
    const sequenceType = data[startIndex + 1];

    if (sequenceType === '[') {
      for (let index = startIndex + 2; index < data.length; index += 1) {
        const code = data.charCodeAt(index);
        if (code >= 0x40 && code <= 0x7e) {
          return index;
        }
      }
      return data.length - 1;
    }

    if (sequenceType === ']') {
      for (let index = startIndex + 2; index < data.length; index += 1) {
        if (data[index] === '\x07') {
          return index;
        }
        if (data[index] === '\x1b' && data[index + 1] === '\\') {
          return index + 1;
        }
      }
      return data.length - 1;
    }

    if (sequenceType === 'O') {
      return Math.min(startIndex + 2, data.length - 1);
    }

    return Math.min(startIndex + 1, data.length - 1);
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      this.processLine(line);
    }
  }

  private processLine(line: string): void {
    if (this.cliType === 'claude') {
      this.processClaudeLine(line);
    } else {
      this.processCopilotLine(line);
    }
  }

  private processClaudeLine(rawLine: string): void {
    const line = this.stripAnsi(rawLine);
    const trimmedLine = line.trim();

    // Detect user input prompt (">" at beginning of line)
    if (trimmedLine.startsWith('>')) {
      const userContent = trimmedLine.substring(1).trim();
      if (userContent && this.isDuplicateUserEcho(userContent)) {
        this.state = 'collecting_assistant';
        this.currentContent = '';
        return;
      }

      // If we were collecting assistant content, emit it first
      if (this.state === 'collecting_assistant' && this.currentContent.trim()) {
        this.emitMessage({
          role: 'assistant',
          content: this.currentContent.trim(),
        });
        this.currentContent = '';
      }
      this.state = 'collecting_user';
      // Extract the user content (remove the "> " prefix)
      if (userContent) {
        this.currentContent += (this.currentContent ? '\n' : '') + userContent;
      }
      return;
    }

    // If we're collecting user input
    if (this.state === 'collecting_user') {
      // Check for end of user input - empty line or start of assistant response
      if (trimmedLine === '' || trimmedLine.match(/^[●○►△▽]/)) {
        // Emit the user message
        if (this.currentContent.trim()) {
          this.emitMessage({
            role: 'user',
            content: this.currentContent.trim(),
          });
          this.currentContent = '';
        }
        this.state = 'collecting_assistant';
        return;
      }

      // Continue collecting user input (skip lines that look like prompts or UI elements)
      if (!trimmedLine.match(/^\s*$/) && !trimmedLine.match(/^(?:│|╭|╰)/)) {
        this.currentContent += (this.currentContent ? '\n' : '') + trimmedLine;
      }
      return;
    }

    // Detect tool call markers (●, ○, ► followed by tool name)
    const toolMatch = trimmedLine.match(/^[●○►]\s*(Read|Write|Edit|Bash|Glob|Grep|Task|Tool)\b/i);
    if (toolMatch) {
      // If we were collecting assistant content, emit it first
      if (this.state === 'collecting_assistant' && this.currentContent.trim()) {
        this.emitMessage({
          role: 'assistant',
          content: this.currentContent.trim(),
        });
        this.currentContent = '';
      }

      this.state = 'collecting_tool';
      this.currentToolName = toolMatch[1];
      this.currentContent = '';
      return;
    }

    // If we're collecting tool content
    if (this.state === 'collecting_tool') {
      // Check for end of tool output
      if (trimmedLine === '' || trimmedLine.match(/^[●○►>]/)) {
        // Emit the tool message
        if (this.currentToolName) {
          this.emitMessage({
            role: 'tool',
            content: this.currentContent.trim() || 'Tool executed',
            metadata: {
              toolName: this.currentToolName,
            },
          });
          this.currentToolName = '';
          this.currentContent = '';
        }

        // Check what's next
        if (trimmedLine.startsWith('>')) {
          this.state = 'collecting_user';
        } else {
          this.state = 'collecting_assistant';
        }
        return;
      }

      // Continue collecting tool output
      if (trimmedLine && !trimmedLine.match(/^(?:│|╭|╰)/)) {
        this.currentContent += (this.currentContent ? '\n' : '') + trimmedLine;
      }
      return;
    }

    // If we're collecting assistant response
    if (this.state === 'collecting_assistant') {
      // Skip empty lines at the start
      if (trimmedLine === '' && !this.currentContent) {
        return;
      }

      // Check for new user input
      if (trimmedLine.startsWith('>')) {
        if (this.currentContent.trim()) {
          this.emitMessage({
            role: 'assistant',
            content: this.currentContent.trim(),
          });
          this.currentContent = '';
        }
        this.state = 'collecting_user';
        return;
      }

      // Check for tool call
      const toolMatchInAssistant = trimmedLine.match(/^[●○►]\s*(Read|Write|Edit|Bash|Glob|Grep|Task|Tool)\b/i);
      if (toolMatchInAssistant) {
        if (this.currentContent.trim()) {
          this.emitMessage({
            role: 'assistant',
            content: this.currentContent.trim(),
          });
          this.currentContent = '';
        }
        this.state = 'collecting_tool';
        this.currentToolName = toolMatchInAssistant[1];
        return;
      }

      // Skip UI decoration lines
      if (trimmedLine.match(/^(?:│|╭|╰)/)) {
        return;
      }

      // Accumulate assistant content
      if (trimmedLine || this.currentContent) {
        this.currentContent += (this.currentContent ? '\n' : '') + trimmedLine;
      }
    }
  }

  private processCopilotLine(rawLine: string): void {
    const line = this.stripAnsi(rawLine);
    const trimmedLine = line.trim();

    const labelledUserContent = this.getLabelledUserContent(trimmedLine);
    if (labelledUserContent !== null) {
      if (this.isDuplicateUserEcho(labelledUserContent)) {
        this.state = 'collecting_assistant';
        return;
      }

      // If we were collecting assistant content, emit it first
      if (this.state === 'collecting_assistant' && this.currentContent.trim()) {
        this.emitMessage({
          role: 'assistant',
          content: this.currentContent.trim(),
        });
        this.currentContent = '';
      }

      this.state = 'collecting_user';

      if (labelledUserContent) {
        this.currentContent = labelledUserContent;
      }
      return;
    }

    const labelledAssistantContent = this.getLabelledAssistantContent(trimmedLine);
    if (labelledAssistantContent !== null) {
      // If we were collecting user content, emit it first
      if (this.state === 'collecting_user' && this.currentContent.trim()) {
        this.emitMessage({
          role: 'user',
          content: this.currentContent.trim(),
        });
        this.currentContent = '';
      }

      this.state = 'collecting_assistant';

      if (labelledAssistantContent) {
        this.currentContent = labelledAssistantContent;
      }
      return;
    }

    // If we're collecting user input
    if (this.state === 'collecting_user') {
      // Empty line might indicate end of user message
      if (trimmedLine === '') {
        if (this.currentContent.trim()) {
          this.emitMessage({
            role: 'user',
            content: this.currentContent.trim(),
          });
          this.currentContent = '';
        }
        return;
      }

      // Continue collecting user content
      this.currentContent += (this.currentContent ? '\n' : '') + trimmedLine;
      return;
    }

    // If we're collecting assistant response
    if (this.state === 'collecting_assistant') {
      // Skip empty lines at the start
      if (trimmedLine === '' && !this.currentContent) {
        return;
      }

      if (this.isDuplicateUserEcho(trimmedLine) || this.isPromptOnlyLine(trimmedLine)) {
        return;
      }

      // Accumulate assistant content
      if (trimmedLine || this.currentContent) {
        this.currentContent += (this.currentContent ? '\n' : '') + trimmedLine;
      }
    }
  }

  private emitMessage(message: ParsedMessage): void {
    if (message.role === 'user') {
      this.ensureConversationStarted();
      this.lastUserInput = message.content;
    }

    this.emit('message', message);
  }

  private emitBufferedInput(): void {
    const input = this.inputBuffer.trim();
    this.inputBuffer = '';

    if (!input) {
      return;
    }

    if (this.state === 'collecting_assistant' && this.currentContent.trim()) {
      this.emitMessage({
        role: 'assistant',
        content: this.currentContent.trim(),
      });
      this.currentContent = '';
    }

    this.emitMessage({
      role: 'user',
      content: input,
    });
    this.state = 'collecting_assistant';
  }

  private ensureConversationStarted(): void {
    if (!this.hasStartedConversation) {
      this.hasStartedConversation = true;
      this.emit('conversationStart');
    }
  }

  private getLabelledUserContent(line: string): string | null {
    const match = line.match(/^(?:user|you)\s*:\s*(.*)$/i);
    return match ? match[1].trim() : null;
  }

  private getLabelledAssistantContent(line: string): string | null {
    const match = line.match(/^(?:copilot|github copilot|codex|qoder|assistant)\s*:\s*(.*)$/i);
    return match ? match[1].trim() : null;
  }

  private isDuplicateUserEcho(line: string): boolean {
    if (!this.lastUserInput) {
      return false;
    }

    const promptMatch = line.match(/^[>›]\s*(.*)$/);
    const normalizedLine = (promptMatch ? promptMatch[1] : line).trim();
    return normalizedLine === this.lastUserInput;
  }

  private isPromptOnlyLine(line: string): boolean {
    return /^[>›?]\s*$/.test(line);
  }

  private stripAnsi(str: string): string {
    // Remove ANSI escape codes
    return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
              .replace(/\x1b\][^\x07]*\x07/g, '')
              .replace(/\x1b[()][AB012]/g, '')
              .replace(/\x1b\[\?[0-9;]*[a-zA-Z]/g, '');
  }

  // Flush any remaining content
  flush(): void {
    if (this.buffer.trim()) {
      const remaining = this.buffer;
      this.buffer = '';
      this.processLine(remaining);
    }

    this.emitBufferedInput();

    if (this.currentContent.trim()) {
      if (this.state === 'collecting_assistant') {
        this.emitMessage({
          role: 'assistant',
          content: this.currentContent.trim(),
        });
      } else if (this.state === 'collecting_user') {
        this.emitMessage({
          role: 'user',
          content: this.currentContent.trim(),
        });
      }
    }
    this.currentContent = '';
  }
}
