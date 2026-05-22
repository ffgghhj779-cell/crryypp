"""
python/main.py

EWA Python Microservice — FastAPI HTTP Server
=============================================

Entry point for the Python EWA analysis service.
Next.js calls POST /analyze with dual-TF OHLCV data.
This service runs the full 5-phase Elliott Wave pipeline
and returns the typed EWAResult JSON.

SECURITY:
  - X-Service-Key header authentication (internal service-to-service)
  - Input validation via Pydantic models (no arbitrary code execution)
  - Request size limit (Pydantic + FastAPI middleware)
  - Structured JSON errors (no stack traces leaked in production)

DEPLOYMENT:
  Development:  uvicorn main:app --host 0.0.0.0 --port 8001 --reload
  Production:   gunicorn main:app -w 2 -k uvicorn.workers.UvicornWorker
                (2 workers sufficient — analysis is CPU-bound per request)

ENVIRONMENT VARIABLES:
  EWA_SERVICE_KEY : Shared secret between Next.js and this service
                    (must match X-Service-Key header from route.ts)
  EWA_LOG_LEVEL   : Logging level (DEBUG | INFO | WARNING) default: INFO
  EWA_ATR_MULT    : ATR multiplier for pivot detection (default: 2.5)
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator

from ewa.orchestrator import EWAOrchestrator

# ─── Logging Setup ────────────────────────────────────────────────────────────

LOG_LEVEL = os.getenv("EWA_LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("ewa.server")

# ─── Configuration ────────────────────────────────────────────────────────────

SERVICE_KEY  = os.getenv("EWA_SERVICE_KEY", "dev-internal-key")
ATR_MULT     = float(os.getenv("EWA_ATR_MULT", "2.5"))
MAX_BARS     = 1000   # Hard cap on bars per timeframe to prevent memory exhaustion

# ─── FastAPI App ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="EWA Python Microservice",
    description="Elliott Wave Quantitative Analysis Engine for Crypto Terminal 360",
    version="1.0.0",
    # Disable OpenAPI docs in production for security
    docs_url="/docs" if os.getenv("NODE_ENV") != "production" else None,
    redoc_url=None,
)

# CORS — only allow requests from Next.js server (internal service)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["POST"],
    allow_headers=["Content-Type", "X-Service-Key"],
)

# Single shared orchestrator instance (stateless — safe to share)
orchestrator = EWAOrchestrator()

# ─── Pydantic Models ──────────────────────────────────────────────────────────

class OHLCVBarIn(BaseModel):
    """Single OHLCV bar from Next.js. Maps to OHLCVBar.from_dict()."""
    t:   int    = Field(..., description="Unix timestamp seconds")
    o:   float  = Field(..., gt=0, description="Open price")
    h:   float  = Field(..., gt=0, description="High price")
    l:   float  = Field(..., gt=0, description="Low price")
    c:   float  = Field(..., gt=0, description="Close price")
    v:   float  = Field(default=0.0, ge=0, description="Volume")
    tc:  int    = Field(default=0, description="Close timestamp seconds")
    is_closed: bool = Field(default=True)

    @validator("h")
    def high_gte_low(cls, h, values):
        if "l" in values and h < values["l"]:
            raise ValueError(f"High ({h}) must be >= Low ({values['l']})")
        return h

    def to_dict(self) -> dict:
        return {
            "t": self.t, "o": self.o, "h": self.h,
            "l": self.l, "c": self.c, "v": self.v,
            "tc": self.tc, "is_closed": self.is_closed,
        }


class AnalyzeRequest(BaseModel):
    """Request payload from Next.js /api/ewa route handler."""
    symbol:           str   = Field(..., min_length=2, max_length=20)
    macro_tf:         str   = Field(..., pattern=r"^(15m|1h|4h|1d|3d|1w)$")
    micro_tf:         str   = Field(..., pattern=r"^(15m|1h|4h|1d|3d|1w)$")
    macro_bars:       list[OHLCVBarIn] = Field(..., min_items=10, max_items=MAX_BARS)
    micro_bars:       list[OHLCVBarIn] = Field(..., min_items=10, max_items=MAX_BARS)
    telegram_user_id: int   = Field(..., gt=0)

    class Config:
        # Reject extra fields — prevents payload injection
        extra = "forbid"


class HealthResponse(BaseModel):
    status:  str
    version: str
    uptime:  float


# ─── Auth Dependency ──────────────────────────────────────────────────────────

async def verify_service_key(request: Request) -> None:
    """
    Verify the X-Service-Key header matches our shared secret.
    This is internal service-to-service authentication — NOT end-user auth.
    End-user auth (Telegram initData) is verified in Next.js before this is called.
    """
    key = request.headers.get("X-Service-Key", "")
    if key != SERVICE_KEY:
        log.warning(
            f"[Auth] Invalid service key from {request.client.host if request.client else 'unknown'}. "
            f"Expected '{SERVICE_KEY[:4]}...'"
        )
        raise HTTPException(
            status_code=401,
            detail={"error": "Invalid service key.", "code": "UNAUTHORIZED"},
        )


# ─── Routes ───────────────────────────────────────────────────────────────────

_start_time = time.time()


@app.get("/health", response_model=HealthResponse, tags=["monitoring"])
async def health() -> dict:
    """Health check endpoint — used by Docker/Kubernetes liveness probe."""
    return {
        "status":  "ok",
        "version": "1.0.0",
        "uptime":  round(time.time() - _start_time, 1),
    }


@app.post("/analyze", tags=["analysis"], dependencies=[Depends(verify_service_key)])
async def analyze(request_body: AnalyzeRequest) -> JSONResponse:
    """
    Full Elliott Wave analysis endpoint.

    Receives OHLCV bars for two timeframes, runs the 5-phase EWA pipeline,
    and returns the typed EWAResult JSON matching the TypeScript interface.

    Called exclusively by Next.js app/api/ewa/route.ts — not a public endpoint.
    """
    request_start = time.time()

    log.info(
        f"[/analyze] {request_body.symbol} {request_body.macro_tf}→{request_body.micro_tf} "
        f"user={request_body.telegram_user_id} "
        f"macro_bars={len(request_body.macro_bars)} micro_bars={len(request_body.micro_bars)}"
    )

    try:
        result = orchestrator.analyze(
            symbol=request_body.symbol,
            macro_tf=request_body.macro_tf,
            micro_tf=request_body.micro_tf,
            macro_bars=[b.to_dict() for b in request_body.macro_bars],
            micro_bars=[b.to_dict() for b in request_body.micro_bars],
            atr_multiplier=ATR_MULT,
        )
    except Exception as e:
        log.exception(f"[/analyze] Unhandled error for {request_body.symbol}: {e}")
        # Never expose internal stack traces — return structured error
        return JSONResponse(
            status_code=500,
            content={
                "error":  "Internal analysis error. The wave engine encountered an unexpected state.",
                "code":   "ANALYSIS_ERROR",
                "symbol": request_body.symbol,
                # In dev mode, include the message; in production, suppress it
                **({"detail": str(e)} if os.getenv("NODE_ENV") != "production" else {}),
            },
        )

    elapsed = round((time.time() - request_start) * 1000)
    log.info(
        f"[/analyze] Complete: {request_body.symbol} "
        f"confidence={result.get('scoring_matrix', {}).get('confidence_pct', 0)}% "
        f"elapsed={elapsed}ms"
    )

    # Attach server-side timing for debugging
    if "_pivot_debug" in result:
        result["_pivot_debug"]["server_elapsed_ms"] = elapsed

    return JSONResponse(content=result)


# ─── Global Exception Handler ─────────────────────────────────────────────────

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.detail if isinstance(exc.detail, dict)
                else {"error": exc.detail, "code": "HTTP_ERROR"},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    log.exception(f"[GlobalHandler] Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error.",
            "code":  "INTERNAL_ERROR",
        },
    )


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("EWA_PORT", "8001")),
        reload=os.getenv("NODE_ENV") != "production",
        log_level=LOG_LEVEL.lower(),
    )
