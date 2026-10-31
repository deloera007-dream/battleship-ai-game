import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';

afterEach(() => vi.useRealTimers());
const click = (name) => fireEvent.click(screen.getByRole('button', { name }));
function begin() {
  click('Randomize');
  click(/Start battle/);
}

describe('game interface', () => {
  it('starts with two full grids, concealed enemy ships, and a gated start', () => {
    render(<App />);
    expect(screen.getAllByRole('button', { name: /^Your [A-J]\d+:/ })).toHaveLength(100);
    expect(screen.getAllByRole('button', { name: /^Enemy [A-J]\d+:/ })).toHaveLength(100);
    expect(screen.getByRole('button', { name: /Start battle/ })).toBeDisabled();
    click('Enemy A1: water');
    expect(screen.getByRole('button', { name: 'Enemy A1: water' })).toBeInTheDocument();
  });
  it('places manually, rejects overlap and boundary overflow, rotates, and clears', () => {
    render(<App />);
    click('Your A8: water');
    expect(screen.getByText(/That ship won’t fit/)).toBeInTheDocument();
    click('Your A1: water');
    expect(screen.getByText('Carrier deployed at A1.')).toBeInTheDocument();
    click('Your A1: Carrier');
    expect(screen.getByText(/That ship won’t fit/)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'r' });
    expect(screen.getByRole('button', { name: /Vertical/ })).toBeInTheDocument();
    click('Your B1: water');
    expect(screen.getByRole('button', { name: 'Your E1: Battleship' })).toBeInTheDocument();
    click('Clear');
    expect(screen.getByText('0 of 5 ships deployed')).toBeInTheDocument();
  });
  it('places all five ships manually and permits repositioning', () => {
    render(<App />);
    for (const letter of ['A', 'C', 'E', 'G', 'I']) click(`Your ${letter}1: water`);
    expect(screen.getByRole('button', { name: /Start battle/ })).toBeEnabled();
    click(/^Carrier/);
    click('Your B1: water');
    expect(screen.getByRole('button', { name: 'Your A1: water' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Your B1: Carrier' })).toBeInTheDocument();
  });
  it('randomizes, hides enemy positions, and blocks duplicate and out-of-turn firing', () => {
    vi.useFakeTimers();
    render(<App />);
    begin();
    expect(screen.getAllByRole('button', { name: /^Enemy [A-J]\d+: water$/ })).toHaveLength(100);
    click('Enemy A1: water');
    expect(screen.getByText('Opponent is plotting a course…')).toBeInTheDocument();
    click('Enemy A2: water');
    expect(screen.getByRole('button', { name: 'Enemy A2: water' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(650));
    expect(screen.getByText('Your turn. Pick a target.')).toBeInTheDocument();
    click(/^Enemy A1:/);
    expect(screen.getByText('Your turn. Pick a target.')).toBeInTheDocument();
  });
  it('cancels pending AI actions when restarting and resets every game field', () => {
    vi.useFakeTimers();
    render(<App />);
    begin();
    click('Enemy A1: water');
    click(/New game/i);
    expect(screen.getByRole('dialog', { name: 'Chart a new course?' })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'New game' }));
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByText('0 of 5 ships deployed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start battle/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Enemy A1: water' })).toBeInTheDocument();
  });
  it('can cancel restart and open and dismiss help', () => {
    render(<App />);
    click('Randomize');
    click(/New game/i);
    click('Keep playing');
    expect(screen.getByText('5 of 5 ships deployed')).toBeInTheDocument();
    click(/How to play/);
    expect(screen.getByRole('dialog', { name: 'Welcome aboard, Captain.' })).toBeInTheDocument();
    click('Ready, Captain');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('keeps an explicit accessible name when the mobile help text is hidden', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /How to play/ })).toHaveAttribute(
      'aria-label',
      'How to play',
    );
  });
  it.each(['Escape', 'close button', 'backdrop'])(
    'restores help trigger focus after dismissal via %s',
    (method) => {
      render(<App />);
      const trigger = screen.getByRole('button', { name: /How to play/ });
      trigger.focus();
      fireEvent.click(trigger);
      const dialog = screen.getByRole('dialog');
      within(dialog).getByRole('button', { name: 'Ready, Captain' }).focus();
      if (method === 'Escape') {
        fireEvent(dialog, new Event('cancel', { cancelable: true }));
      } else if (method === 'close button') {
        fireEvent.click(within(dialog).getByRole('button', { name: 'Close dialog' }));
      } else {
        fireEvent.click(dialog);
      }
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    },
  );
  it('restores new-game trigger focus after confirming a restart', () => {
    render(<App />);
    click('Randomize');
    const trigger = screen.getByRole('button', { name: /New game/i });
    trigger.focus();
    fireEvent.click(trigger);
    const confirm = within(screen.getByRole('dialog')).getByRole('button', { name: 'New game' });
    confirm.focus();
    fireEvent.click(confirm);
    expect(screen.getByText('0 of 5 ships deployed')).toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it('supports bounded arrow-key navigation on the board', () => {
    render(<App />);
    const first = screen.getByRole('button', { name: 'Your A1: water' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: 'Your A2: water' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' });
    expect(screen.getByRole('button', { name: 'Your B2: water' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement, { key: 'End' });
    expect(screen.getByRole('button', { name: 'Your B10: water' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement, { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: 'Your B10: water' })).toHaveFocus();
  });
});
