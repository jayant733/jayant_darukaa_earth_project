"""Make lifecycle cascade behavior explicit."""

from collections.abc import Sequence

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("projects_created_by_fkey", "projects", type_="foreignkey")
    op.create_foreign_key(
        "projects_created_by_fkey",
        "projects",
        "users",
        ["created_by"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.drop_constraint("sites_project_id_fkey", "sites", type_="foreignkey")
    op.create_foreign_key(
        "sites_project_id_fkey",
        "sites",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_constraint(
        "metric_observations_site_id_fkey", "metric_observations", type_="foreignkey"
    )
    op.create_foreign_key(
        "metric_observations_site_id_fkey",
        "metric_observations",
        "sites",
        ["site_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(
        "metric_observations_site_id_fkey", "metric_observations", type_="foreignkey"
    )
    op.create_foreign_key(
        "metric_observations_site_id_fkey",
        "metric_observations",
        "sites",
        ["site_id"],
        ["id"],
    )
    op.drop_constraint("sites_project_id_fkey", "sites", type_="foreignkey")
    op.create_foreign_key("sites_project_id_fkey", "sites", "projects", ["project_id"], ["id"])
    op.drop_constraint("projects_created_by_fkey", "projects", type_="foreignkey")
    op.create_foreign_key("projects_created_by_fkey", "projects", "users", ["created_by"], ["id"])
