import {describe, expect, it} from 'vitest';

import {isUserTurn, pruneMessages} from '../prune-messages';

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

describe('isUserTurn', () => {
  it('is true only when the last message is from the user', () => {
    expect(isUserTurn([{role: 'user'}])).toBe(true);
    expect(isUserTurn([{role: 'user'}, {role: 'assistant'}])).toBe(false);
    expect(isUserTurn([])).toBe(false);
  });
});
