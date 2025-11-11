from typing import Dict, Any, List
import pandas as pd
import numpy as np
from .base import ensure_columns, TrainError

def train(df: pd.DataFrame, params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Simple KNN regressor for numeric targets:
    params:
      - xCols: list[str]
      - yCol: str
      - k: int (default 5)
    Returns a 'model' payload with training summaries (prototype only).
    """
    x_cols: List[str] = params.get("xCols") or []
    y_col: str = params.get("yCol")
    k: int = int(params.get("k", 5))
    if not x_cols or not y_col:
        raise TrainError("xCols and yCol are required.")
    ensure_columns(df, x_cols + [y_col])
    X = df[x_cols].apply(pd.to_numeric, errors="coerce").values
    y = pd.to_numeric(df[y_col], errors="coerce").values
    mask = np.isfinite(X).all(axis=1) & np.isfinite(y)
    X = X[mask]
    y = y[mask]
    if X.shape[0] < k:
        raise TrainError("Not enough rows after cleaning to apply KNN.")
    # Prototype: store training set statistics to serve predictions later.
    # Here we just summarize; real inference handler can be added later.
    means = X.mean(axis=0).tolist()
    stds = X.std(axis=0).tolist()
    return {
        "type": "knn_regressor",
        "model": {
            "xCols": x_cols,
            "yCol": y_col,
            "k": k,
            "featureMeans": means,
            "featureStds": stds,
            "numRows": int(X.shape[0])
        }
    }


