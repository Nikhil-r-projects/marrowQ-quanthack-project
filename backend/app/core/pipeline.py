import numpy as np
import pandas as pd
from typing import Tuple, List, Dict, Any, Optional
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.decomposition import PCA

class LeakageSafePreprocessor:
    """
    Guarantees strict leakage prevention:
    - Preprocessing is fitted exclusively on X_train.
    - Transform is applied to X_train and X_test without fitting on test data.
    - Missing values are imputed with train statistics.
    - Categorical encoders handle unseen categories safely.
    """
    def __init__(self, numeric_features: List[str], categorical_features: List[str]):
        self.numeric_features = numeric_features
        self.categorical_features = categorical_features
        self.preprocessor: Optional[ColumnTransformer] = None
        self.feature_names_out: List[str] = []
        self._is_fitted = False
        
        num_pipeline = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler())
        ])
        
        cat_pipeline = Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False))
        ])
        
        transformers = []
        if self.numeric_features:
            transformers.append(("num", num_pipeline, self.numeric_features))
        if self.categorical_features:
            transformers.append(("cat", cat_pipeline, self.categorical_features))
            
        self.preprocessor = ColumnTransformer(
            transformers=transformers,
            remainder="drop"
        )

    def fit(self, X_train: pd.DataFrame) -> "LeakageSafePreprocessor":
        self.preprocessor.fit(X_train)
        self._is_fitted = True
        
        # Determine feature names out
        names = []
        if self.numeric_features:
            names.extend(self.numeric_features)
        if self.categorical_features:
            try:
                cat_encoder = self.preprocessor.named_transformers_["cat"].named_steps["encoder"]
                cat_names = cat_encoder.get_feature_names_out(self.categorical_features)
                names.extend(list(cat_names))
            except Exception:
                pass
        self.feature_names_out = names
        return self

    def transform(self, X: pd.DataFrame) -> np.ndarray:
        if not self._is_fitted:
            raise RuntimeError("Preprocessor must be fitted on training data before transforming.")
        return self.preprocessor.transform(X)

    def fit_transform(self, X_train: pd.DataFrame) -> np.ndarray:
        self.fit(X_train)
        return self.transform(X_train)

def prepare_train_test_split(
    df: pd.DataFrame,
    target_column: str,
    feature_columns: List[str],
    test_size: float = 0.25,
    random_state: int = 42
) -> Tuple[pd.DataFrame, pd.DataFrame, np.ndarray, np.ndarray, LeakageSafePreprocessor, List[str], List[str]]:
    """
    Validates data and splits strictly before any preprocessing.
    """
    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in dataset.")
        
    # Drop rows where target is missing
    df_valid = df.dropna(subset=[target_column]).copy()
    if len(df_valid) == 0:
        raise ValueError("Dataset has zero valid rows after dropping missing target labels.")
        
    y_raw = df_valid[target_column].values
    unique_classes = np.unique(y_raw)
    if len(unique_classes) < 2:
        raise ValueError(f"Target column '{target_column}' must have at least 2 distinct classes. Found only: {unique_classes}")
        
    # Convert binary target to 0 and 1
    # If target is boolean or text or 0/1
    positive_val = unique_classes[-1]
    y = np.where(y_raw == positive_val, 1, 0)
    
    # Check minimum class counts
    class_0_count = np.sum(y == 0)
    class_1_count = np.sum(y == 1)
    if class_0_count < 2 or class_1_count < 2:
        raise ValueError(f"Imbalanced classes too small to split: Class 0 has {class_0_count}, Class 1 has {class_1_count}.")

    # Filter features that exist
    features_present = [f for f in feature_columns if f in df_valid.columns]
    if not features_present:
        raise ValueError("No valid feature columns selected.")
        
    X = df_valid[features_present]
    
    # Determine numeric vs categorical
    numeric_features = [col for col in features_present if pd.api.types.is_numeric_dtype(X[col])]
    categorical_features = [col for col in features_present if col not in numeric_features]
    
    # Stratified train/test split
    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y,
            test_size=test_size,
            random_state=random_state,
            stratify=y
        )
    except Exception:
        # Fallback to unstratified if counts are very tight
        X_train, X_test, y_train, y_test = train_test_split(
            X, y,
            test_size=test_size,
            random_state=random_state
        )
        
    preprocessor = LeakageSafePreprocessor(numeric_features, categorical_features)
    # FIT PREPROCESSOR EXCLUSIVELY ON X_train
    preprocessor.fit(X_train)
    
    return X_train, X_test, y_train, y_test, preprocessor, numeric_features, categorical_features
