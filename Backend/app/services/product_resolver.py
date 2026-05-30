import logging
from dataclasses import dataclass
from difflib import SequenceMatcher

from sqlalchemy.orm import Session

from app.models import Product
from app.services.ai_extractor import normalize_text


REUSE_THRESHOLD = 0.84
CREATE_THRESHOLD = 0.95
logger = logging.getLogger(__name__)


@dataclass
class ProductResolution:
    product: Product | None
    action: str
    confidence: float
    normalized_name: str
    reason: str


def resolve_product(
    db: Session,
    company_id: int,
    raw_name: str | None,
    *,
    create_if_missing: bool = False,
    create_confidence: float = 0,
    defaults: dict | None = None,
) -> ProductResolution:
    normalized = _product_name(raw_name)
    if not normalized:
        logger.info(
            "product_resolution_empty",
            extra={"company_id": company_id, "raw_name": raw_name},
        )
        return ProductResolution(None, "needs_review", 0, "", "empty product name")

    products = db.query(Product).filter(Product.company_id == company_id, Product.is_active.is_(True)).all()
    match, confidence = _best_match(normalized, products)
    if match and confidence >= REUSE_THRESHOLD:
        logger.info(
            "product_resolution_reused",
            extra={
                "company_id": company_id,
                "product_id": match.id,
                "confidence": confidence,
                "normalized_name": normalized,
            },
        )
        return ProductResolution(match, "reused", confidence, normalized, "matched existing product")

    if create_if_missing and create_confidence >= CREATE_THRESHOLD:
        product = Product(company_id=company_id, name=_display_name(normalized), **(defaults or {}))
        db.add(product)
        db.commit()
        db.refresh(product)
        logger.info(
            "product_resolution_created",
            extra={
                "company_id": company_id,
                "product_id": product.id,
                "confidence": create_confidence,
                "normalized_name": normalized,
            },
        )
        return ProductResolution(product, "created", create_confidence, normalized, "created high confidence product")

    logger.info(
        "product_resolution_needs_review",
        extra={
            "company_id": company_id,
            "confidence": confidence,
            "normalized_name": normalized,
            "create_if_missing": create_if_missing,
        },
    )
    return ProductResolution(None, "needs_review", confidence, normalized, "ambiguous or low confidence product")


def _best_match(normalized: str, products: list[Product]) -> tuple[Product | None, float]:
    best_product = None
    best_score = 0.0
    for product in products:
        score = _similarity(normalized, _product_name(product.name))
        if score > best_score:
            best_product = product
            best_score = score
    return best_product, best_score


def _similarity(left: str, right: str) -> float:
    if not left or not right:
        return 0
    if left == right:
        return 1

    left_tokens = set(left.split())
    right_tokens = set(right.split())
    token_overlap = len(left_tokens & right_tokens) / max(len(left_tokens), len(right_tokens))
    subset_bonus = 0.9 if left_tokens <= right_tokens or right_tokens <= left_tokens else 0
    sequence_score = SequenceMatcher(None, left, right).ratio()
    return max(sequence_score, token_overlap, subset_bonus)


def _product_name(value: str | None) -> str:
    normalized = normalize_text(value or "")
    return " ".join(word for word in normalized.split() if word not in {"producto", "material", "insumo"})


def _display_name(normalized: str) -> str:
    return " ".join(word.capitalize() for word in normalized.split())
