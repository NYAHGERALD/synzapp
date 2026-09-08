import { describe, expect, it } from 'vitest';
import { getFooterTabLabel } from './footerTabLabels';

describe('what the footer calls a tab', () => {
  it('shortens the one word that does not fit', () => {
    expect(getFooterTabLabel('Announcements')).toBe('Notices');
  });

  it('leaves every other tab exactly as it is', () => {
    ['Chats', 'Calls', 'Employees', 'Settings', 'You'].forEach((tab) => {
      expect(getFooterTabLabel(tab)).toBe(tab);
    });
  });

  it('gives back anything it does not know about', () => {
    expect(getFooterTabLabel('Something New')).toBe('Something New');
  });
});
