from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base
from app.models import Product
from app.services.product_resolver import resolve_product


def _db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def test_resolver_reuses_normalized_product_name():
    db = _db()
    product = Product(id=1, company_id=1, name="Queso Dambo")
    db.add(product)
    db.commit()

    result = resolve_product(db, 1, "qso dambo")

    assert result.action == "reused"
    assert result.product.id == product.id
    assert result.confidence == 1


def test_resolver_reuses_similar_typo():
    db = _db()
    product = Product(id=1, company_id=1, name="Queso Dambo")
    db.add(product)
    db.commit()

    result = resolve_product(db, 1, "queso danbo")

    assert result.action == "reused"
    assert result.product.id == product.id


def test_resolver_never_crosses_companies():
    db = _db()
    db.add(Product(id=1, company_id=2, name="Queso Dambo"))
    db.commit()

    result = resolve_product(db, 1, "qso dambo")

    assert result.action == "needs_review"
    assert result.product is None


def test_resolver_creates_only_with_high_confidence():
    db = _db()

    low = resolve_product(db, 1, "leche fresca", create_if_missing=True, create_confidence=0.8)
    high = resolve_product(db, 1, "leche fresca", create_if_missing=True, create_confidence=0.98)

    assert low.action == "needs_review"
    assert high.action == "created"
    assert high.product.name == "Leche Fresca"
    assert db.query(Product).count() == 1
