import smtplib
from email.message import EmailMessage

from flask import current_app

from app.common.serializers import iso
from app.db.connection import db_session


def add_notification(
    db,
    user_id,
    channel,
    type_,
    subject,
    message,
    related_type=None,
    related_id=None,
    status="queued",
):
    notification_id, _ = db.execute(
        """
        INSERT INTO notifications (
          user_id, channel, type, subject, message, status,
          related_type, related_id, sent_at
        ) VALUES (
          %s, %s, %s, %s, %s, %s, %s, %s,
          CASE WHEN %s = 'sent' THEN UTC_TIMESTAMP() ELSE NULL END
        )
        """,
        (
            user_id,
            channel,
            type_,
            subject,
            message,
            status,
            related_type,
            related_id,
            status,
        ),
    )
    return notification_id


def notify_user(db, user_id, type_, subject, message, related_type=None, related_id=None):
    """Record an in-app notification. Email stays queued until SMTP is configured."""
    add_notification(
        db,
        user_id,
        "in_app",
        type_,
        subject,
        message,
        related_type,
        related_id,
        status="sent",
    )
    if current_app.config.get("SMTP_HOST"):
        add_notification(
            db,
            user_id,
            "email",
            type_,
            subject,
            message,
            related_type,
            related_id,
            status="queued",
        )


def dispatch_queued_email(notification_id, recipient):
    """Send one queued email after the business transaction has committed."""
    if not current_app.config.get("SMTP_HOST") or not recipient:
        return
    try:
        with db_session() as db:
            row = db.one(
                "SELECT * FROM notifications WHERE id = %s AND channel = 'email' AND status = 'queued'",
                (notification_id,),
            )
            if not row:
                return
            _send(recipient, row["subject"] or "Tiara Wishes", row["message"])
            db.execute(
                """
                UPDATE notifications
                SET status = 'sent', sent_at = UTC_TIMESTAMP()
                WHERE id = %s
                """,
                (notification_id,),
            )
    except Exception:
        current_app.logger.exception("Email notification %s failed", notification_id)
        try:
            with db_session() as db:
                db.execute(
                    "UPDATE notifications SET status = 'failed' WHERE id = %s AND status = 'queued'",
                    (notification_id,),
                )
        except Exception:
            current_app.logger.error("Could not mark notification %s as failed", notification_id)


def list_for_user(user_id, page, per_page, offset):
    with db_session() as db:
        total = db.one(
            """
            SELECT COUNT(*) AS total FROM notifications
            WHERE user_id = %s AND channel = 'in_app'
            """,
            (user_id,),
        )["total"]
        rows = db.all(
            """
            SELECT * FROM notifications
            WHERE user_id = %s AND channel = 'in_app'
            ORDER BY id DESC
            LIMIT %s OFFSET %s
            """,
            (user_id, per_page, offset),
        )
    return [_present(row) for row in rows], total


def mark_read(user_id, notification_id):
    from app.common.errors import NotFound

    with db_session() as db:
        _, count = db.execute(
            """
            UPDATE notifications
            SET status = 'read'
            WHERE id = %s AND user_id = %s AND channel = 'in_app'
            """,
            (notification_id, user_id),
        )
        if count != 1:
            raise NotFound("Notification not found")
        row = db.one("SELECT * FROM notifications WHERE id = %s", (notification_id,))
    return _present(row)


def _present(row):
    return {
        "id": row["id"],
        "channel": row["channel"],
        "type": row["type"],
        "subject": row["subject"],
        "message": row["message"],
        "status": row["status"],
        "related_type": row["related_type"],
        "related_id": row["related_id"],
        "sent_at": iso(row["sent_at"]),
        "created_at": iso(row["created_at"]),
    }


def _send(recipient, subject, message):
    config = current_app.config
    email = EmailMessage()
    email["From"] = config["SMTP_FROM"] or config["SMTP_USER"]
    email["To"] = recipient
    email["Subject"] = subject
    email.set_content(message)
    with smtplib.SMTP(config["SMTP_HOST"], config["SMTP_PORT"], timeout=10) as server:
        if config["SMTP_USE_TLS"]:
            server.starttls()
        if config["SMTP_USER"]:
            server.login(config["SMTP_USER"], config["SMTP_PASSWORD"])
        server.send_message(email)
