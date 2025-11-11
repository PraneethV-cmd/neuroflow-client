from typing import Dict, Any
import pandas as pd

class TrainError(Exception):
    pass

def ensure_columns(df: pd.DataFrame, columns: list):
    for c in columns:
        if c not in df.columns:
            raise TrainError(f"Column {c} not found.")


