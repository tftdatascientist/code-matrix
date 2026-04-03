import { useState, useEffect, useRef, useCallback } from 'react';
import type { WSMessage } from '../types/protocol';

interface CommandInputProps {
  send: (channel: string, payload: unknown) => void;
  subscribe: (channel: string, handler: (msg: WSMessage) => void) => () => void;
  autoShow?: boolean;
}

const MAX_LENGTH = 10000;

export function CommandInput({ send, autoShow = false }: CommandInputProps) {
  const [visible, setVisible] = useState(autoShow);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Ctrl+/ toggle
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        setVisible(v => !v);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Focus input when visible
  useEffect(() => {
    if (visible) {
      inputRef.current?.focus();
    }
  }, [visible]);

  const sendCommand = useCallback((type: 'text' | 'interrupt' | 'confirm', text?: string) => {
    send('command:input', { type, text });
  }, [send]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;

    sendCommand('text', trimmed);
    setValue('');
  }, [value, sendCommand]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setVisible(false);
      return;
    }
    // Enter = submit, Shift+Enter = new line
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
      return;
    }
  }, [handleSubmit]);

  const handleInterrupt = useCallback(() => {
    sendCommand('interrupt');
  }, [sendCommand]);

  const handleConfirmAction = useCallback(() => {
    sendCommand('confirm');
  }, [sendCommand]);

  if (!visible) return null;

  return (
    <div className="command-input">
      <div className="command-input__header">
        <span className="command-input__lock">🔒 COMMAND MODE</span>
      </div>
      <div className="command-input__field">
        <span className="command-input__prompt">&gt;</span>
        <textarea
          ref={inputRef}
          className="command-input__textarea"
          value={value}
          onChange={e => setValue(e.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={handleKeyDown}
          placeholder="Type command..."
          rows={1}
          spellCheck={false}
        />
      </div>
      <div className="command-input__footer">
        <span>ENTER send</span>
        <span className="command-input__sep">│</span>
        <span>ESC hide</span>
        <span className="command-input__sep">│</span>
        <button className="command-input__btn" onClick={handleInterrupt}>Ctrl+C</button>
        <span className="command-input__sep">│</span>
        <button className="command-input__btn" onClick={handleConfirmAction}>Enter (y/n)</button>
      </div>
    </div>
  );
}
