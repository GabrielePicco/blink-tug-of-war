FROM python:3.10-slim AS builder

ENV PYTHONUNBUFFERED=1
ENV POETRY_VERSION=1.4.0

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential gcc \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install poetry==$POETRY_VERSION

# Install Poetry
RUN pip install uvicorn fastapi mangum pillow solana

COPY pyproject.toml poetry.lock /app/

RUN poetry config virtualenvs.create false \
    && poetry install --no-dev --no-interaction --no-ansi

FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY --from=builder /usr/local/lib/python3.10/site-packages /usr/local/lib/python3.10/site-packages
COPY --from=builder /usr/local/bin/uvicorn /usr/local/bin/
COPY --from=builder /usr/local/bin/poetry /usr/local/bin/

COPY . /app

EXPOSE 8080

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8080"]