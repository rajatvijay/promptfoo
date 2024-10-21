import { useState, useEffect } from 'react';
import useApiConfig from '@app/stores/apiConfig';
import { useGlobalStore } from '@app/stores/globalStore';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ApiSchemas } from '@server/apiSchemas';

export default function ApiSettingsModal<T extends { open: boolean; onClose: () => void }>({
  open,
  onClose,
}: T) {
  const { apiBaseUrl, setApiBaseUrl, enablePersistApiBaseUrl } = useApiConfig();
  const { userEmail, setUserEmail } = useGlobalStore();
  const [tempApiBaseUrl, setTempApiBaseUrl] = useState(apiBaseUrl || '');
  const [tempEmail, setTempEmail] = useState(userEmail || '');
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    setTempApiBaseUrl(apiBaseUrl || '');
    setTempEmail(userEmail || '');
    setEmailError(null);
  }, [apiBaseUrl, userEmail, open]);

  const handleApiBaseUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTempApiBaseUrl(event.target.value);
  };

  const validateEmail = (email: string) => {
    if (email === '') {
      setEmailError(null);
      return;
    }
    const result = ApiSchemas.User.Update.Request.safeParse({ email });
    if (result.success) {
      setEmailError(null);
    } else {
      setEmailError('Invalid email format');
    }
  };

  const handleEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = event.target.value;
    setTempEmail(newEmail);
    validateEmail(newEmail);
  };

  const handleSave = () => {
    if (!emailError) {
      setApiBaseUrl(tempApiBaseUrl);
      enablePersistApiBaseUrl();
      setUserEmail(tempEmail || null); // Set to null if empty string
      onClose();
    }
  };

  const isSaveDisabled = !!emailError || !tempApiBaseUrl;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="api-settings-dialog-title"
    >
      <DialogTitle id="api-settings-dialog-title">API and User Settings</DialogTitle>
      <DialogContent>
        <Typography variant="h6">API</Typography>
        <TextField
          label="API Base URL"
          helperText="The promptfoo API the webview will connect to"
          value={tempApiBaseUrl}
          onChange={handleApiBaseUrlChange}
          fullWidth
          margin="normal"
          error={!tempApiBaseUrl}
        />
        <Typography variant="h6" sx={{ mt: 2 }}>
          User
        </Typography>
        <TextField
          label="Email"
          helperText={emailError || 'Your email address (optional)'}
          value={tempEmail}
          onChange={handleEmailChange}
          fullWidth
          margin="normal"
          error={!!emailError}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleSave} disabled={isSaveDisabled}>
          Save
        </Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
