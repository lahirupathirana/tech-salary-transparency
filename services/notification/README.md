# Notification Service

Event-driven notification service for PayFloor. Handles sending emails and storing notification history for salary submissions, approvals, and community votes.

## Features

- **Event API** — Receive notification events from other services via HTTP POST
- **Email Delivery** — Send emails via SMTP (configurable)
- **Persistence** — Store all notifications in `community.notifications` table for audit trail
- **Query History** — Retrieve notification history for each user
- **Unread Count** — Quick endpoint to get pending (unread) notification count
- **Stateless & Scalable** — Horizontally scalable; no session affinity required

## Endpoints

### POST /notify
Send a notification event.

**Body:**
```json
{
  "type": "submission_approved|vote_threshold_reached|custom",
  "recipientToken": "opaque-uuid",
  "recipientEmail": "user@example.com",
  "data": {
    "submissionId": "uuid",
    "company": "Google",
    "role": "Software Engineer",
    "netScore": 5
  }
}
```

**Response:**
```json
{
  "type": "submission_approved",
  "status": "sent"
}
```

### GET /notifications/:recipientToken
Get notification history for a user.

**Query Parameters:**
- `limit` (default: 20, max: 100)
- `offset` (default: 0)

**Response:**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "submission_approved",
      "status": "sent",
      "createdAt": "2026-04-24T10:00:00Z",
      "data": {...}
    }
  ]
}
```

### GET /notifications-count/:recipientToken
Get count of unread notifications.

**Response:**
```json
{
  "unread": 3
}
```

## Configuration

| Env Var | Default | Purpose |
|---------|---------|---------|
| `PORT` | 4006 | Service port |
| `DATABASE_URL` | — | PostgreSQL connection string (required) |
| `SMTP_HOST` | localhost | Email server host |
| `SMTP_PORT` | 1025 | Email server port |
| `SMTP_USER` | — | Email auth username |
| `SMTP_PASS` | — | Email auth password |
| `SMTP_FROM` | noreply@payfloor.dev | Email sender address |

## Database Schema

```sql
CREATE TABLE community.notifications (
    id              UUID PRIMARY KEY,
    recipient_token UUID NOT NULL,
    type            VARCHAR(50) NOT NULL,
    email           VARCHAR(255),
    data            JSONB,
    status          VARCHAR(20),
    error           TEXT,
    created_at      TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ
);
```

## Integration

The notification service is called by other PayFloor services to send notifications:

```javascript
// Example: called by vote service when threshold is reached
fetch('http://notification:4006/notify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'vote_threshold_reached',
    recipientToken: submission.submitterToken,
    recipientEmail: user.email,
    data: { submissionId, netScore }
  })
});
```

## Deployment

### Docker Compose

```bash
docker app run -d \
  -e PORT=4006 \
  -e DATABASE_URL=postgres://tst_user:password@postgres:5432/tst_db \
  -e SMTP_HOST=mailhog \
  -e SMTP_PORT=1025 \
  ghcr.io/lahirupathirana/tst-notification:latest
```

### Kubernetes

```bash
kubectl apply -f k8s/notification/deployment.yaml
kubectl apply -f k8s/notification/service.yaml
```

## Development

```bash
npm install
npm run dev
```

## License

MIT

