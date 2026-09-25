---
id: kubernetes-basics
name: Kubernetes Basics for App Developers
category: devops
estTokens: 3100
---

Enough Kubernetes to deploy and debug a web service confidently.

## The objects you need (and only these, to start)

- **Deployment**: desired state for your pods (image, replicas, env). The unit you `kubectl apply`.
- **Service**: stable DNS name + load balancing over pods (`ClusterIP` internal; the app rarely needs more).
- **Ingress**: external HTTP(S) routing to Services. TLS terminates here.
- **ConfigMap / Secret**: config and credentials, mounted as env or files. Secrets are base64, not encrypted by default — use external secret managers (Vault, cloud KMS, External Secrets Operator) for real secrets.
- **PersistentVolumeClaim**: durable disk. Most web apps should be stateless — reach for managed databases instead of running your own in-cluster.

## Minimal deployment manifest

```yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: api, labels: { app: api } }
spec:
  replicas: 3
  strategy: { type: RollingUpdate, rollingUpdate: { maxUnavailable: 1, maxSurge: 1 } }
  selector: { matchLabels: { app: api } }
  template:
    metadata: { labels: { app: api } }
    spec:
      containers:
        - name: api
          image: ghcr.io/org/app:<sha>   # immutable tag, never :latest
          ports: [{ containerPort: 3000 }]
          envFrom: [{ configMapRef: { name: api-config } }, { secretRef: { name: api-secrets } }]
          resources:
            requests: { cpu: 100m, memory: 128Mi }
            limits: { cpu: 500m, memory: 512Mi }
          livenessProbe:  { httpGet: { path: /health, port: 3000 }, periodSeconds: 15 }
          readinessProbe: { httpGet: { path: /ready,  port: 3000 }, periodSeconds: 5 }
---
apiVersion: v1
kind: Service
metadata: { name: api }
spec:
  selector: { app: api }
  ports: [{ port: 80, targetPort: 3000 }]
```

## Rules that prevent outages

- **Always set resource requests AND limits.** No requests → the scheduler can't place pods sanely; no limits → one pod OOMs the node. Size from real metrics, not guesses.
- **Probes**: `readinessProbe` gates traffic (pod must pass before receiving requests); `livenessProbe` restarts stuck pods. Keep liveness conservative — a failing liveness probe in a cascade restarts everything at once.
- **RollingUpdate** with `maxUnavailable: 1`: zero-downtime deploys by default. Your app must handle SIGTERM gracefully (finish in-flight requests, then exit).
- **PodDisruptionBudgets** for critical services so node drains don't take you to zero.
- **Namespaces** per environment/team (`staging`, `prod`). NetworkPolicies to restrict pod-to-pod traffic in prod.

## Debugging (in order)

1. `kubectl get pods -n <ns>` — what's the state? (`CrashLoopBackOff`, `Pending`, `ImagePullBackOff`)
2. `kubectl describe pod <pod> -n <ns>` — events at the bottom tell you why (failed probe, OOMKilled, unschedulable).
3. `kubectl logs <pod> -n <ns> --previous` — logs from the crashed container.
4. `kubectl top pods -n <ns>` — are you hitting limits?
5. `kubectl get events -n <ns> --sort-by=.lastTimestamp` — the cluster's own diary.

## Config and deploys

- `kubectl apply -f k8s/` or better: Kustomize (built into kubectl) for env overlays; Helm only when you need templating across many services.
- GitOps (ArgoCD/Flux): the cluster converges to git. `kubectl apply` from laptops stops being a thing.
- Image pull: use imagePullSecrets or workload identity; nodes shouldn't carry registry credentials in env.

## Don'ts

- Don't run databases in-cluster unless you have an operator and a backup story (use managed RDS/Cloud SQL). Don't use `:latest` tags — rollbacks become impossible. Don't `kubectl exec` into prod to "fix" things — fix the image and redeploy. Don't skip requests/limits. Don't store secrets in plain YAML applied from a laptop without encryption at rest (enable etcd encryption).

## Autoscaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: api }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: api }
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource: { name: cpu, target: { type: Utilization, averageUtilization: 70 } }
```

- HPA needs resource requests set (it scales on utilization = usage/requests). Scale on custom metrics (queue depth, p99 latency) for better signals than CPU.
- Scale down slowly (`stabilizationWindowSeconds`, default 300s) to avoid flapping. Load-test autoscaling before you need it.

## Ingress and TLS

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api
  annotations: { cert-manager.io/cluster-issuer: "letsencrypt-prod" }
spec:
  ingressClassName: nginx
  tls: [{ hosts: ["api.example.com"], secretName: api-tls }]
  rules:
    - host: api.example.com
      http: { paths: [{ path: /, pathType: Prefix, backend: { service: { name: api, port: { number: 80 } } } }] }
```

- cert-manager + Let's Encrypt = free automated TLS with renewal. Terminate TLS at ingress; internal traffic can stay HTTP (or add mTLS via a service mesh when you need it).

## Resource hygiene

- `kubectl apply` is declarative — keep manifests in git. `kubectl rollout status deployment/api` to watch a deploy; `kubectl rollout undo` for instant rollback.
- Labels are your query language: `app`, `version`, `environment` on everything. Selectors, dashboards, and alerts all key off them.
