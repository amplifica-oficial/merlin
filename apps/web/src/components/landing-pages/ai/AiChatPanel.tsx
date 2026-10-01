import {Button, IconSpinner, Textarea} from '@merlin/ui';
import type {LandingAiPickedElement} from '@merlin/types';
import type {UIMessage} from 'ai';
import {Sparkles, Square, Undo2} from 'lucide-react';
import {useState, type KeyboardEvent} from 'react';

import {InspectorToggle} from './InspectorToggle';
import {useLandingAi} from './LandingAiProvider';
import {PickedElementChips} from './PickedElementChips';

const SUGGESTIONS = [
  'Melhore o copy desta página',
  'Adicione um FAQ no final',
  'Deixe o hero mais escuro com CSS',
  'Crie uma landing do zero para um SaaS',
];

export function AiChatPanel() {
  const {enabled, loadingEnabled, messages, status, error, sendText, stop, appliedCount, undoLast, pickedElements} =
    useLandingAi();
  const [input, setInput] = useState('');
  const busy = status === 'submitted' || status === 'streaming';

  const onSubmit = () => {
    if (!input.trim() || busy || !enabled) {
      return;
    }
    sendText(input);
    setInput('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  };

  if (loadingEnabled) {
    return (
      <div className="flex h-full items-center justify-center">
        <IconSpinner />
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="flex h-full flex-col gap-2 p-3 text-sm text-neutral-600">
        <p className="font-medium text-neutral-900">Assistente de IA</p>
        <p>Defina <code className="rounded bg-neutral-100 px-1">OPENAI_API_KEY</code> na API para ativar o editor com IA.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-neutral-200 px-3 py-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-neutral-900">
          <Sparkles className="h-4 w-4" />
          Assistente
        </div>
        <div className="flex items-center gap-1">
          <InspectorToggle compact />
          {appliedCount > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={undoLast}>
              <Undo2 className="h-3.5 w-3.5" />
              Desfazer
            </Button>
          ) : null}
        </div>
      </div>

      {appliedCount > 0 ? (
        <p className="border-b border-neutral-100 px-3 py-1.5 text-xs text-neutral-500">
          Aplicado: {appliedCount} {appliedCount === 1 ? 'alteração' : 'alterações'}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-neutral-500">
              Peça para editar texto, estilo, ou adicionar blocos. Use o inspetor (ponteiro) para marcar qualquer
              elemento. Texto fixo no markup do componente só pode ser estilizado, não reescrito.
            </p>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map(suggestion => (
                <button
                  key={suggestion}
                  type="button"
                  className="rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50"
                  onClick={() => sendText(suggestion)}
                  disabled={busy}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(message => <ChatMessage key={message.id} message={message} />)
        )}
        {error ? <p className="text-xs text-red-600">{error.message}</p> : null}
      </div>

      <div className="border-t border-neutral-200 p-2">
        <PickedElementChips />
        <Textarea
          value={input}
          onChange={event => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            pickedElements.length > 0
              ? `Descreva a mudança para os ${pickedElements.length} elementos (use #1, #2...)`
              : 'Descreva a mudança…'
          }
          disabled={busy}
          className="min-h-18 resize-none"
        />
        <div className="mt-2 flex justify-end gap-2">
          {busy ? (
            <Button type="button" variant="outline" size="sm" onClick={() => stop()}>
              <Square className="h-3.5 w-3.5" />
              Parar
            </Button>
          ) : (
            <Button type="button" size="sm" disabled={!input.trim()} onClick={onSubmit}>
              Enviar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function pickedFromMessage(message: UIMessage): LandingAiPickedElement[] {
  const metadata = message.metadata;
  if (metadata && typeof metadata === 'object' && 'pickedElements' in metadata) {
    const value = (metadata as {pickedElements?: unknown}).pickedElements;
    return Array.isArray(value) ? (value as LandingAiPickedElement[]) : [];
  }
  return [];
}

function ChatMessage({message}: {message: UIMessage}) {
  const isUser = message.role === 'user';
  const picked = pickedFromMessage(message);
  return (
    <div className={`rounded-md px-2 py-1.5 text-xs leading-relaxed ${isUser ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-800'}`}>
      {picked.length > 0 ? (
        <p className={`mb-1 text-[10px] ${isUser ? 'text-neutral-300' : 'text-neutral-500'}`}>
          {picked.map(item => `${item.tag}${item.blockType ? ` · ${item.blockType}` : ''}`).join(', ')}
        </p>
      ) : null}
      {message.parts.map((part, index) => {
        if (part.type === 'text') {
          return (
            <p key={`${message.id}-text-${index}`} className="whitespace-pre-wrap">
              {part.text}
            </p>
          );
        }
        if (part.type.startsWith('tool-')) {
          const toolName = part.type.slice('tool-'.length);
          const state = 'state' in part ? String(part.state) : '';
          const label = toolLabel(toolName, state);
          return (
            <span
              key={`${message.id}-tool-${index}`}
              className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] ${
                state === 'output-error' ? 'bg-red-100 text-red-700' : 'bg-white text-neutral-600'
              }`}
            >
              {label}
            </span>
          );
        }
        return null;
      })}
    </div>
  );
}

function toolLabel(name: string, state: string): string {
  const labels: Record<string, string> = {
    get_block: 'Lendo bloco',
    get_component_schema: 'Lendo schema',
    get_page: 'Lendo página',
    list_forms: 'Listando forms',
    update_block: 'Atualizando bloco',
    update_block_prop: 'Atualizando campo',
    insert_block: 'Inserindo bloco',
    move_block: 'Movendo bloco',
    remove_block: 'Removendo bloco',
    duplicate_block: 'Duplicando bloco',
    set_block_css: 'Aplicando CSS',
    set_element_style: 'Estilizando elemento',
    set_page_style: 'Estilizando página',
    update_page: 'Atualizando página',
    replace_page: 'Substituindo página',
  };
  const base = labels[name] ?? name;
  if (state === 'output-error') {
    return `${base} falhou`;
  }
  if (state === 'output-available') {
    return `${base} ✓`;
  }
  return base;
}
