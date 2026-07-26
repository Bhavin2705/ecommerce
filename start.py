import os
import sys

print("=== STARTING SHOPVAULT API SERVICE ===")
port = int(os.environ.get("PORT", "10000"))
print(f"[INFO] Target Port: {port}")
print(f"[INFO] Database URL configured: {bool(os.environ.get('DATABASE_URL'))}")

try:
    print("[INIT] Running seed script...")
    from app.seed import seed_admin
    seed_admin()
    print("[INIT] Seed step completed.")
except Exception as e:
    print(f"[INIT] Seed error (non-fatal): {e}")

import uvicorn
print(f"[SERVER] Launching Uvicorn server on 0.0.0.0:{port}...")
uvicorn.run("app.main:app", host="0.0.0.0", port=port, log_level="info")
