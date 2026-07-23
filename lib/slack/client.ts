/**
 * Slack Integration Utility
 * Digunakan untuk mengirimkan notifikasi dan alert ke Slack melalui Incoming Webhooks.
 */

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

export type SlackMessageLevel = 'info' | 'warning' | 'error' | 'success';

interface SendSlackOptions {
  message: string;
  level?: SlackMessageLevel;
  context?: Record<string, any>;
}

export async function sendSlackNotification({
  message,
  level = 'info',
  context,
}: SendSlackOptions) {
  if (!SLACK_WEBHOOK_URL) {
    console.warn('Slack Webhook URL is not configured. Message not sent:', message);
    return;
  }

  // Menentukan warna berdasarkan level
  let color = '#36a64f'; // Default success/info (hijau)
  let emoji = 'ℹ️';

  switch (level) {
    case 'error':
      color = '#FF0000'; // Merah
      emoji = '🚨';
      break;
    case 'warning':
      color = '#FFCC00'; // Kuning
      emoji = '⚠️';
      break;
    case 'success':
      color = '#36a64f'; // Hijau
      emoji = '✅';
      break;
    case 'info':
    default:
      color = '#439FE0'; // Biru
      emoji = 'ℹ️';
      break;
  }

  const payload = {
    text: `${emoji} *Nizam ERP Notification*`,
    attachments: [
      {
        color: color,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: message,
            },
          },
        ],
      },
    ],
  };

  // Menambahkan context/metadata jika ada
  if (context && Object.keys(context).length > 0) {
    const contextText = Object.entries(context)
      .map(([key, value]) => `*${key}*: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
      .join('\n');
      
    payload.attachments[0].blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Context:*\n${contextText}`,
      },
    });
  }

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('Failed to send Slack notification:', response.statusText);
    }
  } catch (error) {
    console.error('Error sending Slack notification:', error);
  }
}
