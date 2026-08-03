import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { subscribeTerminalData } from '../../utils/terminalDataBus';
import type { CLIType } from '../../types';
import { getCopyableSelectionText } from '../../../shared/clipboard';
import 'xterm/css/xterm.css';

const TERMINAL_SCROLLBACK_LINES = 5000;
const MAX_PENDING_OUTPUT_CHARS = 1024 * 1024;
const MAX_WRITE_CHARS_PER_FRAME = 64 * 1024;
const OUTPUT_TRUNCATION_NOTICE = '\r\n[CLI Manager] Terminal output was truncated to protect memory.\r\n';

interface TerminalViewProps {
  sessionId: string;
  cliType: CLIType;
  isActive?: boolean;
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
}

export const TerminalView: React.FC<TerminalViewProps> = ({
  sessionId,
  cliType,
  isActive = false,
  onData,
  onResize,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const onResizeRef = useRef(onResize);
  const onDataRef = useRef(onData);
  const pendingOutputRef = useRef<string[]>([]);
  const pendingOutputLengthRef = useRef(0);
  const flushFrameRef = useRef<number | null>(null);
  const wroteTruncationNoticeRef = useRef(false);
  const imagePasteInFlightRef = useRef(false);
  const isActiveRef = useRef(isActive);
  onResizeRef.current = onResize;
  onDataRef.current = onData;
  isActiveRef.current = isActive;

  const syncTerminalSize = () => {
    if (!containerRef.current || !fitAddonRef.current || !xtermRef.current) return;
    if (containerRef.current.clientWidth === 0 || containerRef.current.clientHeight === 0) return;

    try {
      const xterm = xtermRef.current;
      const buffer = xterm.buffer.active;
      const wasAtBottom = buffer.viewportY >= buffer.length - xterm.rows;

      fitAddonRef.current.fit();
      const dims = fitAddonRef.current.proposeDimensions();
      if (dims) {
        onResizeRef.current?.(dims.cols, dims.rows);
      }

      if (xterm.rows > 0) {
        xterm.refresh(0, xterm.rows - 1);
      }

      if (wasAtBottom) {
        xterm.scrollToBottom();
      }
    } catch {
      // Ignore resize errors
    }
  };

  // Initialize terminal - runs once on mount, cleanup on unmount
  useEffect(() => {
    if (!containerRef.current) return;

    console.log('Initializing terminal for session:', sessionId);

    const xterm = new XTerm({
      theme: {
        background: '#1a1a2e',
        foreground: '#eaeaea',
        cursor: '#eaeaea',
        cursorAccent: '#1a1a2e',
        selectionBackground: '#0f3460',
        black: '#000000',
        red: '#e06c75',
        green: '#98c379',
        yellow: '#e5c07b',
        blue: '#61afef',
        magenta: '#c678dd',
        cyan: '#56b6c2',
        white: '#abb2bf',
        brightBlack: '#5c6370',
        brightRed: '#e06c75',
        brightGreen: '#98c379',
        brightYellow: '#e5c07b',
        brightBlue: '#61afef',
        brightMagenta: '#c678dd',
        brightCyan: '#56b6c2',
        brightWhite: '#ffffff',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: TERMINAL_SCROLLBACK_LINES,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);
    xterm.open(containerRef.current);

    // Fit after a small delay to ensure container is rendered
    requestAnimationFrame(() => {
      syncTerminalSize();
    });

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Handle user input
    const dataDisposable = xterm.onData((data) => {
      onDataRef.current?.(data);
    });

    const copySelection = (): boolean => {
      const selection = getCopyableSelectionText(
        xterm.getSelection(),
        window.getSelection()?.toString()
      );
      if (selection) {
        window.cliManagerAPI?.clipboard.writeText(selection);
        xterm.clearSelection();
        return true;
      }
      return false;
    };

    const pasteClipboardImage = async (): Promise<boolean> => {
      if (imagePasteInFlightRef.current) {
        return true;
      }
      imagePasteInFlightRef.current = true;

      try {
        const filePath = await window.cliManagerAPI?.terminal.pasteClipboardImage(sessionId, cliType);
        if (!filePath) {
          xterm.writeln('\r\n[CLI Manager] No clipboard image data was available to paste.');
          return false;
        }
        xterm.focus();
        return true;
      } catch (error) {
        xterm.writeln(`\r\n[CLI Manager] Failed to paste clipboard image: ${error instanceof Error ? error.message : String(error)}`);
        return false;
      } finally {
        imagePasteInFlightRef.current = false;
      }
    };

    const pasteImageData = async (imageData: ArrayBuffer): Promise<boolean> => {
      if (imagePasteInFlightRef.current) {
        return true;
      }
      imagePasteInFlightRef.current = true;

      try {
        const filePath = await window.cliManagerAPI?.terminal.pasteImageData(sessionId, cliType, imageData);
        if (!filePath) {
          xterm.writeln('\r\n[CLI Manager] Pasted image data could not be decoded.');
          return false;
        }
        xterm.focus();
        return true;
      } catch (error) {
        xterm.writeln(`\r\n[CLI Manager] Failed to paste image data: ${error instanceof Error ? error.message : String(error)}`);
        return false;
      } finally {
        imagePasteInFlightRef.current = false;
      }
    };

    const applyPastedText = (text: string | undefined) => {
      if (text) {
        // Use xterm built-in paste path so bracketed paste mode is respected.
        xterm.paste(text);
      }
    };

    const pasteClipboard = () => {
      const hasImage = window.cliManagerAPI?.clipboard.hasImage() ?? false;
      if (hasImage) {
        void pasteClipboardImage();
        return;
      }

      const text = window.cliManagerAPI?.clipboard.readText();
      if (text) {
        applyPastedText(text);
        return;
      }
      void pasteClipboardImage();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isActiveRef.current) return;
      if (event.defaultPrevented) return;

      const shortcutKey = event.metaKey || (event.ctrlKey && !event.altKey);
      const key = event.key.toLowerCase();
      if (shortcutKey && key === 'c' && copySelection()) {
        event.preventDefault();
        return;
      }

      if (shortcutKey && key === 'v') {
        const hasImage = window.cliManagerAPI?.clipboard.hasImage() ?? false;
        if (hasImage) {
          event.preventDefault();
          void pasteClipboardImage();
          return;
        }
      }

      // Support common terminal paste shortcut on Linux/Windows.
      if (event.shiftKey && key === 'insert') {
        event.preventDefault();
        pasteClipboard();
      }
    };

    const handleCopy = (event: ClipboardEvent) => {
      if (!isActiveRef.current) return;

      const selection = getCopyableSelectionText(
        xterm.getSelection(),
        window.getSelection()?.toString()
      );
      if (!selection) return;

      event.preventDefault();
      window.cliManagerAPI?.clipboard.writeText(selection);
      xterm.clearSelection();
    };

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      if (xterm.hasSelection()) {
        copySelection();
      } else {
        pasteClipboard();
      }
    };

    const getPastedImageFile = (event: ClipboardEvent): File | null => {
      const items = Array.from(event.clipboardData?.items ?? []);
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          return item.getAsFile();
        }
      }

      const files = Array.from(event.clipboardData?.files ?? []);
      return files.find((file) => file.type.startsWith('image/')) ?? null;
    };

    const handlePaste = (event: ClipboardEvent) => {
      if (!isActiveRef.current) return;

      const imageFile = getPastedImageFile(event);
      if (imageFile) {
        event.preventDefault();
        event.stopPropagation();
        void imageFile.arrayBuffer()
          .then((imageData) => pasteImageData(imageData))
          .catch(() => pasteClipboardImage());
        return;
      }

      const hasImage = window.cliManagerAPI?.clipboard.hasImage() ?? false;
      if (hasImage) {
        event.preventDefault();
        event.stopPropagation();
        void pasteClipboardImage();
        return;
      }

      const text = event.clipboardData?.getData('text');
      if (text) {
        event.preventDefault();
        event.stopPropagation();
        applyPastedText(text);
        return;
      }
    };

    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (!isActiveRef.current) return;
      if (event.defaultPrevented) return;

      const shortcutKey = event.metaKey || (event.ctrlKey && !event.altKey);
      const key = event.key.toLowerCase();
      if (shortcutKey && key === 'c' && copySelection()) {
        event.preventDefault();
        return;
      }

      if (shortcutKey && key === 'v') {
        const hasImage = window.cliManagerAPI?.clipboard.hasImage() ?? false;
        if (hasImage) {
          event.preventDefault();
          void pasteClipboardImage();
        }
      }
    };

    xterm.attachCustomKeyEventHandler((event) => {
      handleKeyDown(event);
      return !event.defaultPrevented;
    });
    containerRef.current.addEventListener('contextmenu', handleContextMenu);
    containerRef.current.addEventListener('paste', handlePaste, true);
    window.addEventListener('copy', handleCopy, true);
    window.addEventListener('keydown', handleGlobalKeyDown, true);

    // Handle window resize
    const handleWindowResize = () => {
      syncTerminalSize();
    };
    window.addEventListener('resize', handleWindowResize);

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up terminal for session:', sessionId);
      window.removeEventListener('resize', handleWindowResize);
      containerRef.current?.removeEventListener('contextmenu', handleContextMenu);
      containerRef.current?.removeEventListener('paste', handlePaste, true);
      window.removeEventListener('copy', handleCopy, true);
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
      dataDisposable.dispose();
      xterm.dispose();
      if (flushFrameRef.current !== null) {
        cancelAnimationFrame(flushFrameRef.current);
        flushFrameRef.current = null;
      }
      pendingOutputRef.current = [];
      pendingOutputLengthRef.current = 0;
      wroteTruncationNoticeRef.current = false;
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId, cliType]); // Re-initialize when sessionId or CLI type changes

  // Handle incoming data from backend
  useEffect(() => {
    const flushOutput = () => {
      flushFrameRef.current = null;
      const xterm = xtermRef.current;
      if (!xterm) {
        pendingOutputRef.current = [];
        pendingOutputLengthRef.current = 0;
        return;
      }

      const buffer = xterm.buffer.active;
      const wasAtBottom = buffer.viewportY >= buffer.length - xterm.rows;
      let writtenChars = 0;

      while (pendingOutputRef.current.length > 0 && writtenChars < MAX_WRITE_CHARS_PER_FRAME) {
        const next = pendingOutputRef.current[0];
        const remainingFrameChars = MAX_WRITE_CHARS_PER_FRAME - writtenChars;
        const chunk = next.length > remainingFrameChars ? next.slice(0, remainingFrameChars) : next;

        xterm.write(chunk);
        writtenChars += chunk.length;
        pendingOutputLengthRef.current -= chunk.length;

        if (chunk.length === next.length) {
          pendingOutputRef.current.shift();
        } else {
          pendingOutputRef.current[0] = next.slice(chunk.length);
        }
      }

      if (wasAtBottom) {
        requestAnimationFrame(() => {
          xterm.scrollToBottom();
        });
      }

      if (pendingOutputRef.current.length > 0) {
        flushFrameRef.current = requestAnimationFrame(flushOutput);
      }
    };

    const scheduleFlush = () => {
      if (flushFrameRef.current === null) {
        flushFrameRef.current = requestAnimationFrame(flushOutput);
      }
    };

    const enqueueOutput = (data: string) => {
      pendingOutputRef.current.push(data);
      pendingOutputLengthRef.current += data.length;

      if (pendingOutputLengthRef.current > MAX_PENDING_OUTPUT_CHARS) {
        let droppedChars = 0;
        while (
          pendingOutputRef.current.length > 0 &&
          pendingOutputLengthRef.current > MAX_PENDING_OUTPUT_CHARS
        ) {
          const dropped = pendingOutputRef.current.shift()!;
          droppedChars += dropped.length;
          pendingOutputLengthRef.current -= dropped.length;
        }

        if (droppedChars > 0 && !wroteTruncationNoticeRef.current) {
          pendingOutputRef.current.unshift(OUTPUT_TRUNCATION_NOTICE);
          pendingOutputLengthRef.current += OUTPUT_TRUNCATION_NOTICE.length;
          wroteTruncationNoticeRef.current = true;
        }
      }

      scheduleFlush();
    };

    const cleanup = subscribeTerminalData(
      (sid: string, data: string) => {
        if (sid === sessionId && xtermRef.current) {
          enqueueOutput(data);
        }
      }
    );

    return cleanup;
  }, [sessionId]);

  // Handle container resize
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      syncTerminalSize();
    });

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [sessionId]);

  useEffect(() => {
    if (!isActive) return;

    const rafId = requestAnimationFrame(() => {
      syncTerminalSize();
      xtermRef.current?.focus();
      requestAnimationFrame(() => {
        syncTerminalSize();
      });
    });

    return () => cancelAnimationFrame(rafId);
  }, [isActive, sessionId]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-bg-primary"
      style={{ padding: '8px' }}
    />
  );
};
