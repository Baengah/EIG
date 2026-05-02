#!/bin/bash
# GCP Project Setup Script for EIG Platform
# Run once to configure project, enable APIs, create service accounts, etc.

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="${GCP_REGION:-us-central1}"
APP_NAME="eig-platform"

echo "=== Setting up GCP project: $PROJECT_ID ==="

# Set project
gcloud config set project "$PROJECT_ID"

# Enable required APIs
echo "Enabling GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com \
  cloudfunctions.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudresourcemanager.googleapis.com

# Create Artifact Registry repository
echo "Creating Artifact Registry repository..."
gcloud artifacts repositories create eig-platform \
  --repository-format=docker \
  --location="$REGION" \
  --description="EIG Platform Docker images" \
  2>/dev/null || echo "Repository already exists"

# Create secrets in Secret Manager
echo "Creating secrets..."
for SECRET_NAME in supabase-url supabase-anon-key supabase-service-key scraper-api-key; do
  echo "placeholder" | gcloud secrets create "$SECRET_NAME" \
    --data-file=- \
    2>/dev/null || echo "Secret $SECRET_NAME already exists"
done

echo "
=== Secrets created. Update them with actual values: ===
gcloud secrets versions add supabase-url --data-file=<(echo -n 'YOUR_SUPABASE_URL')
gcloud secrets versions add supabase-anon-key --data-file=<(echo -n 'YOUR_ANON_KEY')
gcloud secrets versions add supabase-service-key --data-file=<(echo -n 'YOUR_SERVICE_KEY')
gcloud secrets versions add scraper-api-key --data-file=<(echo -n 'YOUR_SCRAPER_KEY')
"

# Create Cloud Build service account
SA_EMAIL="cloudbuild-sa@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud iam service-accounts create cloudbuild-sa \
  --display-name="Cloud Build Service Account" \
  2>/dev/null || echo "Service account already exists"

# Grant permissions
for ROLE in roles/run.admin roles/artifactregistry.writer roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$ROLE" \
    --quiet
done

echo "=== GCP setup complete for $PROJECT_ID ==="
echo "Next steps:"
echo "1. Update secrets with actual values"
echo "2. Connect GitHub repo in Cloud Build console"
echo "3. Deploy scraper: cd scraper && ./deploy.sh"
echo "4. Configure Cloudflare DNS to point equityinvestmentgroup.club to Cloud Run URL"
