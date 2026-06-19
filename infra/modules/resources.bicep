targetScope = 'resourceGroup'

@description('Primary Azure region for all resources.')
param location string

@description('Tags applied to all resources.')
param tags object = {}

@minLength(1)
@maxLength(64)
@description('Name of the azd environment — used to derive resource names.')
param environmentName string

@secure()
@description('Web IQ API key, stored as a Container App secret and exposed to the app as WEBIQ_API_KEY.')
param webiqApiKey string

@description('Logical azd service name. Must match the service key in azure.yaml.')
param serviceName string = 'app'

@description('Container ingress/target port. Must match the port the server listens on.')
param targetPort int = 8080

// Cost note: minReplicas 1 keeps one warm replica, so the first request after a quiet
// period skips the cold start. While that replica isn't serving traffic it is billed at
// the reduced Container Apps *idle* rate (vCPU idle ≈ $0.000003/vCPU-s vs active ≈
// $0.000024/vCPU-s), not the active rate — ~$4–5/mo at 0.25 vCPU / 0.5 GiB after the
// monthly free grant. Set to 0 to scale to zero ($0 idle compute, cold start on wake).
@minValue(0)
@description('Minimum replicas. 1 (default) keeps a warm instance to avoid cold starts (billed at the reduced idle rate when not serving traffic). 0 = scale to zero (no idle compute cost, cold start on the first request).')
param minReplicas int = 1

@minValue(1)
@description('Maximum replicas under load.')
param maxReplicas int = 3

@description('Optional custom domain bound to the app (e.g. app.example.com). Leave empty to skip. Requires a CNAME to the app FQDN + an asuid TXT record in DNS BEFORE provisioning, so the managed certificate can be issued.')
param customDomain string = ''

@description('Two-phase managed-cert flag. Phase 1 (false): bind the hostname as Disabled so Azure will allow the managed certificate to be created. Phase 2 (true): create the managed cert and switch the binding to SniEnabled. A single pass is impossible (cert needs the hostname; an SNI binding needs the cert).')
param bindCertificate bool = false

var resourceSuffix = take(uniqueString(subscription().id, environmentName, location), 6)
var logAnalyticsName = take('log-${environmentName}-${resourceSuffix}', 63)
var appInsightsName = take('appi-${environmentName}-${resourceSuffix}', 63)
var containerRegistryName = take(toLower(replace('cr${environmentName}${resourceSuffix}', '-', '')), 50)
var containerEnvName = take('cae-${environmentName}-${resourceSuffix}', 32)
var containerAppName = take('ca-${environmentName}-${resourceSuffix}', 32)
var managedCertName = empty(customDomain) ? '' : take('mc-${replace(replace(customDomain, '.', '-'), '*', 'wild')}', 32)
// Built-in Owner role definition ID. The abuse alert's action group uses an
// ARM-role receiver, so Azure notifies the email registered on each account that
// owns the subscription — no custom address is stored in the repo.
var ownerRoleId = '8e3af657-a8ff-443c-a75c-2fe8c4bcb635'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    // Keep ingestion/retention minimal for a low-cost demo.
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}

// Workspace-based Application Insights, backed by the same Log Analytics workspace.
// Receives custom events (sandbox searches), exceptions, requests and dependencies
// from the server SDK via APPLICATIONINSIGHTS_CONNECTION_STRING (set on the app below).
resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: containerRegistryName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
  }
}

// Consumption-only environment: no workloadProfiles block => no idle base cost.
resource containerEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: containerEnvName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// Free Azure-managed TLS certificate for the custom domain. Issued via CNAME
// domain-control validation. Azure requires the hostname to already be bound to a
// container app in the environment before the cert can be created, so this is only
// created in phase 2 (bindCertificate = true). The CNAME + asuid TXT records must
// also exist in DNS first.
resource managedCertificate 'Microsoft.App/managedEnvironments/managedCertificates@2024-03-01' = if (!empty(customDomain) && bindCertificate) {
  parent: containerEnv
  name: managedCertName
  location: location
  tags: tags
  properties: {
    subjectName: customDomain
    domainControlValidation: 'CNAME'
  }
}

