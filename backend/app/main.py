import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.routes import router
from app.api.compute_routes import router as compute_router
from app.api.cohort_routes import router as cohort_router
from app.core.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(
    title="MarrowQ — Quantum-Assisted HSCT Recovery Prediction API",
    description="Research-grounded clinical machine learning platform comparing Quantum-Kernel SVMs against classical baselines for HSCT engraftment prediction.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router
app.include_router(router)
app.include_router(compute_router)
app.include_router(cohort_router)

# Serve frontend build if dist folder exists
repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
frontend_dist = os.path.join(repo_root, "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
