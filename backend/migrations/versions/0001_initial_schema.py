"""Initial geospatial project schema."""

from collections.abc import Sequence

import geoalchemy2
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    status = sa.Enum("active", "planning", "completed", name="projectstatus")
    status.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_table(
        "projects",
        sa.Column("id", postgresql.UUID(), primary_key=True),
        sa.Column("created_by", postgresql.UUID(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("country", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", status, nullable=False),
        sa.Column("carbon_target", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_projects_name", "projects", ["name"])
    op.create_table(
        "sites",
        sa.Column("id", postgresql.UUID(), primary_key=True),
        sa.Column("project_id", postgresql.UUID(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column(
            "geom",
            geoalchemy2.Geometry("POLYGON", srid=4326, spatial_index=False),
            nullable=False,
        ),
        sa.Column("area_ha", sa.Float(), nullable=False),
    )
    op.create_index("ix_sites_project_id", "sites", ["project_id"])
    op.create_index("idx_sites_geom", "sites", ["geom"], postgresql_using="gist")
    op.create_table(
        "metric_observations",
        sa.Column("id", postgresql.UUID(), primary_key=True),
        sa.Column("site_id", postgresql.UUID(), sa.ForeignKey("sites.id"), nullable=False),
        sa.Column("observed_on", sa.Date(), nullable=False),
        sa.Column("carbon_tco2e", sa.Float(), nullable=False),
        sa.Column("biodiversity_index", sa.Float(), nullable=False),
        sa.Column("restoration_progress", sa.Float(), nullable=False),
        sa.UniqueConstraint("site_id", "observed_on"),
    )
    op.create_index("ix_metric_observations_site_id", "metric_observations", ["site_id"])


def downgrade() -> None:
    op.drop_table("metric_observations")
    op.drop_table("sites")
    op.drop_table("projects")
    op.drop_table("users")
    sa.Enum(name="projectstatus").drop(op.get_bind(), checkfirst=True)