// Registry/identity link: the app authenticates to ACR with its system-assigned
// identity (AcrPull granted in acr-pull-role.bicep). Safe to declare at create time
// because the initial image is the PUBLIC placeholder (mcr.microsoft.com) — ACR auth
// is only exercised once the real image is deployed, by which time the role exists.
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  tags: union(tags, { 'azd-service-name': serviceName })
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: containerEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: targetPort
        transport: 'auto'
        allowInsecure: false
        customDomains: empty(customDomain) ? null : [
          {
            name: customDomain
            bindingType: bindCertificate ? 'SniEnabled' : 'Disabled'
            certificateId: bindCertificate ? managedCertificate.id : null
          }
        ]
      }
      registries: [
        {
          server: containerRegistry.properties.loginServer
          identity: 'system'
        }
      ]
      secrets: [
        {
          name: 'webiq-api-key'
          value: webiqApiKey
        }
        {
          name: 'appinsights-connection-string'
          value: applicationInsights.properties.ConnectionString
        }
      ]
    }
    template: {
      containers: [
        {
          name: serviceName
          // Placeholder until azd pushes the real image; ingress/targetPort
          // are fixed at provision time and matched by the runtime app.
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: string(targetPort)
            }
            {
              name: 'WEBIQ_API_KEY'
              secretRef: 'webiq-api-key'
            }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              secretRef: 'appinsights-connection-string'
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/health'
                port: targetPort
              }
              initialDelaySeconds: 5
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/health'
                port: targetPort
              }
              initialDelaySeconds: 3
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Monitoring: engagement workbook + rate-limit email alert
// ---------------------------------------------------------------------------

// Unified "user engagement" dashboard, bound to the App Insights resource. All
// queries are scoped to the SandboxSearch / SandboxRateLimited custom events and
// the exceptions table. No query text is stored, only metadata + an anonymous id.
var workbookContent = {
  version: 'Notebook/1.0'
  '$schema': 'https://github.com/Microsoft/Application-Insights-Workbooks/blob/master/schema/workbook.json'
  items: [
    {
      type: 1
      content: {
        json: '## Web IQ — User Engagement\nAnonymous sandbox usage analytics (role `webiq-demo-server`). Each "Run request" emits a `SandboxSearch` event with endpoint, outcome, timing and an anonymised visitor id — never the query text.'
      }
      name: 'title'
    }
    {
      type: 3
      content: {
        version: 'KqlItem/1.0'
        query: 'customEvents | where name == "SandboxSearch" | summarize Searches = count(), Visitors = dcount(tostring(customDimensions.anonId)), Failures = countif(tostring(customDimensions.outcome) == "failure")'
        size: 4
        title: 'Totals (selected time range)'
        timeContext: { durationMs: 604800000 }
        queryType: 0
        resourceType: 'microsoft.insights/components'
        visualization: 'table'
      }
      name: 'totals'
    }
    {
      type: 3
      content: {
        version: 'KqlItem/1.0'
        query: 'customEvents | where name == "SandboxSearch" | summarize Searches = count(), Visitors = dcount(tostring(customDimensions.anonId)) by bin(timestamp, 1h) | render timechart'
        size: 0
        title: 'Searches & unique visitors over time'
        timeContext: { durationMs: 604800000 }
        queryType: 0
        resourceType: 'microsoft.insights/components'
        visualization: 'timechart'
      }
      name: 'searches-over-time'
    }
    {
      type: 3
      content: {
        version: 'KqlItem/1.0'
        query: 'customEvents | where name == "SandboxSearch" | summarize Searches = count() by Endpoint = tostring(customDimensions.endpointId) | order by Searches desc | render barchart'
        size: 0
        title: 'Searches by endpoint'
        timeContext: { durationMs: 604800000 }
        queryType: 0
        resourceType: 'microsoft.insights/components'
        visualization: 'barchart'
      }
      name: 'searches-by-endpoint'
    }
    {
      type: 3
      content: {
        version: 'KqlItem/1.0'
        query: 'customEvents | where name == "SandboxSearch" | summarize Count = count() by Outcome = tostring(customDimensions.outcome) | render piechart'
        size: 0
        title: 'Outcome breakdown'
        timeContext: { durationMs: 604800000 }
        queryType: 0
        resourceType: 'microsoft.insights/components'
        visualization: 'piechart'
      }
      name: 'outcome-breakdown'
    }
    {
      type: 3
      content: {
        version: 'KqlItem/1.0'
        query: 'customEvents | where name == "SandboxSearch" | extend ms = todouble(customMeasurements.elapsedMs) | where isnotempty(ms) | summarize p50 = percentile(ms, 50), p95 = percentile(ms, 95) by bin(timestamp, 1h) | render timechart'
        size: 0
        title: 'Response time (p50 / p95, ms)'
        timeContext: { durationMs: 604800000 }
        queryType: 0
        resourceType: 'microsoft.insights/components'
        visualization: 'timechart'
      }
      name: 'latency'
    }
    {
      type: 3
      content: {
        version: 'KqlItem/1.0'
        query: 'customEvents | where name == "SandboxSearch" and tostring(customDimensions.outcome) == "failure" | summarize Count = count() by ErrorClass = tostring(customDimensions.errorClass) | order by Count desc | render barchart'
        size: 0
        title: 'Errors by class'
        timeContext: { durationMs: 604800000 }
        queryType: 0
        resourceType: 'microsoft.insights/components'
        visualization: 'barchart'
      }
      name: 'errors-by-class'
    }
    {
      type: 3
      content: {
        version: 'KqlItem/1.0'
        query: 'customEvents | where name == "SandboxRateLimited" | summarize RateLimited = count() by Endpoint = tostring(customDimensions.endpointId), bin(timestamp, 1h) | render timechart'
        size: 0
        title: 'Rate-limit events over time'
        timeContext: { durationMs: 604800000 }
        queryType: 0
        resourceType: 'microsoft.insights/components'
        visualization: 'timechart'
      }
      name: 'rate-limit'
    }
    {
      type: 3
      content: {
        version: 'KqlItem/1.0'
        query: 'exceptions | summarize Count = count() by Type = type, Problem = outerMessage | order by Count desc | take 10'
        size: 0
        title: 'Top exceptions'
        timeContext: { durationMs: 604800000 }
        queryType: 0
        resourceType: 'microsoft.insights/components'
        visualization: 'table'
      }
      name: 'top-exceptions'
    }
  ]
  isLocked: false
  fallbackResourceIds: [
    applicationInsights.id
  ]
}

