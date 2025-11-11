from typing import Dict, Any
import pandas as pd
import torch
from .base import ensure_columns, TrainError

def train(df: pd.DataFrame, params: Dict[str, Any]) -> Dict[str, Any]:
    x_col = params.get("xCol")
    y_col = params.get("yCol")
    if not x_col or not y_col:
        raise TrainError("xCol and yCol are required.")
    ensure_columns(df, [x_col, y_col])
    x = pd.to_numeric(df[x_col], errors="coerce").dropna()
    y = pd.to_numeric(df[y_col], errors="coerce").dropna()
    n = min(len(x), len(y))
    x = torch.tensor(x.values[:n], dtype=torch.float32).view(-1, 1)
    y = torch.tensor(y.values[:n], dtype=torch.float32).view(-1, 1)
    if x.shape[0] < 2:
        raise TrainError("Not enough numeric rows for training.")
    ones = torch.ones_like(x)
    X = torch.cat([x, ones], dim=1)
    XtX = X.T @ X
    XtX = XtX + 1e-6 * torch.eye(XtX.shape[0])
    beta = torch.linalg.inv(XtX) @ X.T @ y
    slope = float(beta[0].item())
    intercept = float(beta[1].item())
    return {
        "type": "linear_regression",
        "model": {"slope": slope, "intercept": intercept, "xCol": x_col, "yCol": y_col}
    }


