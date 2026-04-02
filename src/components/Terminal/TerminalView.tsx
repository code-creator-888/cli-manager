import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

interface TerminalViewProps {
  sessionId: string;
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
}

export const TerminalView: React.FC<TerminalViewProps> = ({
  sessionId,
  onData,
  onResize,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

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
      scrollback: 10000,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);
    xterm.open(containerRef.current);

    // Fit after a small delay to ensure container is rendered
    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Handle user input
    const dataDisposable = xterm.onData((data) => {
      if (onData) {
        onData(data);
      }
    });

    // Handle window resize
    const handleWindowResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch (e) {
          // Ignore
        }
      }
    };
    window.addEventListener('resize', handleWindowResize);

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up terminal for session:', sessionId);
      window.removeEventListener('resize', handleWindowResize);
      dataDisposable.dispose();
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId]); // Re-initialize when sessionId changes

  // Handle incoming data from backend
  useEffect(() => {
    if (!window.cliManagerAPI) return;

    console.log('Setting up data listener for session:', sessionId);

    const cleanup = window.cliManagerAPI.terminal.onData(
      (sid: string, data: string) => {
        if (sid === sessionId && xtermRef.current) {
          xtermRef.current.write(data);
        }
      }
    );

    return cleanup;
  }, [sessionId]);

  // Handle container resize
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      if (fitAddonRef.current && xtermRef.current) {
        try {
          fitAddonRef.current.fit();
          const dims = fitAddonRef.current.proposeDimensions();
          if (dims && window.cliManagerAPI) {
            window.cliManagerAPI.terminal.resize(sessionId, dims.cols, dims.rows);
          }
        } catch (e) {
          // Ignore resize errors
        }
      }
    });

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [sessionId]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-bg-primary"
      style={{ padding: '8px' }}
    />
  );
};
