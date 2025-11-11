from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np
import torch
import uuid
import io
from models import list_models, load_model
from models.base import TrainError

app = FastAPI()

# Allow local dev origins (Electron/Vite)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_BYTES = 2 * 1024 * 1024 * 1024  # 2GB

FILES: Dict[str, Dict[str, Any]] = {}

def _read_tabular(file_bytes: bytes, filename: str) -> pd.DataFrame:
    lower = filename.lower()
    bio = io.BytesIO(file_bytes)
    if lower.endswith(".csv") or lower.endswith(".tsv"):
        sep = "\t" if lower.endswith(".tsv") else ","
        return pd.read_csv(bio, sep=sep)
    if lower.endswith(".xls") or lower.endswith(".xlsx"):
        return pd.read_excel(bio)
    raise ValueError("Unsupported file type. Please upload a CSV or Excel file.")

@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    # Best-effort size guard using content_length header or stream read
    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large (>2GB). Not possible.")
    try:
        df = _read_tabular(content, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    file_id = str(uuid.uuid4())
    FILES[file_id] = {"df": df, "name": file.filename}
    headers = list(map(str, df.columns.tolist()))
    sample_rows = df.head(5).values.tolist()
    return {"fileId": file_id, "headers": headers, "sample": sample_rows}

@app.get("/sample/{file_id}")
def sample(file_id: str):
    entry = FILES.get(file_id)
    if not entry:
        raise HTTPException(status_code=404, detail="File not found")
    df: pd.DataFrame = entry["df"]
    headers = list(map(str, df.columns.tolist()))
    sample_rows = df.head(5).values.tolist()
    return {"headers": headers, "sample": sample_rows}

@app.get("/full/{file_id}")
def full(file_id: str):
    entry = FILES.get(file_id)
    if not entry:
        raise HTTPException(status_code=404, detail="File not found")
    df: pd.DataFrame = entry["df"]
    headers = list(map(str, df.columns.tolist()))
    rows = df.values.tolist()
    return {"headers": headers, "rows": rows}

@app.get("/models")
def models_list():
    return {"models": list_models()}

@app.post("/train")
def train_generic(payload: Dict[str, Any] = Body(...)):
    """
    JSON body:
    {
      "model": "linear_regression" | "knn" | ...,
      "fileId": "uuid",
      "params": { ... model-specific params ... }
    }
    """
    model_name = payload.get("model")
    file_id = payload.get("fileId")
    params = payload.get("params") or {}
    if not model_name or not file_id:
        raise HTTPException(status_code=400, detail="model and fileId are required.")
    entry = FILES.get(file_id)
    if not entry:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        module = load_model(model_name)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found.")
    try:
        result = module.train(entry["df"], params)
    except TrainError as te:
        raise HTTPException(status_code=400, detail=str(te))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {e}")
    return result

@app.post("/encode")
def encode(fileId: str = Form(...), columns: str = Form(...), encodingType: str = Form("label")):
    entry = FILES.get(fileId)
    if not entry:
        raise HTTPException(status_code=404, detail="File not found")
    df = entry["df"].copy()
    cols = [c for c in columns.split(",") if c]
    encoding_info = {}
    for col in cols:
        if encodingType == "label":
            df[col] = df[col].astype("category")
            df[col] = df[col].cat.codes
            encoding_info[col] = {"type": "label"}
        elif encodingType == "frequency":
            freq = df[col].value_counts()
            df[col] = df[col].map(freq).fillna(0).astype(int)
            encoding_info[col] = {"type": "frequency"}
        else:
            raise HTTPException(status_code=400, detail="Unknown encoding type.")
    headers = list(map(str, df.columns.tolist()))
    rows = df.values.tolist()
    return {"headers": headers, "rows": rows, "encodingInfo": encoding_info}

@app.post("/normalize")
def normalize(fileId: str = Form(...), columns: str = Form(...), normalizationType: str = Form("minmax")):
    entry = FILES.get(fileId)
    if not entry:
        raise HTTPException(status_code=404, detail="File not found")
    df = entry["df"].copy()
    cols = [c for c in columns.split(",") if c]
    info = {}
    for col in cols:
        if normalizationType == "minmax":
            col_min = float(np.nanmin(df[col]))
            col_max = float(np.nanmax(df[col]))
            denom = (col_max - col_min) if (col_max - col_min) != 0 else 1.0
            df[col] = (df[col] - col_min) / denom
            info[col] = {"type": "minmax", "min": col_min, "max": col_max}
        elif normalizationType == "zscore":
            mean = float(np.nanmean(df[col]))
            std = float(np.nanstd(df[col]))
            std = std if std != 0 else 1.0
            df[col] = (df[col] - mean) / std
            info[col] = {"type": "zscore", "mean": mean, "stdDev": std}
        else:
            raise HTTPException(status_code=400, detail="Unknown normalization type.")
    headers = list(map(str, df.columns.tolist()))
    rows = df.values.tolist()
    return {"headers": headers, "rows": rows, "normalizationInfo": info}

@app.post("/train/linear")
def train_linear(fileId: str = Form(...), xCol: str = Form(...), yCol: str = Form(...)):
    entry = FILES.get(fileId)
    if not entry:
        raise HTTPException(status_code=404, detail="File not found")
    df = entry["df"]
    if xCol not in df.columns or yCol not in df.columns:
        raise HTTPException(status_code=400, detail="Selected columns not found.")
    x = pd.to_numeric(df[xCol], errors="coerce").dropna()
    y = pd.to_numeric(df[yCol], errors="coerce").dropna()
    n = min(len(x), len(y))
    x = torch.tensor(x.values[:n], dtype=torch.float32).view(-1, 1)
    y = torch.tensor(y.values[:n], dtype=torch.float32).view(-1, 1)
    if x.shape[0] < 2:
        raise HTTPException(status_code=400, detail="Not enough numeric rows for training.")
    # Closed-form using torch (least squares)
    ones = torch.ones_like(x)
    X = torch.cat([x, ones], dim=1)  # [x, 1]
    # beta = (X^T X)^{-1} X^T y
    XtX = X.T @ X
    # add tiny ridge to diagonal
    XtX = XtX + 1e-6 * torch.eye(XtX.shape[0])
    beta = torch.linalg.inv(XtX) @ X.T @ y
    slope = float(beta[0].item())
    intercept = float(beta[1].item())
    return {"slope": slope, "intercept": intercept, "xCol": xCol, "yCol": yCol}

@app.post("/train/multilinear")
def train_multilinear(fileId: str = Form(...), xCols: str = Form(...), yCol: str = Form(...)):
    entry = FILES.get(fileId)
    if not entry:
        raise HTTPException(status_code=404, detail="File not found")
    df = entry["df"]
    cols = [c for c in xCols.split(",") if c]
    for c in cols + [yCol]:
        if c not in df.columns:
            raise HTTPException(status_code=400, detail=f"Column {c} not found.")
    X_df = df[cols].apply(pd.to_numeric, errors="coerce").dropna()
    y_series = pd.to_numeric(df[yCol], errors="coerce").dropna()
    n = min(len(X_df), len(y_series))
    if n < len(cols) + 1:
        raise HTTPException(status_code=400, detail="Not enough valid rows to fit the model.")
    X = torch.tensor(X_df.values[:n], dtype=torch.float32)
    y = torch.tensor(y_series.values[:n], dtype=torch.float32).view(-1, 1)
    ones = torch.ones((X.shape[0], 1), dtype=torch.float32)
    Xb = torch.cat([ones, X], dim=1)
    XtX = Xb.T @ Xb
    XtX = XtX + 1e-6 * torch.eye(XtX.shape[0])
    beta = torch.linalg.inv(XtX) @ Xb.T @ y
    intercept = float(beta[0].item())
    coefs = [float(c.item()) for c in beta[1:].view(-1)]
    return {"intercept": intercept, "coefficients": coefs, "xCols": cols, "yCol": yCol}

