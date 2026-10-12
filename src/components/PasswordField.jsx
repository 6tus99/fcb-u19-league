import React, { useState } from 'react';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import VisibilityRounded from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRounded from '@mui/icons-material/VisibilityOffRounded';

// Password field with an optional show/hide toggle (the little eye button).
// Use it exactly like a TextField — it forwards all props.
export default function PasswordField(props) {
  const [show, setShow] = useState(false);
  return (
    <TextField
      {...props}
      type={show ? 'text' : 'password'}
      InputProps={{
        ...props.InputProps,
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              onClick={() => setShow(!show)}
              edge="end"
              size="small"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <VisibilityOffRounded fontSize="small" /> : <VisibilityRounded fontSize="small" />}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );
}