resource engagementWorkbook 'Microsoft.Insights/workbooks@2023-06-01' = {
  name: guid(applicationInsights.id, 'engagement-workbook')
  location: location
  tags: tags
  kind: 'shared'
  properties: {
    displayName: 'Web IQ — User Engagement'
    serializedData: string(workbookContent)
    category: 'workbook'
    sourceId: applicationInsights.id
    version: 'Notebook/1.0'
  }
}

// Action group for the abuse alert. Uses an ARM-role receiver targeting the
// subscription Owner role, so Azure notifies the email registered on the owner
// account(s) — no custom address stored. Always provisioned.
resource abuseActionGroup 'Microsoft.Insights/actionGroups@2023-09-01-preview' = {
  name: 'ag-${environmentName}-abuse'
  location: 'global'
  tags: tags
  properties: {
    groupShortName: 'webiqAbuse'
    enabled: true
    armRoleReceivers: [
      {
        name: 'subscription-owners'
        roleId: ownerRoleId
        useCommonAlertSchema: true
      }
    ]
  }
}

// Action group for the cost-budget spend alert. Mirrors the abuse action group: an
// ARM-role receiver targeting the subscription Owner role, so Azure emails the
// account(s) that own the subscription — no personal address is stored in the repo. The
// subscription-scoped budget in main.bicep references this group via its resource id.
resource costActionGroup 'Microsoft.Insights/actionGroups@2023-09-01-preview' = {
  name: 'ag-${environmentName}-cost'
  location: 'global'
  tags: tags
  properties: {
    groupShortName: 'webiqCost'
    enabled: true
    armRoleReceivers: [
      {
        name: 'subscription-owners'
        roleId: ownerRoleId
        useCommonAlertSchema: true
      }
    ]
  }
}

// Log alert: fires whenever the gateway records abuse — a per-IP rate-limit hit
// (SandboxRateLimited) or an oversized input/body rejection (SandboxAbuse). main
// also emits SandboxRateLimited on upstream 429/430s, so those are covered too.
// autoMitigate lets it resolve and re-fire on the next incident.
resource abuseAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'alert-${environmentName}-abuse'
  location: location
  tags: tags
  kind: 'LogAlert'
  properties: {
    displayName: 'Web IQ — abuse detected'
    description: 'Notifies the subscription Owner role when the sandbox records abuse: per-IP rate limiting, oversized request bodies, oversized search input, or an upstream rate-limit (429/430).'
    severity: 2
    enabled: true
    scopes: [
      applicationInsights.id
    ]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT5M'
    criteria: {
      allOf: [
        {
          query: 'customEvents | where name in ("SandboxRateLimited", "SandboxAbuse")'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    autoMitigate: true
    actions: {
      actionGroups: [
        abuseActionGroup.id
      ]
    }
  }
}

output containerRegistryName string = containerRegistry.name
output containerRegistryLoginServer string = containerRegistry.properties.loginServer
output containerAppName string = containerApp.name
output containerAppPrincipalId string = containerApp.identity.principalId
output containerAppUri string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output logAnalyticsWorkspaceId string = logAnalytics.id
output customDomainUrl string = empty(customDomain) ? '' : 'https://${customDomain}'
output applicationInsightsName string = applicationInsights.name
output engagementWorkbookName string = engagementWorkbook.name
output abuseAlertName string = abuseAlert.name
output abuseActionGroupName string = abuseActionGroup.name
output costActionGroupId string = costActionGroup.id
output costActionGroupName string = costActionGroup.name
