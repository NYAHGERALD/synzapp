import React from 'react';

/**
 * A dropdown that stays inside the window.
 *
 * A plain browser dropdown holding 51 states is drawn by the browser itself, at
 * whatever height it likes — down the whole page, over the form, past the
 * bottom of the screen. No stylesheet can shorten it, because the list is not
 * part of the page. So the list is built here instead: it scrolls inside a
 * fixed height, opens upwards when there is more room above, and can be typed
 * into once the list is long enough that scanning it is work.
 */

/** Narrow a list to what somebody is typing. Exported so it can be tested on its own. */
export function filterComboboxOptions(options: string[], query: string): string[] {
  const trimmed = query.trim().toLowerCase();

  if (!trimmed) {
    return options;
  }

  // Anything starting with what was typed comes first: typing "ma" should offer
  // Maine before Alabama, even though both contain the letters.
  const startsWith = options.filter((option) => option.toLowerCase().startsWith(trimmed));
  const contains = options.filter(
    (option) => !option.toLowerCase().startsWith(trimmed) && option.toLowerCase().includes(trimmed)
  );

  return [...startsWith, ...contains];
}

/** Rows above this many get a search box; below it, scanning is quicker than typing. */
export const SEARCHABLE_OPTION_COUNT = 8;

const MIN_POPUP_HEIGHT = 168;
const MAX_POPUP_HEIGHT = 288;
const VIEWPORT_MARGIN = 16;

export interface ComboboxPlacement {
  dropUp: boolean;
  maxHeight: number;
}

/**
 * Decide where the list goes and how tall it may be.
 *
 * Kept separate from the component so the awkward cases — a field near the
 * bottom of the window, a short window — can be checked without a browser.
 */
export function measureComboboxPlacement(input: {
  triggerBottom: number;
  triggerTop: number;
  viewportHeight: number;
}): ComboboxPlacement {
  const roomBelow = input.viewportHeight - input.triggerBottom - VIEWPORT_MARGIN;
  const roomAbove = input.triggerTop - VIEWPORT_MARGIN;
  const dropUp = roomBelow < MIN_POPUP_HEIGHT && roomAbove > roomBelow;
  const room = dropUp ? roomAbove : roomBelow;

  return {
    dropUp,
    // Never taller than the room available, and never so short it is unusable —
    // a cramped list that scrolls beats one that runs off the screen.
    maxHeight: Math.max(MIN_POPUP_HEIGHT, Math.min(MAX_POPUP_HEIGHT, room))
  };
}

export function Combobox(props: {
  id: string;
  labelledBy: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  value: string;
}): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [placement, setPlacement] = React.useState<ComboboxPlacement>({
    dropUp: false,
    maxHeight: MAX_POPUP_HEIGHT
  });

  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const searchRef = React.useRef<HTMLInputElement | null>(null);
  const listRef = React.useRef<HTMLUListElement | null>(null);

  const searchable = props.options.length > SEARCHABLE_OPTION_COUNT;
  const visible = filterComboboxOptions(props.options, searchable ? query : '');

  const closePopup = React.useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const openPopup = React.useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();

    if (rect) {
      setPlacement(
        measureComboboxPlacement({
          triggerBottom: rect.bottom,
          triggerTop: rect.top,
          viewportHeight: window.innerHeight
        })
      );
    }

    const current = props.options.indexOf(props.value);
    setActiveIndex(current >= 0 ? current : 0);
    setQuery('');
    setOpen(true);
  }, [props.options, props.value]);

  // Clicking anywhere else puts the list away, the same as a browser dropdown.
  React.useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        closePopup();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [closePopup, open]);

  React.useEffect(() => {
    if (open && searchable) {
      searchRef.current?.focus();
    }
  }, [open, searchable]);

  // Keep the highlighted row in view while the arrow keys move down a long list.
  React.useEffect(() => {
    if (!open) {
      return;
    }

    const row = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    row?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const choose = (option: string) => {
    props.onChange(option);
    closePopup();
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPopup();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, visible.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(Math.max(visible.length - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (visible[activeIndex]) {
        choose(visible[activeIndex]);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closePopup();
      triggerRef.current?.focus();
    } else if (event.key === 'Tab') {
      closePopup();
    }
  };

  return (
    <div className="combobox" ref={rootRef}>
      <button
        aria-controls={`${props.id}-list`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={`${props.labelledBy} ${props.id}-value`}
        className={`combobox-trigger${props.value ? '' : ' is-empty'}`}
        id={props.id}
        onClick={() => (open ? closePopup() : openPopup())}
        onKeyDown={handleKeyDown}
        ref={triggerRef}
        type="button"
      >
        <span id={`${props.id}-value`}>{props.value || props.placeholder || 'Choose…'}</span>
        <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open ? (
        <div
          className={`combobox-popup${placement.dropUp ? ' is-above' : ''}`}
          style={{ maxHeight: `${placement.maxHeight}px` }}
        >
          {searchable ? (
            <input
              aria-activedescendant={
                visible[activeIndex] ? `${props.id}-option-${activeIndex}` : undefined
              }
              aria-controls={`${props.id}-list`}
              autoComplete="off"
              className="combobox-search"
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type to narrow the list"
              ref={searchRef}
              role="combobox"
              aria-expanded="true"
              type="text"
              value={query}
            />
          ) : null}

          <ul className="combobox-list" id={`${props.id}-list`} ref={listRef} role="listbox">
            {visible.length ? (
              visible.map((option, index) => (
                <li
                  aria-selected={option === props.value}
                  className={`combobox-option${index === activeIndex ? ' is-active' : ''}`}
                  id={`${props.id}-option-${index}`}
                  key={option}
                  onClick={() => choose(option)}
                  onMouseEnter={() => setActiveIndex(index)}
                  role="option"
                >
                  {option}
                </li>
              ))
            ) : (
              <li className="combobox-empty">Nothing matches “{query}”.</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
