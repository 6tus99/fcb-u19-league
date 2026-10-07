import React, { useState, useEffect } from 'react';
import TextField from '@mui/material/TextField';

// Editable table cell. Keeps its OWN copy of the value (local state) and
// saves on blur/Enter only when something actually changed.
//
// Why the local copy matters: if the cell compared the typed text against
// the row's live state, the state would already have been updated on every
// keystroke — the values would always look "equal" and the save would
// silently never happen.
export default function EditableCell({ value, onSave, label, width = 160, placeholder }) {
  const [text, setText] = useState(value ?? '');

  // Re-sync when the database value changes (page load, after a save).
  useEffect(() => {
    setText(value ?? '');
  }, [value]);

  const commit = () => {
    const next = text.trim();
    if (next !== (value ?? '')) onSave(next);
  };

  return (
    <TextField
      size="small"
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      sx={{ minWidth: width }}
      inputProps={{ 'aria-label': label }}
    />
  );
}
