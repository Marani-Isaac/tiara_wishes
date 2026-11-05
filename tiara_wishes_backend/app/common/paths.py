from pathlib import Path

from flask import current_app


def media_root():
    configured = Path(current_app.config["MEDIA_ROOT"])
    if not configured.is_absolute():
        configured = Path(current_app.root_path).parent / configured
    return configured.resolve()
