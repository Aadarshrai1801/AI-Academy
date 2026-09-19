import { MessagesService } from './messages.service.js';

describe('Direct Messages', () => {
  it('generates symmetric, sorted conversation IDs', () => {
    const cid1 = MessagesService.dmConversationId('user_alpha', 'user_beta');
    const cid2 = MessagesService.dmConversationId('user_beta', 'user_alpha');
    expect(cid1).toBe('user_alpha:user_beta');
    expect(cid2).toBe('user_alpha:user_beta');
  });

  it('handles arbitrary clerk IDs reliably', () => {
    const cid = MessagesService.dmConversationId('user_2xyz987', 'user_1abc123');
    expect(cid).toBe('user_1abc123:user_2xyz987');
  });
});
