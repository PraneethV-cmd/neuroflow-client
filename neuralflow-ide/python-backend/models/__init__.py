from typing import Dict, Any, Callable
import importlib
import pkgutil
import pathlib

def list_models() -> Dict[str, str]:
    models_dir = pathlib.Path(__file__).parent
    result = {}
    for m in pkgutil.iter_modules([str(models_dir)]):
        if not m.ispkg and not m.name.startswith("_"):
            result[m.name] = f"models.{m.name}"
    return result

def load_model(name: str):
    return importlib.import_module(f"models.{name}")


