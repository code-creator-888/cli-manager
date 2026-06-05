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
  private currentContent: string = '';
  private currentToolName: string = '';
  private hasStartedConversation: boolean = false;

  constructor(cliType: CLIType) {
    super();
    this.cliType = cliType;
  }

  reset(): void {
    this.state = 'idle';
    this.buffer = '';
    this.currentContent = '';
    this.currentToolName = '';
    this.hasStartedConversation = false;
  }

  feed(data: string): void {
    this.buffer += data;
    this.processBuffer();
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
    if (this.cliType === 'claude' || this.cliType === 'qoder') {
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
      // If we were collecting assistant content, emit it first
      if (this.state === 'collecting_assistant' && this.currentContent.trim()) {
        this.emitMessage({
          role: 'assistant',
          content: this.currentContent.trim(),
        });
        this.currentContent = '';
      }

      // Switch to collecting user input
      this.state = 'collecting_user';

      // Emit conversation start if this is the first user message
      if (!this.hasStartedConversation) {
        this.hasStartedConversation = true;
        this.emit('conversationStart');
      }

      // Extract the user content (remove the "> " prefix)
      const userContent = trimmedLine.substring(1).trim();
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
          if (!this.hasStartedConversation) {
            this.hasStartedConversation = true;
            this.emit('conversationStart');
          }
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
        if (!this.hasStartedConversation) {
          this.hasStartedConversation = true;
          this.emit('conversationStart');
        }
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

    // Detect user message
    if (trimmedLine.toLowerCase().startsWith('user:')) {
      // If we were collecting assistant content, emit it first
      if (this.state === 'collecting_assistant' && this.currentContent.trim()) {
        this.emitMessage({
          role: 'assistant',
          content: this.currentContent.trim(),
        });
        this.currentContent = '';
      }

      this.state = 'collecting_user';

      // Emit conversation start if this is the first user message
      if (!this.hasStartedConversation) {
        this.hasStartedConversation = true;
        this.emit('conversationStart');
      }

      // Extract the user content
      const userContent = trimmedLine.substring(5).trim();
      if (userContent) {
        this.currentContent = userContent;
      }
      return;
    }

    // Detect copilot/assistant message
    if (trimmedLine.toLowerCase().startsWith('copilot:')) {
      // If we were collecting user content, emit it first
      if (this.state === 'collecting_user' && this.currentContent.trim()) {
        this.emitMessage({
          role: 'user',
          content: this.currentContent.trim(),
        });
        this.currentContent = '';
      }

      this.state = 'collecting_assistant';

      // Extract the assistant content
      const assistantContent = trimmedLine.substring(8).trim();
      if (assistantContent) {
        this.currentContent = assistantContent;
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

      // Detect new user message
      if (trimmedLine.toLowerCase().startsWith('user:')) {
        if (this.currentContent.trim()) {
          this.emitMessage({
            role: 'assistant',
            content: this.currentContent.trim(),
          });
          this.currentContent = '';
        }
        this.state = 'collecting_user';
        if (!this.hasStartedConversation) {
          this.hasStartedConversation = true;
          this.emit('conversationStart');
        }
        return;
      }

      // Accumulate assistant content
      if (trimmedLine || this.currentContent) {
        this.currentContent += (this.currentContent ? '\n' : '') + trimmedLine;
      }
    }
  }

  private emitMessage(message: ParsedMessage): void {
    this.emit('message', message);
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
