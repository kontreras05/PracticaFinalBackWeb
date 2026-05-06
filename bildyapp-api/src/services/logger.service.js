import { config } from '../config/index.js';

const sendToSlack = (payload) => {
  if (!config.slack.webhookUrl) return;
  void fetch(config.slack.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `*[ERROR 5XX]* \`${payload.method} ${payload.path}\`\n*${payload.message}*\n\`\`\`${payload.stack ?? ''}\`\`\``,
      attachments: [{ text: payload.timestamp, color: 'danger' }],
    }),
  }).catch((err) => console.error('[LOGGER] Slack webhook falló:', err.message));
};

export const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),

  notifyError(err, req) {
    console.error('[ERROR]', err.message);
    sendToSlack({
      timestamp: new Date().toISOString(),
      method: req?.method ?? 'UNKNOWN',
      path: req?.originalUrl ?? 'UNKNOWN',
      message: err.message,
      stack: err.stack,
    });
  },
};
