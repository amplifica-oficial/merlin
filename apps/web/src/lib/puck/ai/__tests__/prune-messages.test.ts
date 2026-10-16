import {describe, expect, it} from 'vitest';

import {isUserTurn, pruneMessages, stripReasoningMetadata} from '../prune-messages';

describe('pruneMessages', () => {
  it('keeps a short history intact', () => {
    const messages = [
      {role: 'user', id: '1'},
      {role: 'assistant', id: '2'},
    ];
    expect(pruneMessages(messages, 20)).toEqual(messages);
  });

  it('starts the window on a user message', () => {
    const messages = [
      {role: 'user', id: '1'},
      {role: 'assistant', id: '2'},
      {role: 'assistant', id: '3'},
      {role: 'user', id: '4'},
      {role: 'assistant', id: '5'},
    ];
    expect(pruneMessages(messages, 3).map(item => item.id)).toEqual(['4', '5']);
  });
});

describe('stripReasoningMetadata', () => {
  it('removes encrypted reasoning content, keeps the item id, and does not mutate the input', () => {
    const messages = [
      {
        role: 'assistant',
        parts: [
          {type: 'text', text: 'ok', providerMetadata: {openai: {itemId: 'msg_1'}}},
          {
            type: 'reasoning',
            text: 'pensar',
            providerMetadata: {openai: {itemId: 'rs_1', reasoningEncryptedContent: 'blob'}},
          },
          {type: 'tool-get_page', toolCallId: 'call-1', state: 'output-available'},
        ],
      },
    ];

    const stripped = stripReasoningMetadata(messages);
    const reasoning = stripped[0]?.parts[1];

    expect(reasoning).toEqual({
      type: 'reasoning',
      text: 'pensar',
      providerMetadata: {openai: {itemId: 'rs_1'}},
    });
    expect(stripped[0]?.parts[0]).toBe(messages[0]?.parts[0]);
    expect(stripped[0]?.parts[2]).toBe(messages[0]?.parts[2]);
    expect(messages[0]?.parts[1]?.providerMetadata.openai.reasoningEncryptedContent).toBe('blob');
  });
});

describe('isUserTurn', () => {
  it('is true only when the last message is from the user', () => {
    expect(isUserTurn([{role: 'user'}])).toBe(true);
    expect(isUserTurn([{role: 'user'}, {role: 'assistant'}])).toBe(false);
    expect(isUserTurn([])).toBe(false);
  });
});
