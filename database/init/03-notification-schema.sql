-- ============================================================================
-- Migration 03: Add notifications table for the notification service
-- ============================================================================
CREATE TABLE IF NOT EXISTS community.notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_token UUID NOT NULL,
    type            VARCHAR(50) NOT NULL,
    email           VARCHAR(255),
    data            JSONB,
    status          VARCHAR(20) DEFAULT 'pending',
    error           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_token 
    ON community.notifications(recipient_token);
CREATE INDEX IF NOT EXISTS idx_notifications_status 
    ON community.notifications(status);
