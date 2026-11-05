import argparse

from app import create_app
from app.auth.service import create_staff_user, set_password_by_email
from app.common.validation import clean_text, normalize_email, normalize_phone, validate_password
from app.db.migrate import apply_migrations, apply_seed
from app.inventory.service import release_expired_reservations


def main():
    parser = argparse.ArgumentParser(description="Tiara Wishes backend commands")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("init-db", help="Create the database, schema, and reference data")
    sub.add_parser("seed", help="Insert missing reference and demo data")
    sub.add_parser("release-reservations", help="Cancel unpaid orders whose stock reservation expired")

    admin = sub.add_parser("create-admin", help="Create an administrator. This is not public registration.")
    admin.add_argument("--email", required=True)
    admin.add_argument("--password", required=True)
    admin.add_argument("--first-name", required=True)
    admin.add_argument("--last-name", required=True)
    admin.add_argument("--phone")

    password = sub.add_parser("set-password", help="Set a password for an existing account")
    password.add_argument("--email", required=True)
    password.add_argument("--password", required=True)

    args = parser.parse_args()
    app = create_app()
    with app.app_context():
        if args.command == "init-db":
            apply_migrations()
            print("Database schema and reference data are ready.")
        elif args.command == "seed":
            apply_seed()
            print("Reference data checked.")
        elif args.command == "release-reservations":
            released = release_expired_reservations()
            print(f"Released {released} expired reservation(s).")
        elif args.command == "create-admin":
            user = create_staff_user(
                clean_text(args.first_name, "first_name", 80),
                clean_text(args.last_name, "last_name", 80),
                normalize_email(args.email),
                normalize_phone(args.phone, required=False) if args.phone else None,
                validate_password(args.password),
                "admin",
            )
            print(f"Administrator created: id={user['id']} email={user['email']}")
        elif args.command == "set-password":
            set_password_by_email(args.email, args.password)
            print("Password updated.")


if __name__ == "__main__":
    main()
