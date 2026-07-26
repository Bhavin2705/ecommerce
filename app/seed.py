import sys
import os

def seed_admin():
    from app.config import get_settings
    from app.database import SessionLocal, engine, Base
    from app.models import User
    from app.auth import hash_password

    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"[SEED] Base.metadata.create_all warning: {e}")

    settings = get_settings()
    db = SessionLocal()

    try:
        admin = db.query(User).filter(User.role == "admin").first()
        if admin:
            print(f"[SEED] Admin already exists: {admin.email}")
            return

        admin_email = settings.ADMIN_EMAIL
        admin_password = settings.ADMIN_PASSWORD

        if not admin_email or not admin_password:
            print("[SEED] ADMIN_EMAIL and ADMIN_PASSWORD not set. Skipping.")
            return

        admin_user = User(
            email=admin_email,
            password_hash=hash_password(admin_password),
            role="admin"
        )
        db.add(admin_user)
        db.commit()
        print(f"[SEED] Admin user created: {admin_email}")
    except Exception as e:
        print(f"[SEED] Error creating admin: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_admin()
