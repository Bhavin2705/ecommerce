from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.routers import auth, products, orders

# Create tables as fallback (Alembic is primary)
try:
    Base.metadata.create_all(bind=engine)
except Exception:
    pass

app = FastAPI(
    title="ShopVault API",
    description="Secure E-Commerce Product & Order Management API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# CORS middleware - allow Vercel frontend and localhost for development
origins = [
    "https://ecommerce-smoky-psi-73.vercel.app",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1:5500",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app|http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(products.router, prefix="/api/v1")
app.include_router(orders.router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "message": "Welcome to ShopVault Backend API!",
        "status": "online",
        "docs_url": "/api/docs",
        "frontend_url": "https://ecommerce-smoky-psi-73.vercel.app"
    }


@app.get("/api/v1/health")
async def health_check():
    return {"status": "healthy", "service": "ShopVault API"}
