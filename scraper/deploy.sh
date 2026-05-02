#!/bin/bash
# Deploy NGX scraper to GCP Cloud Functions (Gen 2)
# Run from the scraper/ directory after setting up gcloud CLI.

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?GCP_PROJECT_ID not set}"
REGION="${GCP_REGION:-us-central1}"
FUNCTION_NAME="ngx-scraper"

echo "Deploying $FUNCTION_NAME to GCP project $PROJECT_ID (region: $REGION)..."

gcloud functions deploy "$FUNCTION_NAME" \
  --gen2 \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --runtime=python312 \
  --source=. \
  --entry-point=ngx_scraper \
  --trigger-http \
  --no-allow-unauthenticated \
  --memory=512Mi \
  --timeout=120s \
  --set-env-vars "SUPABASE_URL=${SUPABASE_URL},SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY},SCRAPER_API_KEY=${SCRAPER_API_KEY}"

echo "Function deployed. Setting up Cloud Scheduler..."

# Get function URL
FUNCTION_URL=$(gcloud functions describe "$FUNCTION_NAME" \
  --gen2 \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --format="value(serviceConfig.uri)")

echo "Function URL: $FUNCTION_URL"

# Create/update scheduler job at 6:00 PM WAT (17:00 UTC)
gcloud scheduler jobs create http ngx-scraper-daily \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --schedule="0 17 * * 1-5" \
  --uri="$FUNCTION_URL" \
  --http-method=POST \
  --headers="Authorization=Bearer ${SCRAPER_API_KEY},Content-Type=application/json" \
  --message-body='{"trigger":"scheduled"}' \
  --time-zone="UTC" \
  --attempt-deadline="120s" \
  --description="NGX price scraper — runs Mon-Fri at 18:00 WAT (17:00 UTC)" \
  2>/dev/null || \
gcloud scheduler jobs update http ngx-scraper-daily \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --schedule="0 17 * * 1-5" \
  --uri="$FUNCTION_URL" \
  --headers="Authorization=Bearer ${SCRAPER_API_KEY},Content-Type=application/json" \
  --message-body='{"trigger":"scheduled"}'

echo "Done! Scheduler job configured for Mon-Fri at 18:00 WAT."
