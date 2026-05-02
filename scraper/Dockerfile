FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ngx_scraper.py .

ENV PORT=8080

CMD ["functions-framework", "--target=ngx_scraper", "--port=8080"]
