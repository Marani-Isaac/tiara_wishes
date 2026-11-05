import uuid
from pathlib import Path

from flask import current_app

from app.common.errors import ValidationError
from app.common.paths import media_root


def store_upload(file_storage, purpose):
    folders = {"promotions": "promotions", "content": "content"}
    folder = folders.get(purpose)
    if not folder:
        raise ValidationError(details={"purpose": "Choose a promotion or content image"})
    if file_storage is None:
        raise ValidationError(details={"image": "Choose an image file"})
    blob = file_storage.read()
    limit = current_app.config["MAX_UPLOAD_MB"] * 1024 * 1024
    if not blob or len(blob) > limit:
        raise ValidationError(details={"image": "Image is empty or too large"})
    extension = _detect_image(blob)
    if not extension:
        raise ValidationError(details={"image": "Upload a JPEG, PNG, or WebP image"})
    filename = f"{uuid.uuid4().hex}{extension}"
    relative = f"{folder}/{filename}"
    root = media_root()
    target = (root / relative).resolve()
    if root not in target.parents:
        raise ValidationError(details={"image": "Could not store that image"})
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(blob)
    prefix = current_app.config["MEDIA_URL_PREFIX"].rstrip("/")
    return {"image_url": f"{prefix}/{relative}"}


def media_path(value, field="image_url"):
    from app.common.validation import clean_text

    if value in (None, ""):
        return None
    text = clean_text(value, field, 255)
    prefix = current_app.config["MEDIA_URL_PREFIX"].rstrip("/") + "/"
    if text.startswith("http://") or text.startswith("https://") or ".." in text or not text.startswith(prefix):
        raise ValidationError(details={field: "Choose an image file from this form"})
    path = Path(text[len(prefix):])
    if path.is_absolute() or ".." in path.parts:
        raise ValidationError(details={field: "Choose an image file from this form"})
    return text


def _detect_image(blob):
    if blob.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if blob.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if len(blob) >= 12 and blob[:4] == b"RIFF" and blob[8:12] == b"WEBP":
        return ".webp"
    return None
