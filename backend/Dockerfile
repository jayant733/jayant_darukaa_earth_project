FROM python:3.12-slim

WORKDIR /app
COPY pyproject.toml alembic.ini ./
COPY app ./app
COPY migrations ./migrations
RUN pip install --no-cache-dir .

ENV PORT=18765
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port "$PORT"

