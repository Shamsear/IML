export function handleSmartAssistInputKeyDown(e, showSuggestions, getOptionsCount) {
  if (!showSuggestions || getOptionsCount() === 0) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const listNode = e.target.nextElementSibling;
    if (listNode && listNode.tagName === 'DIV') {
      const buttons = listNode.querySelectorAll('button');
      if (buttons.length > 0) buttons[0].focus();
    }
  }
}

export function handleSmartAssistInputBlur(e, hideCallback) {
  // If the focus is moving to one of our suggestion buttons, don't hide
  if (e.relatedTarget && e.relatedTarget.getAttribute('data-smart-assist') === 'true') {
    return;
  }
  setTimeout(hideCallback, 250);
}

export function handleSmartAssistButtonKeyDown(e, inputRefOrId) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const listNode = e.target.parentElement;
    const buttons = Array.from(listNode.querySelectorAll('button'));
    const idx = buttons.indexOf(e.target);
    
    if (e.key === 'ArrowDown') {
      if (idx < buttons.length - 1) buttons[idx + 1].focus();
    } else if (e.key === 'ArrowUp') {
      if (idx > 0) {
        buttons[idx - 1].focus();
      } else {
        // Focus back to input
        const input = listNode.previousElementSibling;
        if (input && input.tagName === 'INPUT') {
          input.focus();
        } else if (typeof inputRefOrId === 'string') {
          document.getElementById(inputRefOrId)?.focus();
        }
      }
    }
  }
}
