import React, { useState } from 'react';
import { callApi } from '@app/utils/api';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import type { RedteamPlugin, RedteamStrategy } from '@promptfoo/redteam/types';
import { useRedTeamConfig } from '../hooks/useRedTeamConfig';
import { generateOrderedYaml } from '../utils/yamlHelpers';

export default function Review() {
  const { config, updateConfig } = useRedTeamConfig();
  const theme = useTheme();
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const handleDescriptionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateConfig('description', event.target.value);
  };

  const handleSaveYaml = () => {
    const yamlContent = generateOrderedYaml(config);
    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'promptfooconfig.yaml';
    link.click();
    URL.revokeObjectURL(url);
  };

  const getPluginLabel = (plugin: string | RedteamPlugin) => {
    return typeof plugin === 'string' ? plugin : plugin.id;
  };

  const getStrategyLabel = (strategy: string | RedteamStrategy) => {
    return typeof strategy === 'string' ? strategy : strategy.id;
  };

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const response = await callApi('/redteam/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      const { id } = await response.json();

      // Poll for job status
      const pollInterval = setInterval(async () => {
        const statusResponse = await callApi(`/eval/job/${id}`);
        const status = await statusResponse.json();

        if (status.status === 'complete') {
          clearInterval(pollInterval);
          setIsRunning(false);
          setProgress(null);
          // Optionally redirect to results page
          window.location.href = `/report?id=${status.result.id}`;
        } else if (status.status === 'in-progress') {
          setProgress({
            current: status.progress,
            total: status.total,
          });
        }
      }, 1000);
    } catch (error) {
      console.error('Error running redteam:', error);
      setIsRunning(false);
    }
  };

  return (
    <Box maxWidth="lg" mx="auto">
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 4 }}>
        Review Your Configuration
      </Typography>

      <TextField
        fullWidth
        label="Configuration Description"
        placeholder="My Red Team Configuration"
        value={config.description}
        onChange={handleDescriptionChange}
        variant="outlined"
        sx={{ mb: 4 }}
      />

      <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
        Configuration Summary
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Plugins ({config.plugins?.length || 0})
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {config.plugins?.map((plugin, index) => (
                <Chip key={index} label={getPluginLabel(plugin)} size="small" />
              ))}
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Strategies ({config.strategies?.length || 0})
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {config.strategies?.map((strategy, index) => (
                <Chip key={index} label={getStrategyLabel(strategy)} size="small" />
              ))}
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Additional Details
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2">Purpose</Typography>
                <Typography variant="body2">{config.purpose || 'Not specified'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2">Entities</Typography>
                <Typography variant="body2">{config.entities?.join(', ') || 'None'}</Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      <Divider sx={{ my: 4 }} />

      <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
        Running Your Configuration
      </Typography>

      <Paper elevation={2} sx={{ p: 3 }}>
        <Typography variant="body1" paragraph>
          Follow these steps to run your red team configuration:
        </Typography>
        <ol>
          <li>
            <Typography variant="body1" paragraph>
              Save your configuration as a YAML file:
            </Typography>
            <Button variant="contained" color="primary" onClick={handleSaveYaml} sx={{ mb: 2 }}>
              Save YAML
            </Button>
          </li>
          <li>
            <Typography variant="body1" paragraph>
              Open your terminal in the directory containing your configuration file, and run:
            </Typography>
            <Box
              component="pre"
              sx={{
                p: 2,
                backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5',
                borderRadius: 1,
                fontFamily: 'monospace',
                fontSize: '0.875rem',
              }}
            >
              promptfoo redteam run
            </Box>
          </li>
          <li>
            <Typography variant="body1" paragraph>
              Or run directly from this interface:
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={handleRun}
              disabled={isRunning}
              startIcon={isRunning && <CircularProgress size={20} color="inherit" />}
            >
              {isRunning ? 'Running...' : 'Run Now'}
            </Button>
            {progress && (
              <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                Progress: {progress.current}/{progress.total}
              </Typography>
            )}
          </li>
        </ol>
      </Paper>
    </Box>
  );
}
