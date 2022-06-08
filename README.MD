New version of crawler <br>
Work Flow
Index.js -> controller action -> crawler function -> PCC

Deploy development
tsc && gcloud functions deploy crawler-dev --entry-point run  --runtime nodejs12 --set-env-vars NODE_ENV=development --memory=2048  --trigger-http --timeout 539s --allow-unauthenticated

Deploy production
tsc && gcloud functions deploy crawler-prod --entry-point run  --runtime nodejs12 --set-env-vars NODE_ENV=production --memory=2048  --trigger-http --allow-unauthenticated --timeout 539s

Deploy stage
tsc && tsc && gcloud functions deploy crawler-stage --entry-point run  --runtime nodejs12 --set-env-vars NODE_ENV=stage --memory=2048  --trigger-http --allow-unauthenticated --timeout 539s
